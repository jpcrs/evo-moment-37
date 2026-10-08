const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const golden=require('./golden-inputs.json');

// Verify the browser host against elapsed NTSC time, independently of display refresh.
const context=vm.createContext({performance});
vm.runInContext(fs.readFileSync('web/dist/timing.js','utf8'),context);
vm.runInContext('this.Timing=MomentTiming;this.Clock=MomentFrameClock;this.Buttons=MomentButtonHistory;this.inputTime=momentInputTime;',context);
const {Timing,Clock,Buttons,inputTime}=context;
for(const refresh of [60,120,144,165]){
 const clock=new Clock();clock.reset(0);const ticks=[];
 const present=time=>{const frames=clock.pending(time);assert.ok(frames>=0);for(let i=0;i<frames;i++)ticks.push(clock.next());};
 for(let time=1000/refresh;time<10010;time+=1000/refresh)present(time);
 present(10010);assert.equal(ticks.length,600,`${refresh} Hz display must advance 600 PS2 ticks in 10.01 seconds`);
 assert.ok(Math.abs(ticks.at(-1)-10010)<1e-6);
}
const buttons=new Buttons();
buttons.record(4,10);buttons.record(0,20);buttons.record(4,40);buttons.record(0,48);
assert.deepEqual([1,2,3].map(f=>buttons.sample(f*Timing.FRAME_MS)),[4,0,0],'A pulse spanning a game tick survives a late display callback; a pulse between ticks receives no extra buffering');
buttons.reset();buttons.record(4,40);
assert.deepEqual([1,2,3].map(f=>buttons.sample(f*Timing.FRAME_MS)),[0,0,4],'A new controller snapshot cannot be applied to older catch-up frames');
buttons.reset(0,100);assert.equal(buttons.sample(120),0,'Retry discards queued input');
const stalled=new Clock();stalled.reset(0);assert.equal(stalled.pending(100),-1,'A major hitch must pause rather than discard elapsed time');
const delayed=new Clock(),regular=new Clock();delayed.reset(0);regular.reset(0);
for(let display=1;display<=600;display++){
 const presentation=display*1000/60,expected=regular.pending(presentation),actual=delayed.pending(presentation,presentation+(display%2?7:1));
 assert.equal(actual,expected,'Variation in callback arrival must not change which simulation frames are presented');
 for(let f=0;f<actual;f++)assert.equal(delayed.next(),regular.next());
}
const lateCallback=new Clock();lateCallback.reset(0);assert.equal(lateCallback.pending(16,100),-1,'A callback carrying an old display timestamp must still detect a real stall');
assert.ok(Math.abs(inputTime(performance.timeOrigin+10,100)-10)<.001);

