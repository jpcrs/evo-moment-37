/* A visual reference only. It never supplies inputs or changes the native engine. */
function momentGuideCues(sequence) {
  const directions={1:'↑',2:'↓',4:'←',8:'→',6:'↙',10:'↘',5:'↖',9:'↗'};
  const frames=Object.keys(sequence.inputs).map(Number),last=Math.max(...frames),cues=[];
  let previousDir=0,previousKick=0,parry=0;
  for(let frame=0;frame<=last+1;frame++){
    const bits=sequence.inputs[frame]||0,dir=bits&15,kick=bits&1792;
    if(dir&&dir!==previousDir){
      let end=frame+1;while(end<=last&&(sequence.inputs[end]&15)===dir)end++;
      const isParry=dir===4&&frame<450,isMotion=frame>=492;
      const ordinal=isParry?++parry:0;
      cues.push({id:`dir-${frame}`,frame,end,bits:dir,lane:'direction',glyph:directions[dir]||'↔',kind:isParry?'parry':isMotion?'motion':'jump',ordinal,
        name:isParry?(ordinal===15?'Air parry':'Parry '+String(ordinal).padStart(2,'0')):frame===492?'Crouching medium kick':frame===502?'Shippu Jinraikyaku':isMotion?'Super motion':'Jump',
        hint:isParry?'Tap forward, then release':frame===492?'Hold ↓ and tap MK':frame===502?'← + LK':isMotion?'Hold until the next direction':'Tap up'});
    }
    if(kick&&kick!==previousKick){
      let end=frame+1;while(end<=last&&(sequence.inputs[end]&1792)===kick)end++;
      const rank=kick===1024?'HK':kick===512?'MK':'LK';
      cues.push({id:`kick-${frame}`,frame,end,bits:kick,lane:'kick',glyph:rank,kind:'kick',key:rank==='HK'?'D':rank==='MK'?'S':'A',
        name:rank==='HK'?'Jumping heavy kick':rank==='MK'?'Crouching medium kick':'Shippu Jinraikyaku',hint:rank==='LK'?'Finish ↓ ↙ ← ↓ ↙ ← + kick':'Tap '+rank});
    }
    previousDir=dir;previousKick=kick;
  }
  return cues.sort((a,b)=>a.frame-b.frame);
}

