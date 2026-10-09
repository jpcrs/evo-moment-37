/* Verify Daigo's finish using real pad inputs and native confirmed hits. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('@playwright/test');
const golden=require('./golden-inputs.json');

(async()=>{
 const root=path.resolve(__dirname,'../..');
 const server=spawn('python3',['web/serve.py','--port','3746'],{cwd:root,stdio:['ignore','pipe','pipe']});
 let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Test server exited: ${code}`)));});
  browser=await chromium.launch();
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(/cloudflareinsights\.com/,route=>route.abort());
  await page.addInitScript(()=>{
   window.controlFrames=false;window.controlledFrames=[];
   const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>controlFrames?(controlledFrames.push(callback),0):raf(callback);
  });
  await page.goto('http://127.0.0.1:3746/');
  await page.waitForFunction(()=>window.moment37?.state.ready,null,{timeout:60000});
  await page.evaluate(()=>window.controlFrames=true);
  await page.waitForFunction(()=>controlledFrames.length>0);
  const results=await page.evaluate(g=>{
   const e=moment37.engine;e._web_render(0);
   function run(inputs){
    e._web_reset();e._web_start();let events=[],parries=0;
    for(let f=0;f<1300&&e._web_status()===2;f++){
     e._web_step(inputs[f]||0);const count=e._web_value(5);
     if(count>parries){events.push(f);parries=count;}
    }
    return{status:e._web_status(),hp:e._web_value(3),enemyHP:e._web_value(4),frame:e._web_value(2),parries,events,
     finish:moment37.finish,trace:Array.from({length:e._web_value(100)},(_,i)=>Array.from({length:8},(_,j)=>e._web_value(101+i*8+j)))};
   }
   const win=run(g.inputs),repeat=run(g.inputs),rejected={};
   for(const [name,punch] of [['missingShoryuken',0],['lightShoryuken',16],['heavyShoryuken',64],['exShoryuken',48]]){
    const inputs={...g.inputs};for(const f of [502,503])inputs[f]=6|punch;
    rejected[name]=run(inputs);
   }
   const noCancel={...g.inputs};for(const f of [514,515])noCancel[f]=4;
   rejected.secondShoryukenHit=run(noCancel);
   const earlyJumpKick={...g.inputs};delete earlyJumpKick[472];earlyJumpKick[466]=1024;
   rejected.earlyJumpKick=run(earlyJumpKick);
   const dropped={};for(const [f,bits] of Object.entries(g.inputs))dropped[Number(f)>=494?Number(f)+20:f]=bits;
   rejected.droppedCombo=run(dropped);
   const grounded={...g.inputs};delete grounded[424];rejected.groundedFinalParry=run(grounded);
   rejected.parriesOnly=run(Object.fromEntries(Object.entries(g.inputs).filter(([f])=>Number(f)<472)));
   const alternate=[];
   for(const shift of [-2,-1,1]){
    const inputs={};for(const [f,bits] of Object.entries(g.inputs))inputs[Number(f)>=472?Number(f)+shift:f]=bits;
    alternate.push({name:`finishShift${shift}`,...run(inputs)});
   }
   e._web_reset();const reset={finish:moment37.finish,traceCount:e._web_value(100),parries:e._web_value(5),status:e._web_status()};
   return{win,repeat,rejected,alternate,reset};
  },golden);
  function verifyWin(run){
   assert.equal(run.status,4,JSON.stringify(run));assert.equal(run.hp,1);assert.equal(run.enemyHP,-1);assert.equal(run.parries,15);
   assert.deepEqual(run.events,golden.expected_parries);
   assert.deepEqual(run.finish,{stage:4,failed:false,hits:12,cancels:3,airParry:true});
   assert.deepEqual(run.trace.map(hit=>hit[5]),Array.from({length:12},(_,i)=>i+1),'Every hit must remain in the original engine\'s combo counter');
   assert.deepEqual(run.trace.map(hit=>hit[1]),[5,3,10,...Array(9).fill(37)],'jHK, cMK, MP Shoryuken first hit, nine Shippu hits');
   assert.deepEqual(run.trace.map(hit=>hit[2]),[3,0,17,...Array(9).fill(21)]);
   assert.ok(run.trace[0][6]>0,'Jumping HK must hit while airborne');
   assert.equal(run.trace[1][7],32,'Medium kick must be crouching');
  }
  verifyWin(results.win);assert.deepEqual(results.win.trace.map(hit=>hit[0]),golden.finish.expected_hits);
  assert.deepEqual(results.repeat,results.win,'Retry must reproduce the connected finish');
  for(const [name,run] of Object.entries(results.rejected)){
   assert.equal(run.status,3,`${name} must fail the challenge`);
   if(name!=='parriesOnly')assert.equal(run.finish.failed,true,name);
  }
  assert.equal(results.rejected.groundedFinalParry.parries,15,'Fifteen grounded parries must not replace the final airborne parry');
  for(const run of results.alternate)verifyWin(run);
  assert.deepEqual(results.reset,{finish:{stage:0,failed:false,hits:0,cancels:0,airParry:false},traceCount:0,parries:0,status:1});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,win:results.win,rejected:Object.fromEntries(Object.entries(results.rejected).map(([name,run])=>[name,{status:run.status,finish:run.finish}])),alternate:results.alternate.map(run=>({name:run.name,status:run.status,hits:run.trace.map(hit=>hit[0])})),reset:results.reset},null,2));
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
