/* Host timing only: the original engine still owns every command and parry window. */
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
    while(this.head<this.events.length&&this.events[this.head].at<=at+1e-6)this.bits=this.events[this.head++].bits;
    this.sampled=at;
    if(this.head>=32){this.events=this.events.slice(this.head);this.head=0;}
    return this.bits;
  }
}

function momentInputTime(timestamp,now=performance.now()) {
  if(!Number.isFinite(timestamp)||timestamp<=0)return now;
  // Older browser/device timestamps may use Unix time rather than the page's clock.
  if(timestamp>performance.timeOrigin)timestamp-=performance.timeOrigin;
  return Math.min(now,Math.max(0,timestamp));
}

function momentCombineButtons(keyboard,pad) {
  let bits=keyboard|pad;
  if((bits&12)===12)bits&=~12;if((bits&3)===3)bits&=~3;
  return bits;
}
