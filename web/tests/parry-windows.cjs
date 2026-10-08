/* Sweep actual engine contacts, including freeze, air, and browser input queues. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const golden=require('./golden-inputs.json');

(async()=>{
 const server=spawn('python3',['web/serve.py','--port','3743'],{cwd:path.resolve(__dirname,'../..'),stdio:['ignore','pipe','pipe']});let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));});
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.controlledFrames=[];window.controlFrames=false;window.testPad=null;
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});
   const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>controlFrames?(controlledFrames.push(cb),0):raf(cb);
  });
  await page.goto('http://127.0.0.1:3743/');await page.waitForFunction(()=>window.moment37?.state.ready);
  await page.locator('#evo-volume').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#play');await page.waitForFunction(()=>moment37.state.status===2);
  await page.evaluate(()=>window.controlFrames=true);await page.waitForFunction(()=>controlledFrames.length>0,null,{polling:10});
  const windows=await page.evaluate(g=>{
   const e=moment37.engine;e._web_render(0);const result=[];
   const taps=Object.keys(g.inputs).map(Number).filter(f=>g.inputs[f]===4&&f<450);
   for(let i=0;i<15;i++){
    const impact=g.expected_parries[i],trials=[];
    for(let at=impact-10;at<=impact+1;at++){
     const inputs={...g.inputs};delete inputs[taps[i]];inputs[at]=4;e._web_reset();e._web_start();
     const contacts=[];let count=0;
     for(let f=0;f<=impact+6&&e._web_status()===2;f++){e._web_step(inputs[f]||0);const p=e._web_value(5);if(p>count){contacts.push(f);count=p;}}
     trials.push({at,parried:count>=i+1,contact:contacts[i]??null});
    }
    result.push({parry:i+1,impact,trials});
   }
   return result;
  },golden);
  for(const window of windows)for(const trial of window.trials){
   const valid=trial.at>=window.impact-9&&trial.at<=window.impact;
   assert.equal(trial.parried,valid,`Parry ${window.parry}: input ${trial.at}, impact ${window.impact}`);
   if(valid)assert.equal(trial.contact,window.impact,'Changing tap timing must not synthesize an earlier hit');
  }
  const mixedWindows=await page.evaluate(g=>{
   const e=moment37.engine,result=[];e._web_render(0);
   const taps=Object.keys(g.inputs).map(Number).filter(f=>g.inputs[f]===4&&f<450);
   // Vary every tap together, including the two extremes, then mix the valid
   // positions. Earlier movement must not shrink a later hit's window.
   for(let pattern=0;pattern<30;pattern++){
    const inputs={...g.inputs};for(const tap of taps)delete inputs[tap];
    const positions=g.expected_parries.map((impact,i)=>impact-9+(pattern<10?pattern:(i*7+pattern)%10));
    positions.forEach(at=>inputs[at]=4);e._web_reset();e._web_start();
    const contacts=[];let count=0;
    for(let f=0;f<=450&&e._web_status()===2;f++){e._web_step(inputs[f]||0);const p=e._web_value(5);if(p>count){contacts.push(f);count=p;}}
    result.push({pattern,positions,contacts,parries:count,hp:e._web_value(3)});
   }
   return result;
  },golden);
  for(const trial of mixedWindows){
   assert.equal(trial.parries,15,`All fifteen valid taps must work together: pattern ${trial.pattern}`);
   assert.equal(trial.hp,1);assert.deepEqual(trial.contacts,golden.expected_parries);
  }
  const browserPulses=await page.evaluate(g=>{
   const e=moment37.engine,result=[];e._web_render(0);
   const taps=Object.keys(g.inputs).map(Number).filter(f=>g.inputs[f]===4&&f<450);
   // Deliver a 1 ms press/release together before a delayed rAF callback. Also
   // poll a controller snapshot in that same catch-up batch. Neither can be
   // copied into the earlier frame or lose the actual input frame.
   for(const i of [0,1,14])for(let at=g.expected_parries[i]-9;at<=g.expected_parries[i];at++)for(const device of ['keyboard','controller']){
    const reference={...g.inputs};delete reference[taps[i]];
    e._web_reset();e._web_start();keys.clear();padBits=0;testPad=null;
    for(let f=0;f<at-1;f++)e._web_step(reference[f]||0);
    const now=performance.now(),origin=now-(at+2)*MomentTiming.FRAME_MS;
    frameClock.reset(origin);frameClock.frames=at-1;frameClock.last=now-MomentTiming.FRAME_MS*3;
    keyboardHistory.reset(0,origin+(at-1)*MomentTiming.FRAME_MS);padHistory.reset(0,origin+(at-1)*MomentTiming.FRAME_MS);
    const timestamp=origin+(at+.5)*MomentTiming.FRAME_MS;
    if(device==='keyboard')for(const [type,time] of [['keydown',timestamp],['keyup',timestamp+1]]){
     const event=new KeyboardEvent(type,{code:'ArrowLeft',bubbles:true,cancelable:true});Object.defineProperty(event,'timeStamp',{value:time});document.dispatchEvent(event);
    }else testPad={connected:true,axes:[0,0],timestamp,buttons:Array.from({length:17},(_,j)=>({pressed:j===14}))};
    const inputs=[],step=e._web_step;e._web_step=function(bits){inputs.push({frame:e._web_value(2),bits});return step(bits);};
    controlledFrames.shift()(now);e._web_step=step;testPad=null;padBits=0;
    while(e._web_value(2)<=g.expected_parries[i]+6&&e._web_status()===2)e._web_step(reference[e._web_value(2)]||0);
    result.push({device,parry:i+1,at,parries:e._web_value(5),inputs});
   }
   return result;
  },golden);
  for(const trial of browserPulses){
   assert.ok(trial.parries>=trial.parry,`${trial.device} short tap at ${trial.at} must parry hit ${trial.parry}`);
   assert.equal(trial.inputs[0].bits,0,'Never apply a new input to an older catch-up frame');
   assert.ok(trial.inputs.some(input=>input.frame===trial.at&&(input.bits&(4<<16))),'Preserve the fresh forward edge at its timestamped frame');
  }
  const guardrails=await page.evaluate(g=>{
   const e=moment37.engine;
   function run(input,limit=230){e._web_reset();e._web_start();for(let f=0;f<limit&&e._web_status()===2;f++)e._web_step(input(f));return{parries:e._web_value(5),status:e._web_status(),hp:e._web_value(3)};}
   const held=run(f=>f>=144?4:0),back=run(f=>f>=144&&f<=153?8:0),escape=run(f=>f<80?8:g.inputs[f]||0,650);
   // Retry clears an armed tap, so it cannot rescue the next attempt.
   e._web_reset();e._web_start();for(let f=0;f<=149;f++)e._web_step(f===149?4:0);
   const armed=e._web_value(56);e._web_reset();const resetRemaining=e._web_value(56);e._web_start();for(let f=0;f<230&&e._web_status()===2;f++)e._web_step(0);
   return{held,back,escape,armed,resetRemaining,afterReset:e._web_value(5)};
  },golden);
  assert.equal(guardrails.held.parries,1,'Holding forward must not parry another kick');
  assert.equal(guardrails.back.parries,0);assert.ok(guardrails.escape.parries<15);
  assert.ok(guardrails.armed>0);assert.equal(guardrails.resetRemaining,0);assert.equal(guardrails.afterReset,0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,validFrames:150,rejectedBoundaryFrames:30,mixedSequences:mixedWindows.length,browserTrials:browserPulses.length,windows:windows.map(w=>({parry:w.parry,start:w.impact-9,end:w.impact})),guardrails},null,2));
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