class MomentAssistance {
  constructor({root,button,panel,track,line,title,hint,legend}) {
    Object.assign(this,{root,button,panel,track,line,title,hint,legend});
    this.enabled=false;this.loaded=false;this.cues=[];this.nodes=[];this.width=this.height=0;
    this.snapshot={frame:0,parries:0,status:0};this.stoppedFrame=null;this.flashFrame=-100;this.previousParries=0;this.desynced=false;
    this.keyboard=true;this.paused=false;
    this.resizeObserver=new ResizeObserver(()=>{this.measure();this.render();});this.resizeObserver.observe(track);
  }
  async load() {
    const response=await fetch('guide-sequence.json');if(!response.ok)throw new Error('The input guide could not be loaded.');
    const sequence=await response.json();
    if(Math.abs(sequence.fps-MomentTiming.FPS)>1e-6)throw new Error('The input guide uses a different frame rate.');
    this.contacts=sequence.expected_parries;
    this.cues=momentGuideCues(sequence);
    this.nodes=this.cues.map(cue=>{
      const node=document.createElement('div');node.className=`guide-note ${cue.kind}`;node.dataset.inputFrame=cue.frame;node.dataset.cue=cue.id;
      node.setAttribute('aria-hidden','true');node.hidden=true;
      const tail=document.createElement('i');tail.className='guide-hold';node.append(tail);
      const symbol=document.createElement('span');symbol.className='guide-symbol';symbol.textContent=cue.glyph;node.append(symbol);
      if(cue.ordinal){const number=document.createElement('small');number.className='guide-number';number.textContent=cue.ordinal;node.append(number);}
      if(cue.key){const key=document.createElement('small');key.className='guide-key';key.textContent=cue.key;node.append(key);}
      this.track.append(node);return node;
    });
    this.loaded=true;this.render();
  }
  setEnabled(enabled) {
    this.enabled=enabled;this.panel.hidden=!enabled;this.root.classList.toggle('has-assistance',enabled);
    this.button.setAttribute('aria-pressed',enabled);this.button.setAttribute('aria-expanded',enabled);
    this.measure();this.render();
  }
  reset() {
    this.snapshot={frame:0,parries:0,status:1};this.stoppedFrame=null;this.flashFrame=-100;this.previousParries=0;this.desynced=false;
    this.render();
  }
  observe(engine) {
    const frame=engine._web_value(2),parries=engine._web_value(5),status=engine._web_status();
    const failed=!!engine._web_value(54)||engine._web_value(40)===3||status===3;
    if(failed&&this.stoppedFrame===null)this.stoppedFrame=frame;
    if(parries>this.previousParries){
      this.flashFrame=frame;
      // Movement can alter contact timing. Stop the reference rather than show false future cues.
      if(this.contacts?.[parries-1]!==undefined&&frame-1!==this.contacts[parries-1]){
        this.desynced=true;if(this.stoppedFrame===null)this.stoppedFrame=frame;
      }
    }
    this.previousParries=parries;this.snapshot={frame,parries,status,failed,desynced:this.desynced};
  }
  measure() {
    if(!this.enabled)return;
    this.width=this.track.clientWidth;this.height=this.track.clientHeight;
    this.strikeY=this.height*.78;this.pixelsPerFrame=Math.max(1.8,this.strikeY/90);
    this.line.style.top=`${this.strikeY}px`;
  }
  render({paused=this.paused,controller=!this.keyboard}={}) {
    this.paused=paused;this.keyboard=!controller;
    if(!this.enabled||!this.loaded||!this.width)return;
    const state=this.snapshot,frame=this.stoppedFrame??state.frame;
    const renderKey=[frame,state.status,state.parries,!!state.failed,!!state.desynced,paused,controller,this.width,this.height,this.flashFrame].join(':');
    if(renderKey===this.lastRenderKey)return;this.lastRenderKey=renderKey;
    this.track.dataset.frame=frame;this.line.dataset.frame=frame;
    this.line.classList.toggle('confirmed',state.parries>0&&frame>=this.flashFrame&&frame-this.flashFrame<=8&&!state.failed&&!state.desynced);
    this.panel.classList.toggle('guide-paused',paused);this.panel.classList.toggle('guide-failed',!!state.failed);
    this.panel.classList.toggle('guide-complete',state.status===4);
    this.panel.classList.toggle('guide-desynced',!!state.desynced);
    this.cues.forEach((cue,i)=>{
      const y=this.strikeY-(cue.frame-frame)*this.pixelsPerFrame,node=this.nodes[i];
      const visible=y>=-24&&y<=this.height+24&&frame<=cue.end+14;
      node.hidden=!visible;if(!visible)return;
      const motion=cue.kind==='motion';
      const x=cue.lane==='kick'?0.86:cue.bits===2?0.18:cue.bits===6?0.36:cue.bits===1?0.36:0.56;
      node.style.transform=`translate3d(${x*this.width}px,${y}px,0) translate(-50%,-50%)`;
      node.style.setProperty('--hold-length',`${(cue.end-cue.frame)*this.pixelsPerFrame}px`);
      node.classList.toggle('due',cue.frame===frame);node.classList.toggle('past',frame>cue.frame);
      node.classList.toggle('confirmed',cue.ordinal>0&&cue.ordinal<=state.parries);
      node.classList.toggle('missed',!!state.failed&&cue.ordinal===state.parries+1);
      if(cue.key)node.querySelector('.guide-key').textContent=controller?'':cue.key;
      if(motion)node.title=cue.glyph+' — hold to the next direction';
    });
    const next=this.cues.find(cue=>cue.frame>=frame);
    this.title.textContent=paused?'Paused':state.status===4?'Challenge complete':state.failed?'Sequence missed':state.desynced?'Rhythm changed':state.status===1?'Ready':next?.name||'Finish the comeback';
    this.hint.textContent=state.failed?'Press R to retry':state.desynced?'Press R to realign the guide':paused?'Resume to continue':state.status===1?'Start the challenge to follow the cues':next?.hint||'Knock out Chun-Li';
    this.legend.textContent=controller?'LK / MK / HK · controller kicks':'LK = A · MK = S · HK = D';
  }
  get state() {return{enabled:this.enabled,loaded:this.loaded,...this.snapshot,displayFrame:this.stoppedFrame??this.snapshot.frame,paused:this.paused};}
}
