/* Browser mixing only. The engine still produces its own sound and super activation. */
class MomentAudio {
  constructor({volume,volumeValue,evoToggle}) {
    this.volume=volume;this.volumeValue=volumeValue;this.evoToggle=evoToggle;
    this.context=null;this.gameGain=null;this.evoGain=null;this.buffer=null;this.loading=null;
    this.enabled=evoToggle.checked;this.source=null;this.offset=0;this.anchor=0;this.clockStart=null;
    this.status=this.enabled?'ready':'off';this.starts=0;this.lastDrift=0;this.complete=false;this.suspended=false;
    volume.addEventListener('input',()=>this.setVolume(volume.value));
    this.setVolume(volume.value);
  }
  init(engine) {
    this.context=engine.SDL3.audioContext;
    const output=engine.SDL3.audio_playback.scriptProcessorNode;
    this.gameGain=this.context.createGain();this.evoGain=this.context.createGain();
    output.disconnect();output.connect(this.gameGain);this.gameGain.connect(this.context.destination);
    this.evoGain.connect(this.context.destination);
    this.setVolume(this.volume.value);
  }
  setVolume(value) {
    const percent=Math.max(0,Math.min(100,Number(value)));
    this.volumeValue.value=`${percent}%`;
    this.volume.setAttribute('aria-valuetext',`${percent} percent`);
    if(this.gameGain){if(this.context.state==='running')this.gameGain.gain.setTargetAtTime(percent/100,this.context.currentTime,.01);else this.gameGain.gain.value=percent/100;}
  }
  async load() {
    if(this.buffer)return this.buffer;
    if(this.loading)return this.loading;
    this.status='loading';this.evoToggle.setAttribute('aria-busy','true');
    this.loading=(async()=>{
      const response=await fetch('audio/evo-moment37.wav');
      if(!response.ok)throw new Error('The Evo audio track could not be loaded.');
      const bytes=await response.arrayBuffer();
      this.buffer=await this.context.decodeAudioData(bytes);
      this.status='ready';return this.buffer;
    })().catch(error=>{this.status='error';this.enabled=false;this.evoToggle.checked=false;throw error;})
      .finally(()=>{this.loading=null;this.evoToggle.removeAttribute('aria-busy');});
    return this.loading;
  }
  async enable(value) {
    this.enabled=value;
    if(!value){this.stop();this.status='off';return;}
    await this.context.resume();await this.load();
  }
  async arm() {
    if(this.context.state==='suspended')await this.context.resume();
    if(this.enabled)await this.load();
  }
  reset() {
    this.stop();this.clockStart=null;this.offset=0;this.complete=false;this.suspended=false;
    this.status=this.enabled?'ready':'off';
  }
  stop() {
    if(this.source){const source=this.source;this.source=null;source.onended=null;try{source.stop();}catch{}source.disconnect();}
  }
  position() {
    return this.source?this.offset+(this.context.currentTime-this.anchor):this.offset;
  }
  play(offset) {
    if(!this.buffer||offset>=this.buffer.duration){this.complete=true;this.stop();return;}
    this.stop();this.offset=Math.max(0,offset);this.anchor=this.context.currentTime;
    const source=this.context.createBufferSource();source.buffer=this.buffer;source.connect(this.evoGain);
    this.source=source;this.starts++;this.status='playing';
    source.onended=()=>{if(this.source===source){this.source=null;source.disconnect();this.complete=true;this.status='ended';}};
    source.start(this.anchor,this.offset);
  }
  pause(engine) {
    this.suspended=true;
    if(this.source){this.offset=this.clockStart===null?this.position():this.target(engine);this.stop();this.status='paused';}
  }
  resume(engine) {
    this.suspended=false;
    if(this.enabled&&this.clockStart!==null&&!this.complete)this.play(this.target(engine));
  }
  target(engine) {return Math.max(0,(engine._web_value(53)-this.clockStart-1)/59.59949);}
  frame(engine) {
    if(!this.enabled||!this.buffer||this.suspended||this.complete)return;
    const activation=engine._web_value(52);
    if(activation<0)return;
    if(this.clockStart===null){this.clockStart=activation;this.play(this.target(engine));return;}
    if(engine._web_status()===3){this.stop();this.complete=true;this.status='stopped';return;}
    if(engine._web_status()===4)return; // Let the recorded reaction finish after a successful attempt.
    if(!this.source){this.play(this.target(engine));return;}
    this.lastDrift=this.target(engine)-this.position();
    // Correct a browser stall without delaying the game or changing its frame calculations.
    if(Math.abs(this.lastDrift)>2/59.59949)this.play(this.target(engine));
  }
  get state() {return {enabled:this.enabled,status:this.status,ready:!!this.buffer,activationFrame:this.clockStart,starts:this.starts,offset:this.offset,position:this.context?this.position():0,lastDrift:this.lastDrift,gameVolume:this.gameGain?.gain.value??1};}
}
