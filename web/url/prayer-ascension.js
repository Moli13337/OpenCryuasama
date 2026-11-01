import {selectAsset} from './asset-variants-v47.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const style=(node,key,value)=>{if(node.style[key]!==value)node.style[key]=value;};
const property=(node,key,value)=>{if(node.style.getPropertyValue?.(key)!==value)node.style.setProperty(key,value);};
const clearImage=node=>{if(node.removeAttribute)node.removeAttribute('src');else delete node.src;};
export const ASCENSION_START=21;
export const ASCENSION_TIMING=Object.freeze({start:21,descentEnd:26,faithStart:29,fadeStart:34,reelsReturn:35.25,drawStart:37,end:45});
export const ASCENSION_BEATS=Object.freeze([
  {at:21,id:'heaven',sound:'magic-circle'},
  {at:21.2,id:'descent',sound:'prayer-sparkle'},
  {at:26,id:'arrival',sound:'aura'},
  {at:29,id:'faith',sound:'sword-heavy'},
  {at:29.6,id:'seal',sound:'thunder'},
  {at:35.25,id:'return',sound:'text-arrival'},
].map(beat=>Object.freeze(beat)));

// One reach clock owns the descent, text fade and both figure layouts. The
// final eight seconds only present the hold already drawn by the engine.
export function ascensionState(elapsed,{reducedMotion=false,pushedAt=null}={}){
  const time=Number.isFinite(elapsed)?Math.max(0,elapsed):0,t=time;
  const descent=smooth((t-21)/5),title=smooth((t-29)/.65);
  const pushAge=pushedAt===null?-1:time-pushedAt;
  const hit=pushAge<0?0:1-smooth(pushAge/.95);
  const titleOpacity=1-smooth((t-34)/1.25);
  const impact=t>=29?(1-clamp((t-29)/1.2)):0;
  const tremble=t>=29&&t<35.25?(.5+impact*2)*titleOpacity:0;
  return {active:t>=21,stage:t<21?'prayer':t<26?'descent':t<29?'presence':t<34?'faith':t<35.25?'fade':t<37?'reels-return':'draw',
    time,entry:smooth((t-21)/.5),descent,
    reelFocus:t>=21&&t<35.25?'corner':'center',
    y:reducedMotion?-8:-110+descent*102+(t>26?Math.sin((t-26)*1.8)*1.2:0)+Math.sin(t*79)*tremble*.45,
    x:reducedMotion?0:Math.sin(t*91)*tremble,
    scale:reducedMotion?.67:.47+descent*.2+title*.4+hit*.025,
    heroOpacity:smooth((t-21)/.5)*(1-smooth((t-35.25)/1.75)*.35),
    tilt:reducedMotion?0:Math.sin(t*.85)*.8+Math.cos(t*61)*tremble*.4,
    titleVisible:t>=29&&t<35.25,titleOpacity,titleScale:reducedMotion?1:.32+title*.68+Math.sin(title*Math.PI)*.16+hit*.36,
    titleX:reducedMotion?0:Math.sin(t*91)*tremble+Math.sin(pushAge*95)*hit*5.5,
    titleY:reducedMotion?0:Math.sin(pushAge*79)*hit*3,
    titleTilt:reducedMotion?0:Math.cos(t*61)*tremble*.6+Math.sin(pushAge*87)*hit*4,
    energy:.3+descent*.35+smooth((t-27)/2)*.35,
    red:smooth((t-28)/1),push:hit};
}

export function ascensionFlash(elapsed,reducedMotion=false){
  const none={color:'#ffd87b',opacity:0,shake:0,active:false,beatId:null,age:null};
  if(reducedMotion||!Number.isFinite(elapsed))return none;
  const beat=ASCENSION_BEATS.find(b=>['heaven','arrival','charge','faith','seal'].includes(b.id)&&elapsed>=b.at&&elapsed<b.at+.32);
  if(!beat)return none;
  const age=elapsed-beat.at,envelope=1-smooth(age/.32),red=elapsed>=29;
  return {color:red?'#ff3c57':'#ffeab0',opacity:(red?.42:.3)*envelope,shake:(red?10:5)*envelope,active:true,beatId:`ascension:${beat.id}`,age};
}

