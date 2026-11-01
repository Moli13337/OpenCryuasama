// Call synchronously after all reel layout writes in the same render frame.
// Only the container opacity is owned here: existing hidden/display/visibility
// rules and the rolling symbol strips retain their meaning.
export const REEL_TRANSITION_TIMING=Object.freeze({
  hidden:.18,fade:.22,enlargeHidden:1.5,enlargeFade:.25,
});

export function reelLayoutSize(key){
  const words=String(key??'normal').split(/[^a-z]+/i);
  if(words.includes('hidden'))return 'hidden';
  return words.includes('center')||words.includes('settle')?'large':'small';
}

export class ReelTransition{
  constructor(root,{reducedMotion=false,onEnlarge=()=>{}}={}){
    this.root=root;this.reducedMotion=reducedMotion;this.onEnlarge=onEnlarge;
    this.originalOpacity=root.style.getPropertyValue('opacity');
    this.originalPriority=root.style.getPropertyPriority('opacity');
    root.classList.add('reel-transition');
    // Inline suppression also covers the frame before the stylesheet arrives.
    root.style.setProperty('transition','none','important');
    root.style.setProperty('animation','none','important');
    root.dataset.reelTransitionReduced=String(reducedMotion);
    this.key=null;this.elapsed=0;this.active=false;this.enlarging=false;
    this.lastVisibleSize=null;this.pendingEnlarge=null;this.opacity=null;
  }

  update(layoutKey,dt,{paused=false}={}){
    const key=String(layoutKey??'normal:normal'),size=reelLayoutSize(key);
    if(this.key===null){
      this.key=key;this.lastVisibleSize=size==='hidden'?null:size;
      this.root.dataset.reelRenderedKey=key;
      return this.status(); // Initial render must not blink.
    }
    if(key!==this.key){
      const previousKey=this.key;
      this.enlarging=size==='large'&&(this.lastVisibleSize==='small'||reelLayoutSize(this.key)==='hidden');
      this.key=key;this.elapsed=0;this.active=true;
      this.hiddenDuration=this.enlarging?REEL_TRANSITION_TIMING.enlargeHidden:REEL_TRANSITION_TIMING.hidden;
      this.fadeDuration=this.enlarging?REEL_TRANSITION_TIMING.enlargeFade:REEL_TRANSITION_TIMING.fade;
      this.pendingEnlarge=this.enlarging?Object.freeze({key,previousKey,
        hiddenDuration:this.hiddenDuration,duration:this.hiddenDuration+this.fadeDuration}):null;
      if(size!=='hidden')this.lastVisibleSize=size;
      // Hide synchronously BEFORE notifying other presentation code. dt describes
      // the previous frame, so a newly selected layout never spends it here.
      this.writeOpacity(0);
      this.root.dataset.reelRenderedKey=key;
      this.root.dataset.reelTransition='hidden';
      if(!paused)this.notifyEnlarge();
      return this.status();
    }
    if(paused)return this.status();
    const startingDeferredEnlarge=Boolean(this.pendingEnlarge);
    this.notifyEnlarge();
    // A cut-in started on resume also gets the full invisible interval.
    if(startingDeferredEnlarge)return this.status();
    if(this.active){
      this.elapsed+=Number.isFinite(dt)&&dt>0?dt:0;
      const end=this.hiddenDuration+this.fadeDuration;
      if(this.elapsed+1e-9>=end){
        this.active=false;
        if(size==='hidden')this.writeOpacity(0);else this.releaseOpacity();
        this.root.dataset.reelTransition=size==='hidden'?'hidden':'ready';
      }else if(this.elapsed<=this.hiddenDuration){
        this.writeOpacity(0);this.root.dataset.reelTransition='hidden';
      }else{
        this.writeOpacity(size==='hidden'?0:(this.elapsed-this.hiddenDuration)/this.fadeDuration);
        this.root.dataset.reelTransition=size==='hidden'?'hidden':'fade';
      }
    }
    return this.status();
  }

  notifyEnlarge(){
    const event=this.pendingEnlarge;
    this.pendingEnlarge=null;
    if(event)this.onEnlarge(event);
  }

  writeOpacity(value){
    const next=Number(value.toFixed(5));
    if(this.opacity===next)return;
    this.opacity=next;
    // Focus layouts have opacity:1!important; inline important masks them too.
    this.root.style.setProperty('opacity',String(next),'important');
  }

  releaseOpacity(){
    if(this.opacity===null)return;
    if(this.originalOpacity)this.root.style.setProperty('opacity',this.originalOpacity,this.originalPriority);
    else this.root.style.removeProperty('opacity');
    this.opacity=null;
  }

  status(){
    return {active:this.active,phase:this.root.dataset.reelTransition??'ready',
      opacity:this.opacity,key:this.key,enlarging:this.enlarging,elapsed:this.elapsed};
  }

  reset(){
    this.releaseOpacity();this.key=null;this.elapsed=0;this.active=false;
    this.enlarging=false;this.pendingEnlarge=null;this.lastVisibleSize=null;
    delete this.root.dataset.reelRenderedKey;delete this.root.dataset.reelTransition;
  }
}
