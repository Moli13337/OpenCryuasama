export function judgmentConfirmation({phase,hold,elapsed=0}){
  return phase==='reach'&&hold?.reachType==='judgment'&&hold.win===true&&elapsed>=9.4&&elapsed<12;
}
export const JUDGMENT_BREAK_TIMING=Object.freeze({breakAt:1.1,endAt:2.3});
const clamp=value=>Math.max(0,Math.min(1,value));
const PIECES=Object.freeze([
  ['0% 0%,45% 0%,39% 38%,0% 48%',-.65,-.75,-31],
  ['45% 0%,75% 0%,70% 45%,39% 38%',.05,-.95,23],
  ['75% 0%,100% 0%,100% 45%,70% 45%',.7,-.7,42],
  ['0% 48%,39% 38%,47% 70%,0% 75%',-.9,-.03,-47],
  ['39% 38%,70% 45%,66% 72%,47% 70%',.12,-.26,61],
  ['70% 45%,100% 45%,100% 80%,66% 72%',.9,.12,38],
  ['0% 75%,47% 70%,55% 100%,0% 100%',-.6,.68,-29],
  ['47% 70%,66% 72%,100% 80%,100% 100%,55% 100%',.62,.74,37],
]);
const CANVAS_PIECES=PIECES.map(([polygon,x,y,rotation])=>({
  points:polygon.split(',').map(point=>point.split(' ').map(value=>parseFloat(value)/100)),x,y,rotation,
}));
export class JudgmentConfirmation{
  constructor(root,{reducedMotion=false,onBeat=()=>{}}={}){
    this.root=root;this.reducedMotion=reducedMotion;this.onBeat=onBeat;this.image=root.querySelector('img');
    this.portal=null;this.pieces=[];this.hold=null;this.consumed=false;this.shown=false;this.paused=false;this.blocked=false;
    this.portalElapsed=0;this.lastReal=null;this.broken=false;root.hidden=true;
  }
  cleanup(){
    if(!this.portal&&!this.canvas&&this.root.hidden&&this.root.dataset.breaking==='false'&&!this.shown)return;
    // Release the bounded mobile backing store on every exit, including reset.
    if(this.canvas){this.canvas.width=1;this.canvas.height=1;}
    this.canvas=null;this.context=null;this.canvasView=null;this.halo=null;
    this.portal?.remove();this.portal=null;this.stage=null;this.whole=null;this.pieces=[];
    this.root.hidden=true;this.root.dataset.breaking='false';this.shown=false;
  }
  reset(){this.cleanup();this.hold=null;this.consumed=false;this.portalElapsed=0;this.lastReal=null;this.broken=false;this.paused=false;this.blocked=false;}
  push({phase,hold,elapsed,realElapsed=elapsed,paused=this.paused,blocked=this.blocked}){
    if(paused||blocked||!judgmentConfirmation({phase,hold,elapsed})||!Number.isFinite(realElapsed))return false;
    if(this.hold!==hold){this.cleanup();this.hold=hold;this.consumed=false;}
    if(this.consumed)return false;
    const doc=this.root.ownerDocument,lcd=this.root.closest?.('.lcd')??this.root;
    const rect=lcd.getBoundingClientRect?.(),src=this.image?.currentSrc||this.image?.src;
    if(!doc?.body||!src||!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)return false;
    const portal=doc.createElement('div');portal.className='judgment-break';portal.setAttribute('aria-hidden','true');
    portal.dataset.reduced=String(this.reducedMotion);
    const view=doc.defaultView;
    const mobile=doc.documentElement?.dataset.renderQuality==='mobile';
    if(mobile){
      // One viewport-sized surface replaces nine enlarged, filtered image layers.
      // Do not consume PUSH if the image or a canvas context is unavailable.
      if(!this.image.naturalWidth||!this.image.naturalHeight)return false;
      const width=Math.max(1,view?.innerWidth||rect.width),height=Math.max(1,view?.innerHeight||rect.height);
      const light=doc.documentElement?.dataset.qualityPreset==='light';
      const maxSide=light?768:1280,maxPixels=light?262144:786432;
      const density=Math.min(view?.devicePixelRatio||1,light?1:1.25,maxSide/width,maxSide/height,Math.sqrt(maxPixels/(width*height)));
      // Reuse one canvas/context across confirmed PUSH scenes. cleanup shrinks
      // its backing store to one pixel while it is detached and not in use.
      let canvas=light?this.reusableCanvas:null;
      let context=canvas?.getContext('2d',{alpha:true});
      if(context?.isContextLost?.()){canvas=null;context=null;this.reusableCanvas=null;}
      if(!canvas){canvas=doc.createElement('canvas');context=canvas.getContext('2d',{alpha:true});}
      if(!context)return false;
      if(light)this.reusableCanvas=canvas;
      canvas.className='judgment-break__canvas';canvas.width=Math.max(1,Math.floor(width*density));canvas.height=Math.max(1,Math.floor(height*density));
      Object.assign(portal.style,{left:'0px',top:'0px',width:`${width}px`,height:`${height}px`});
      portal.dataset.renderer='canvas';portal.append(canvas);
      this.canvas=canvas;this.context=context;
      this.canvasView={width,height,density,rect,light,maxScale:Math.max(1,Math.min(2,width*.96/rect.width,height*.7/rect.height))};
    }else{
    Object.assign(portal.style,{left:`${rect.x}px`,top:`${rect.y}px`,width:`${rect.width}px`,height:`${rect.height}px`});
    const stage=doc.createElement('div');stage.className='judgment-break__stage';portal.append(stage);
    const clone=()=>{const image=doc.createElement('img');image.src=src;image.alt='';image.draggable=false;image.className='judgment-break__image';return image;};
    const whole=clone();whole.className+=' judgment-break__whole';stage.append(whole);
    this.pieces=this.reducedMotion?[]:PIECES.map(([polygon,x,y,rotation])=>{
      const image=clone();image.className+=' judgment-break__piece';image.style.clipPath=`polygon(${polygon})`;image.hidden=true;stage.append(image);
      return {image,x,y,rotation};
    });
    this.stage=stage;this.whole=whole;
    }
    this.motion={width:rect.width,height:rect.height,dx:((view?.innerWidth??rect.x*2+rect.width)/2-rect.x-rect.width/2)*.65,dy:((view?.innerHeight??rect.y*2+rect.height)/2-rect.y-rect.height/2)*.65};
    this.portal=portal;this.portalElapsed=0;this.lastReal=realElapsed;this.broken=false;this.consumed=true;
    this.root.hidden=true;this.root.dataset.breaking='true';this.shown=true;doc.body.append(portal);this.paintPortal();return true;
  }
  paintPortal(){
    if(!this.portal)return;
    const time=this.portalElapsed,{breakAt,endAt}=JUDGMENT_BREAK_TIMING,approach=clamp(time/breakAt),age=Math.max(0,time-breakAt);
    this.portal.dataset.step=time<breakAt?'approach':'broken';
    if(this.canvas){this.paintCanvas(time,approach,age);return;}
    if(this.reducedMotion){
      this.stage.style.transform='scale(1.04)';this.whole.style.opacity=String(time<breakAt?1:clamp((endAt-time)/(endAt-breakAt)));
      this.portal.style.setProperty('--judgment-glow',String(.15+.15*Math.sin(clamp(time/endAt)*Math.PI)));
      return;
    }
    const p=approach*approach,jitter=time<breakAt?Math.sin(time*83)*(1+approach*3.4):0;
    const dx=this.motion.dx*p+jitter,dy=this.motion.dy*p+Math.cos(time*71)*jitter*.65;
    this.stage.style.transform=`translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) scale(${(1+p*1.8).toFixed(4)}) rotate(${(jitter*.35).toFixed(2)}deg)`;
    this.whole.hidden=time>=breakAt;
    const fly=1-Math.pow(1-clamp(age/(endAt-breakAt)),2),opacity=clamp((endAt-time)/.65);
    for(const piece of this.pieces){
      piece.image.hidden=time<breakAt;
      piece.image.style.opacity=String(opacity);
      piece.image.style.transform=`translate(${(piece.x*this.motion.width*fly).toFixed(2)}px,${(piece.y*this.motion.height*fly+age*age*80).toFixed(2)}px) rotate(${(piece.rotation*fly).toFixed(2)}deg)`;
    }
  }
  paintCanvas(time,approach,age){
    const ctx=this.context,{width,height,density,rect,maxScale}=this.canvasView,{breakAt,endAt}=JUDGMENT_BREAK_TIMING;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    ctx.setTransform(density,0,0,density,0,0);
    const p=approach*approach,jitter=this.reducedMotion?0:time<breakAt?Math.sin(time*83)*(1+approach*3.4):0;
    const scale=this.reducedMotion?1.04:1+p*(maxScale-1);
    const x=rect.x+rect.width/2+(this.reducedMotion?0:this.motion.dx*p+jitter);
    const y=rect.y+rect.height/2+(this.reducedMotion?0:this.motion.dy*p+Math.cos(time*71)*jitter*.65);
    // The halo is a bounded gradient in the same canvas, not an image blur.
    if(this.canvasView.light){
      // Keep one gradient per PUSH. Moving the drawing coordinate system keeps
      // the halo centered on the approaching title without rebuilding it.
      if(!this.halo){
        this.halo=ctx.createRadialGradient(0,0,0,0,0,Math.min(width,height)*.62);
        this.halo.addColorStop(0,'rgba(255,141,214,.2)');this.halo.addColorStop(1,'rgba(255,141,214,0)');
      }
      ctx.save();ctx.translate(x,y);ctx.fillStyle=this.halo;
      ctx.fillRect(-x,-y,width,height);ctx.restore();
    }else{
      const glow=ctx.createRadialGradient(x,y,0,x,y,Math.min(width,height)*.62);
      glow.addColorStop(0,'rgba(255,141,214,.2)');glow.addColorStop(1,'rgba(255,141,214,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    }
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.rotate(jitter*.35*Math.PI/180);
    const image=this.image,fit=Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight);
    const iw=image.naturalWidth*fit,ih=image.naturalHeight*fit;
    const draw=()=>ctx.drawImage(image,-iw/2,-ih/2,iw,ih);
    if(this.reducedMotion||time<breakAt){
      ctx.globalAlpha=this.reducedMotion&&time>=breakAt?clamp((endAt-time)/(endAt-breakAt)):1;draw();
    }else{
      const fly=1-Math.pow(1-clamp(age/(endAt-breakAt)),2),opacity=clamp((endAt-time)/.65);
      for(const piece of CANVAS_PIECES){
        ctx.save();ctx.globalAlpha=opacity;
        ctx.translate(piece.x*rect.width*fly,piece.y*rect.height*fly+age*age*80);ctx.rotate(piece.rotation*fly*Math.PI/180);
        ctx.beginPath();piece.points.forEach(([px,py],index)=>ctx[index?'lineTo':'moveTo']((px-.5)*rect.width,(py-.5)*rect.height));ctx.closePath();ctx.clip();draw();ctx.restore();
      }
    }
    ctx.restore();ctx.globalAlpha=1;
  }
  update({phase,hold,elapsed,realElapsed=elapsed,paused=false,blocked=false}){
    this.paused=paused;this.blocked=blocked;
    if(this.hold!==hold){this.cleanup();this.hold=hold;this.consumed=false;}
    // Phase and ownership cleanup run even while the presentation clock is paused.
    if(blocked||!judgmentConfirmation({phase,hold,elapsed})){this.cleanup();return false;}
    if(paused){if(Number.isFinite(realElapsed))this.lastReal=realElapsed;return this.shown;}
    if(this.portal){
      if(Number.isFinite(realElapsed)){
        this.portalElapsed+=Math.max(0,realElapsed-(this.lastReal??realElapsed));this.lastReal=realElapsed;
      }
      if(this.portalElapsed+1e-8>=JUDGMENT_BREAK_TIMING.endAt){this.cleanup();return false;}
      if(Math.abs(this.portalElapsed-JUDGMENT_BREAK_TIMING.breakAt)<1e-8)this.portalElapsed=JUDGMENT_BREAK_TIMING.breakAt;
      if(!this.broken&&this.portalElapsed>=JUDGMENT_BREAK_TIMING.breakAt){
        this.broken=true;this.onBeat({id:'break',at:JUDGMENT_BREAK_TIMING.breakAt,realElapsed,lateness:this.portalElapsed-JUDGMENT_BREAK_TIMING.breakAt,reducedMotion:this.reducedMotion});
      }
      this.paintPortal();this.shown=true;return true;
    }
    if(this.consumed){this.root.hidden=true;this.shown=false;return false;}
    this.shown=true;this.root.hidden=false;
    if(this.shown){
      const age=elapsed-9.4,burst=Math.exp(-age*8),fade=Math.min(1,age/.06,(12-elapsed)/.25);
      this.root.style.opacity=String(Math.max(0,fade));
      this.image.style.transform=this.reducedMotion?'none':`scale(${1+burst*.55}) rotate(${-2+Math.sin(age*5)*.5}deg)`;
    }
    return this.shown;
  }
}
