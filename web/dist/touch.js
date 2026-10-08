/* Touch buttons only supply timestamped pad inputs; combat stays in the engine. */
class MomentTouchControls {
  constructor({root,controls,pad,rotate,history,onBlocked}) {
    Object.assign(this,{root,controls,pad,rotate,history,onBlocked});
    this.pointers=new Map();this.interactive=false;
    this.device=matchMedia('(hover: none) and (pointer: coarse)');
    this.landscape=matchMedia('(orientation: landscape)');
    this.buttons=[...controls.querySelectorAll('[data-touch-input]')];
    this.device.addEventListener('change',()=>this.layout());
    this.landscape.addEventListener('change',()=>this.layout());
    window.addEventListener('resize',()=>this.layout());
    window.visualViewport?.addEventListener('resize',()=>this.layout());
    controls.addEventListener('pointerdown',event=>this.down(event));
    controls.addEventListener('pointermove',event=>this.move(event));
    for(const type of ['pointerup','pointercancel','lostpointercapture'])controls.addEventListener(type,event=>this.up(event));
    controls.addEventListener('contextmenu',event=>event.preventDefault());
    this.layout();
  }
  layout() {
    const wasBlocked=this.blocked,wasMobile=this.mobile;
    const phone=/Android|iPhone|iPad|iPod/.test(navigator.userAgent);
    const tablet=navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
    this.mobile=phone||tablet||(this.device.matches&&(navigator.maxTouchPoints>0||'ontouchstart' in window));
    // Use the actual viewport: some mobile WebKit resize paths leave the
    // orientation media query and viewport units at their previous values.
    const viewport=window.visualViewport,scaled=viewport&&Math.abs(viewport.scale-1)>.001;
    const width=Math.round(scaled?viewport.width*viewport.scale:innerWidth),height=Math.round(scaled?viewport.height*viewport.scale:innerHeight);
    this.width=width;this.height=height;
    this.blocked=this.mobile&&width<=height;
    if(wasBlocked!==this.blocked||wasMobile!==this.mobile)this.release();
    const html=document.documentElement;
    html.classList.toggle('touch-mode',this.mobile);html.classList.toggle('mobile-portrait',this.blocked);
    html.style.setProperty('--mobile-width',width+'px');html.style.setProperty('--mobile-height',height+'px');
    this.rotate.hidden=!this.blocked;
    for(const node of this.root.querySelectorAll(':scope > .game-top, :scope > .play-area, :scope > .game-bottom'))node.inert=this.blocked;
    this.show();if(this.blocked&&!wasBlocked)this.onBlocked();
  }
  refresh() {
    // Also catch viewport changes that arrive without a resize event.
    if(this.width!==innerWidth||this.height!==innerHeight)this.layout();
  }
  setInteractive(interactive) {
    if(!interactive)this.release();
    this.interactive=interactive;this.show();
  }
  show() {this.controls.hidden=!this.mobile||this.blocked||!this.interactive;}
  down(event) {
    const button=event.target.closest('[data-touch-input]');
    if(!button||event.pointerType==='mouse'||this.controls.hidden)return;
    event.preventDefault();
    this.pointers.set(event.pointerId,{direction:button.hasAttribute('data-direction'),bits:Number(button.dataset.touchInput)});
    this.controls.setPointerCapture(event.pointerId);this.record(event.timeStamp);
  }
  move(event) {
    const pointer=this.pointers.get(event.pointerId);if(!pointer?.direction)return;
    event.preventDefault();
    const button=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-direction]');
    const bits=button&&this.pad.contains(button)?Number(button.dataset.touchInput):0;
    if(bits!==pointer.bits){pointer.bits=bits;this.record(event.timeStamp);}
  }
  up(event) {
    if(!this.pointers.delete(event.pointerId))return;
    event.preventDefault();this.record(event.timeStamp);
  }
  record(timestamp=performance.now()) {
    const bits=momentCombineButtons(...[...this.pointers.values()].map(pointer=>pointer.bits));
    this.history.record(bits,momentInputTime(timestamp));
    for(const button of this.buttons){const mask=Number(button.dataset.touchInput);button.setAttribute('aria-pressed',(bits&mask)===mask);}
  }
  release() {
    const ids=[...this.pointers.keys()];this.pointers.clear();
    if(ids.length)this.record();
    for(const id of ids)if(this.controls.hasPointerCapture(id))this.controls.releasePointerCapture(id);
  }
}
