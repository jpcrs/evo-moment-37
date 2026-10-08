/* Check real audio signals and interruption recovery, not just a playing flag. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium,webkit,devices}=require('@playwright/test');

(async()=>{
 const server=spawn('python3',['web/serve.py','--port','3745'],{cwd:path.resolve(__dirname,'../..'),stdio:['ignore','pipe','pipe']});
 let browser;const results=[];
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));});
  for(const driver of [chromium,webkit]){
   browser=await driver.launch({headless:true});
   const context=await browser.newContext({...devices[driver===webkit?'iPhone 13':'Pixel 7'],viewport:{width:844,height:390}});
   await context.route(/cloudflareinsights\.com/,route=>route.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:3745/');await page.waitForFunction(()=>window.moment37?.state.ready);
   const initial=await page.evaluate(()=>moment37.audio);
   if(driver===webkit)assert.equal(initial.sessionType,'playback','Select playback routing before creating WebKit audio');
   await page.evaluate(()=>{
    const ctx=audioMixer.context,zero=ctx.createGain();zero.gain.value=0;zero.connect(ctx.destination);
    window.meters={};
    for(const [name,gain] of [['game',audioMixer.gameGain],['evo',audioMixer.evoGain]]){
     const analyser=ctx.createAnalyser();analyser.fftSize=2048;gain.connect(analyser);analyser.connect(zero);meters[name]=analyser;
    }
    window.signalPeak=name=>{const bytes=new Float32Array(2048);meters[name].getFloatTimeDomainData(bytes);return bytes.reduce((peak,value)=>Math.max(peak,Math.abs(value)),0);};
    window.audioClockBeforeStart=ctx.currentTime;
   });
   await page.tap('#play');await page.waitForFunction(()=>moment37.state.status===2&&moment37.audio.contextState==='running');
   await page.waitForFunction(()=>signalPeak('game')>.001,null,{polling:10,timeout:5000});
   const gamePeak=await page.evaluate(()=>signalPeak('game'));
   await page.waitForFunction(()=>moment37.audio.status==='playing'&&signalPeak('evo')>.001,null,{polling:10,timeout:5000});
   const playing=await page.evaluate(()=>({state:moment37.audio,gamePeak:signalPeak('game'),evoPeak:signalPeak('evo'),frame:moment37.engine._web_value(2)}));
   assert.ok(playing.evoPeak>.001);assert.equal(playing.state.activationFrame,100);
   // Emulate an OS interruption using the actual suspended context, exposing
   // WebKit's additional "interrupted" state until resume is explicitly called.
   await page.evaluate(async()=>{
    const ctx=audioMixer.context,resume=ctx.resume.bind(ctx),suspend=ctx.suspend.bind(ctx);
    let prototype=ctx,stateGetter;
    while(prototype&&!stateGetter){stateGetter=Object.getOwnPropertyDescriptor(prototype,'state')?.get;prototype=Object.getPrototypeOf(prototype);}
    window.interruption=true;window.audioRecovery=[];
    Object.defineProperty(ctx,'state',{configurable:true,get:()=>interruption?'interrupted':stateGetter.call(ctx)});
    ctx.suspend=()=>{audioRecovery.push('suspend');return suspend();};
    ctx.resume=()=>{audioRecovery.push('resume');interruption=false;return resume();};
    await suspend();
   });
   await page.waitForFunction(()=>moment37.state.paused&&moment37.audio.status==='paused');
   const paused=await page.evaluate(()=>({frame:moment37.engine._web_value(2),audio:moment37.audio}));
   await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>moment37.engine._web_value(2)),paused.frame,'Audio interruption must freeze the challenge');
   assert.equal(await page.evaluate(()=>moment37.audio.position),paused.audio.position);
   await page.tap('#resume');await page.waitForFunction(()=>!moment37.state.paused&&moment37.audio.contextState==='running');
   await page.waitForFunction(()=>moment37.audio.status==='playing'&&signalPeak('evo')>.001,null,{polling:10,timeout:2000});
   const recovered=await page.evaluate(()=>({audio:moment37.audio,steps:audioRecovery,peak:signalPeak('evo')}));
   assert.ok(recovered.steps.includes('suspend')&&recovered.steps.includes('resume'),'Recover interrupted contexts, not only suspended ones');
   assert.ok(recovered.audio.position>=paused.audio.position);
   // Changing volumes and retry must keep the graph audible and preserve user choices.
   await page.locator('#game-volume').evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}));});
   await page.locator('#evo-volume').evaluate(el=>{el.value='45';el.dispatchEvent(new Event('input',{bubbles:true}));});
   await page.tap('#mobile-menu-open');await page.tap('#retry');await page.waitForFunction(()=>moment37.state.status===2&&!moment37.state.paused);
   assert.equal(await page.locator('#game-volume').inputValue(),'35');assert.equal(await page.locator('#evo-volume').inputValue(),'45');
   await page.waitForFunction(()=>signalPeak('game')>.001,null,{polling:10,timeout:2000});
   assert.equal(await page.evaluate(()=>moment37.audio.contextState),'running');
   assert.deepEqual(errors,[]);
   results.push({browser:driver.name(),session:initial.sessionType,gamePeak,playing,recovery:recovered,interruptionPauses:true,retryPreservesVolumes:true});
   await context.close();await browser.close();browser=null;
  }
  console.log(JSON.stringify({passed:true,results},null,2));
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
