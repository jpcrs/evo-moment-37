/* Timestamped input delivery; the native challenge owns the ten-frame parry rule. */
const MomentTiming=Object.freeze({FPS:60000/1001,FRAME_MS:1001/60,EVO_REFERENCE_FPS:59.59949});

class MomentFrameClock {
  reset(now) {this.origin=now;this.last=now;this.frames=0;}
  pending(presentationTime,now=presentationTime) {
    const gap=now-this.last;this.last=now;
    // Never discard elapsed time or rush through a badly stalled challenge.
    if(gap>MomentTiming.FRAME_MS*4)return -1;
    // Use the display timestamp so variation in callback arrival cannot change frame deadlines.
    return Math.max(0,Math.floor((presentationTime-this.origin+1e-6)/MomentTiming.FRAME_MS)-this.frames);
  }
  next() {return this.origin+(++this.frames)*MomentTiming.FRAME_MS;}
}

class MomentButtonHistory {
  constructor() {this.reset();}
  reset(bits=0,now=0) {this.bits=this.latest=bits;this.events=[];this.head=0;this.last=this.sampled=now;}
  record(bits,at) {
    if(bits===this.latest)return;
    this.last=Math.max(at,this.last,this.sampled);this.latest=bits;
    this.events.push({at:this.last,bits});
  }
  sample(at) {
    let taps=0,pressed=0,directionPulse=0;
    while(this.head<this.events.length&&this.events[this.head].at<=at+1e-6){
      const bits=this.events[this.head++].bits,dir=bits&15;
      // Keep a fresh forward tap even if keyup arrives before the same tick.
      if(!(this.bits&15)&&(dir===4||dir===8))taps|=dir<<16;
      if(dir&&dir!==(this.bits&15))directionPulse=dir;
      pressed|=(bits&~this.bits)&~15;this.bits=bits;
    }
    this.sampled=at;
    if(this.head>=32){this.events=this.events.slice(this.head);this.head=0;}
    return this.bits|pressed|taps|(!(this.bits&15)?directionPulse:0);
  }
}

function momentInputTime(timestamp,now=performance.now()) {
  if(!Number.isFinite(timestamp)||timestamp<=0)return now;
  // Older browser/device timestamps may use Unix time rather than the page's clock.
  if(timestamp>performance.timeOrigin)timestamp-=performance.timeOrigin;
  return Math.min(now,Math.max(0,timestamp));
}

function momentCombineButtons(...inputs) {
  let bits=inputs.reduce((bits,input)=>bits|input,0);
  if((bits&12)===12)bits&=~(12|(12<<16));if((bits&3)===3)bits&=~3;
  return bits;
}
