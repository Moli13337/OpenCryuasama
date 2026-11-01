const clamp=x=>Math.max(0,Math.min(1,x));
// Outcome already stopped in the engine. Only the farewell of its scenery runs here.
export function missPresentationState(elapsed,duration=8.8,{immediateShatter=false}={}){
  const t=Math.max(0,elapsed)*8.8/duration;
  const breakAt=immediateShatter?0:3.8;
  const endAt=breakAt+2.55;
  const shatter=clamp((t-breakAt)/2.55);
  return {stage:t<breakAt?'result':t<endAt?'shatter':'normal',scenery:t<endAt,
    opacity:1-shatter,shatter,done:t>=8.8,breakAt:duration*breakAt/8.8};
}
export class MissPresentation{
  constructor(screen,{reducedMotion=false,onBreak=()=>{}}={}){
    this.screen=screen;this.reducedMotion=reducedMotion;this.onBreak=onBreak;
    const doc=screen.ownerDocument;
    this.overlay=doc.createElement('div');this.overlay.className='miss-glass';this.overlay.hidden=true;
    this.overlay.setAttribute('aria-hidden','true');
    const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
    const paths=['M48 44L34 31 23 28 17 13 0 0','M48 44L51 24 44 17 49 0','M48 44L68 32 73 15 94 0','M48 44L74 42 82 32 100 30','M48 44L62 57 82 59 100 73','M48 44L52 73 68 88 70 100','M48 44L35 68 36 84 22 100','M48 44L24 50 17 62 0 68','M48 44L22 35 9 36 0 26','M34 31L31 15 22 0','M62 57L73 72 91 79','M35 68L17 81 0 86','M51 24L65 18 67 0'];
    for(const d of paths){const p=doc.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',d);svg.append(p);}
    this.overlay.append(svg);
    for(let i=0;i<10;i++){const shard=doc.createElement('i');shard.style.setProperty('--shard',String(i));shard.style.setProperty('--angle',`${i*36}deg`);this.overlay.append(shard);}
    this.impact=doc.createElement('b');this.impact.className='miss-glass__impact';this.impact.hidden=true;this.overlay.append(this.impact);
    screen.append(this.overlay);this.reset();
  }
  start(snapshot){
    this.reset();this.snapshot=snapshot;this.active=true;
    const breakAt=snapshot.immediateShatter?0:snapshot.duration*3.8/8.8;
    this.broken=Boolean(snapshot.restored)||(snapshot.initialElapsed||0)>=breakAt+(snapshot.immediateShatter?.2:0);
    this.impact.textContent=snapshot.impactText||'';
  }
  update(elapsed,{paused=false}={}){
    if(!this.active)return null;
    const state=missPresentationState(elapsed,this.snapshot.duration,{immediateShatter:this.snapshot.immediateShatter});
    if(this.snapshot.shatter===false&&state.stage==='shatter')state.stage='fade';
    this.state=state;this.screen.dataset.missResult=state.stage;
    this.screen.style.setProperty('--miss-scenery-opacity',String(state.opacity));
    this.overlay.hidden=this.snapshot.shatter===false||state.stage!=='shatter';
    this.impact.hidden=this.overlay.hidden||!this.snapshot.impactText||elapsed>=.9;
    this.overlay.dataset.reduced=String(this.reducedMotion);
    this.overlay.style.setProperty('--break-progress',String(state.shatter));
    if(elapsed>=state.breakAt&&!this.broken){this.broken=true;if(this.snapshot.shatter!==false&&!paused&&elapsed-state.breakAt<.2)this.onBreak();}
    return state;
  }
  reset(){this.active=false;this.cleared=false;this.snapshot=null;this.state=null;this.broken=false;this.overlay.hidden=true;this.impact.hidden=true;delete this.screen.dataset.missResult;this.screen.style.removeProperty('--miss-scenery-opacity');}
}