export class PrayerAscension{
  constructor(parent,{reducedMotion=false,onBeat=()=>{}}={}){
    this.reducedMotion=reducedMotion;this.onBeat=onBeat;
    const doc=parent.ownerDocument;this.lowLoad=doc.documentElement?.dataset.qualityPreset==='light';
    this.root=doc.createElement('div');this.root.className='prayer-ascension';this.root.hidden=true;
    this.root.setAttribute('aria-label','お祈り強発展・ゆあ様降臨');
    const make=(tag,cls)=>{const n=doc.createElement(tag);n.className=cls;this.root.append(n);return n;};
    this.background=make('img','prayer-ascension__sky');this.background.alt='';
    this.rays=make('i','prayer-ascension__rays');
    this.rings=[make('i','prayer-ascension__ring'),make('i','prayer-ascension__ring')];
    this.hero=make('img','prayer-ascension__yua');this.hero.alt='翼と布をまとい降臨するゆあ様';
    this.particles=Array.from({length:30},(_,i)=>{const n=make('i',`prayer-ascension__particle ${i<10?'is-feather':''}`);n.style.left=`${(i*37)%100}%`;n.style.top='0';return n;});
    this.veil=make('i','prayer-ascension__red');
    this.title=make('img','prayer-ascension__title');this.title.alt='信仰せよ';this.title.hidden=true;
    this.art=[[this.background,'golden-heaven-v01.webp'],[this.hero,'yua-divine-pixel-v01.webp'],[this.title,'faith-command-red-v01.webp']];
    for(const [image] of this.art)image.decoding='async';
    this.motionHeight=0;
    if(typeof ResizeObserver==='function')new ResizeObserver(entries=>{if(entries[0].contentRect.height)this.motionHeight=entries[0].contentRect.height;}).observe(parent);
    this.parent=parent;
    parent.append(this.root);this.reset();
  }
  prepare(){if(this.prepared)return;this.prepared=true;for(const [image,file] of this.art)image.src=selectAsset(`assets/reaches/prayer-ascension-v01/${file}`,this.parent.ownerDocument);}
  start(elapsed=0){this.reset();this.seen=new Set(ASCENSION_BEATS.filter(b=>b.at+.2<elapsed).map(b=>b.id));if(elapsed>=ASCENSION_START-2)this.prepare();}
  reset(){this.root.hidden=true;this.title.hidden=true;this.seen=new Set();this.state=null;this.pushedAt=null;this.prepared=false;for(const [image] of this.art)clearImage(image);}
  push(elapsed){if(elapsed<ASCENSION_START)return false;this.pushedAt=elapsed;return elapsed>=ASCENSION_TIMING.faithStart&&elapsed<ASCENSION_TIMING.reelsReturn;}
  update(elapsed,{paused=false,soundOn=false}={}){
    const state=ascensionState(elapsed,{reducedMotion:this.reducedMotion,pushedAt:this.pushedAt});this.state=state;
    const opening=this.root.hidden;
    if(this.root.hidden===state.active)this.root.hidden=!state.active;if(!state.active)return state;
    this.prepare();if(opening)this.motionHeight=this.parent.clientHeight||this.motionHeight;
    const t=state.time,motion=this.reducedMotion?0:1;
    if(this.root.dataset.stage!==state.stage)this.root.dataset.stage=state.stage;style(this.root,'opacity',String(state.entry));
    property(this.rays,'--ascension-energy',String(state.energy));
    property(this.veil,'--ascension-red',String(state.red));
    style(this.background,'transform',`translate(${Math.sin(t*.25)*2*motion}%,${Math.cos(t*.32)*1.6*motion}%) scale(${1.12+Math.sin(t*.28)*.035*motion}) rotate(${Math.sin(t*.16)*2.5*motion}deg)`);
    style(this.rays,'transform',`rotate(${t*4*motion}deg)`);
    style(this.hero,'opacity',String(state.heroOpacity));
    style(this.hero,'transform',`translate(${state.x}%,${state.y}%) scale(${state.scale}) rotate(${state.tilt}deg)`);
    this.rings.forEach((ring,i)=>{const cycle=this.reducedMotion?.5:((t-21)*.23+i*.5)%1;style(ring,'transform',`translate(-50%,-50%) scale(${.4+cycle*1.7})`);style(ring,'opacity',String((1-cycle)*.65*state.entry));});
    // Low-load CSS shows i positions 5,9,...,33 (the rays/rings precede
    // these particles). Do not animate the other 22 invisible elements.
    this.particles.forEach((n,i)=>{if(this.lowLoad&&i%4!==1)return;const p=this.reducedMotion?i/30:((t-21)/(i<10?8:4)+(i*.618))%1;style(n,'transform',`translate(${Math.sin(t*.7+i)*12*motion}px,${(-12+p*120)*this.motionHeight/100}px) rotate(${i*39+t*15*motion}deg)`);style(n,'opacity',String(state.entry*(i<10?.8:.6)));});
    if(this.title.hidden===state.titleVisible)this.title.hidden=!state.titleVisible;
    if(state.titleVisible){style(this.title,'opacity',String(state.titleOpacity));
    style(this.title,'transform',`translate(calc(-50% + ${state.titleX}%),calc(-50% + ${state.titleY}%)) scale(${state.titleScale}) rotate(${state.titleTilt}deg)`);}
    if(!paused)for(const beat of ASCENSION_BEATS){if(t>=beat.at&&!this.seen.has(beat.id)){this.seen.add(beat.id);if(soundOn&&t-beat.at<.2)this.onBeat(beat);}}
    return state;
  }
}