(async()=>{
 const server=spawn('python3',['web/serve.py','--port','3740'],{cwd:path.resolve(__dirname,'../..'),stdio:['ignore','pipe','pipe']});let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Test server exited: ${code}`)));});
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Drive the existing rAF callbacks deterministically without changing the game module.
  await page.addInitScript(()=>{
   window.controlledFrames=[];window.controlFrames=false;
   window.testPad=null;Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});
   const raf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=callback=>controlFrames?(controlledFrames.push(callback),0):raf(callback);
  });
  await page.goto('http://127.0.0.1:3740/');await page.waitForFunction(()=>moment37.state.ready);
  await page.locator('#evo-volume').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#play');await page.waitForFunction(()=>moment37.state.status===2);
  await page.evaluate(()=>window.controlFrames=true);await page.waitForFunction(()=>controlledFrames.length>0,null,{polling:10});
  const queued=await page.evaluate(()=>{
   const e=moment37.engine;e._web_reset();e._web_start();resetInputClock();
   const start=performance.now();frameClock.reset(start-55);keyboardHistory.reset(0,start-55);padHistory.reset(0,start-55);
   function key(type,at){const event=new KeyboardEvent(type,{code:'ArrowLeft',bubbles:true,cancelable:true});Object.defineProperty(event,'timeStamp',{value:start-55+at});document.dispatchEvent(event);}
   key('keydown',10);key('keyup',20);key('keydown',40);key('keyup',48);
   const inputs=[],original=e._web_step;e._web_step=function(bits){inputs.push(bits);return original(bits);};
   controlledFrames.shift()(start);e._web_step=original;
   return{inputs,frame:e._web_value(2)};
  });
  assert.deepEqual(queued.inputs,[4,0,0]);assert.equal(queued.frame,3);
  const controller=await page.evaluate(()=>{
   const e=moment37.engine;e._web_reset();e._web_start();resetInputClock();const now=performance.now();
   frameClock.reset(now-55);keyboardHistory.reset(0,now-55);padHistory.reset(0,now-55);
   window.testPad={connected:true,axes:[0,0],timestamp:now-15,buttons:Array.from({length:17},(_,i)=>({pressed:i===14}))};
   const inputs=[],original=e._web_step;e._web_step=function(bits){inputs.push(bits);return original(bits);};
   controlledFrames.shift()(now);e._web_step=original;window.testPad=null;return inputs;
  });
  assert.deepEqual(controller,[0,0,4],'The browser must respect the controller snapshot timestamp during catch-up');
  const refreshRuns=await page.evaluate(golden=>{
   const e=moment37.engine,runs=[];
   for(const refresh of [60,120,144]){
    e._web_reset();e._web_start();const clock=new MomentFrameClock(),history=new MomentButtonHistory();clock.reset(0);
    for(let f=0;f<=504;f++)history.record(golden.inputs[f]||0,(f+1)*MomentTiming.FRAME_MS-.01);
    let displayed=0,parry=0,events=[];
    for(let time=1000/refresh;time<14000&&e._web_status()===2;time+=1000/refresh){
     const frames=clock.pending(time);
     for(let i=0;i<frames&&e._web_status()===2;i++){
      const frame=e._web_value(2);e._web_render(i===frames-1||e._web_value(40)?1:0);e._web_step(history.sample(clock.next()));
      const p=e._web_value(5);if(p>parry){events.push(frame);parry=p;}
     }
     displayed++;
    }
    runs.push({refresh,status:e._web_status(),hp:e._web_value(3),parries:parry,events,displayed});
   }
   e._web_render(1);e._web_reset();resetInputClock();return runs;
  },golden);
  for(const run of refreshRuns){assert.equal(run.status,4);assert.equal(run.hp,1);assert.equal(run.parries,15);assert.deepEqual(run.events,golden.expected_parries);}
  await page.evaluate(()=>{
   const e=moment37.engine;e._web_start();resetInputClock();frameClock.last=performance.now()-100;
   controlledFrames.shift()(performance.now());
  });
  assert.equal(await page.evaluate(()=>moment37.state.paused),true);
  assert.equal(await page.evaluate(()=>moment37.engine._web_value(2)),0,'The stalled attempt must not fast-forward');
  assert.equal(await page.locator('#pause-note').isVisible(),true);
  await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>moment37.state.paused),false);
  const heldAfterPause=await page.evaluate(()=>{
   const e=moment37.engine;document.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowLeft',bubbles:true,cancelable:true}));
   setPaused(true);setPaused(false);const now=performance.now();frameClock.reset(now-20);
   const inputs=[],original=e._web_step;e._web_step=function(bits){inputs.push(bits);return original(bits);};
   controlledFrames.shift()(now);e._web_step=original;document.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowLeft',bubbles:true}));return inputs;
  });
  assert.deepEqual(heldAfterPause,[4],'Pause/resume must preserve a held key without inventing a release');
  await page.evaluate(()=>{window.controlFrames=false;const callbacks=controlledFrames.splice(0);for(const callback of callbacks)requestAnimationFrame(callback);});
  await page.waitForFunction(()=>moment37.engine._web_value(2)>0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,frameRate:Timing.FPS,queued,controller,refreshRuns,stallPausesWithoutAdvancing:true,heldAfterPause},null,2));
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
