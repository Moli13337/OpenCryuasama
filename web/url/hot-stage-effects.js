const COLORS=Object.freeze({green:'#86ffb4',purple:'#cc83ff',red:'#ff637d'});
const clamp=x=>Math.max(0,Math.min(1,x));

// No media, text, timers or independent animations. The caller owns the clock.
export class HotStageEffects{
  constructor(parent,{reducedMotion=false}={}){
    this.reducedMotion=reducedMotion;this.active=false;this.lastWhiteFrame=false;this.resetDone=false;this.edgeLit=false;
    const doc=parent.ownerDocument;
    this.lowLoad=doc.documentElement?.dataset.qualityPreset==='light';
    this.root=doc.createElement('div');this.root.className='hot-stage-effects';
    this.root.setAttribute('aria-hidden','true');this.root.hidden=true;
    this.root.dataset.reduced=String(reducedMotion);
    const make=className=>{const node=doc.createElement('i');node.className=className;this.root.append(node);return node;};
    this.lines=make('hot-stage-effects__lines');
    this.waves=[make('hot-stage-effects__wave'),make('hot-stage-effects__wave')];
    this.edge=make('hot-stage-effects__edge');parent.append(this.root);
  }

  update({active=false,color='purple',energy=.6,time=0,whiteFrame=false,paused=false}={}){
    if(!active){this.reset();return false;}
    // An edge flash lasts at most one rendered frame, including pause entry.
    if(this.edgeLit){this.edge.style.opacity='0';this.edgeLit=false;}
    if(paused)return this.active;
    this.active=true;this.resetDone=false;this.root.hidden=false;
    const strength=Number.isFinite(energy)?clamp(energy):0;
    const t=Number.isFinite(time)?Math.max(0,time):0;
    this.root.style.color=COLORS[color]||COLORS.purple;
    this.root.style.opacity=String(this.reducedMotion?.12+strength*.08:.15+strength*.15);
    if(!this.lowLoad)this.lines.style.transform=this.reducedMotion?'none':`rotate(${(Math.sin(t*.65)*2).toFixed(3)}deg) scale(${(1.03+Math.sin(t*1.5)*.025).toFixed(4)})`;
    if(!this.lowLoad)this.waves.forEach((wave,index)=>{
      wave.hidden=this.reducedMotion;
      const progress=(t*.45+index*.5)%1;
      wave.style.transform=`translate(-50%,-50%) scale(${(.25+progress*1.35).toFixed(4)})`;
      wave.style.opacity=this.reducedMotion?'0':((1-progress)*.65).toFixed(4);
    });
    if(whiteFrame&&!this.lastWhiteFrame&&!this.reducedMotion){this.edge.style.opacity='.85';this.edgeLit=true;}
    this.lastWhiteFrame=Boolean(whiteFrame);
    return true;
  }

  reset(){
    if(this.resetDone)return;
    this.root.hidden=true;this.active=false;this.lastWhiteFrame=false;
    this.edge.style.opacity='0';this.edgeLit=false;this.resetDone=true;
  }
}
