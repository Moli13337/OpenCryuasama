import {selectAsset} from './asset-variants-v47.js';
import {getReachTiming,reachStage} from './reach-timing.js';
import {createSymbol} from './reel-symbols.js';

// Art cues retain their ordering. Speech and background movies use real seconds.
const CUES={
  promise:[[0,0],[4,4],[10,4.15],[12,4.3],[15,5.5],[18,7.6],[26,8.6],[29,11.1],[32,14]],
  judgment:[[0,0],[5,5],[15,5.6],[18,6.3],[28,8.4],[30,9.4],[35,12],[42,17.8],[45,20]],
  tribute:[[0,0],[4.2,4.2],[15,5.2],[18,6.2],[29,7.6],[32,10]],
  allure:[[0,0],[4,4],[15,7.2],[27,9.5],[29,10.4],[30.2,12.2],[32,14]],
};
export function reachArtTime(kind,elapsed,duration){
  const cues=CUES[kind],plan=getReachTiming(kind,duration);
  if(!cues||!plan.long)return elapsed;
  const end=cues.at(-1)[0],originalDuration=plan.duration-plan.resolveDelay;
  const climax=originalDuration-3;
  // Preserve speech, PUSH and impact cues. Only the final rotating-number scene
  // gains four seconds; ambient movement continues on its real-time clock.
  const sceneTime=elapsed<=climax?elapsed:climax+(elapsed-climax)*3/(3+plan.resolveDelay);
  const time=Math.max(0,Math.min(end,sceneTime*end/originalDuration));
  for(let i=1;i<cues.length;i++){
    const [b,y]=cues[i],[a,x]=cues[i-1];
    if(time<=b)return x+(y-x)*(time-a)/(b-a);
  }
  return cues.at(-1)[1];
}
export function reachRealTime(kind,artTime,duration){
  const cues=CUES[kind],plan=getReachTiming(kind,duration);
  if(!cues||!plan.long)return artTime;
  for(let i=1;i<cues.length;i++){
    const [b,y]=cues[i],[a,x]=cues[i-1];
    if(artTime<=y){
      const originalDuration=plan.duration-plan.resolveDelay,climax=originalDuration-3;
      const time=(a+(b-a)*(artTime-x)/(y-x))*originalDuration/cues.at(-1)[0];
      return time<=climax?time:climax+(time-climax)*(3+plan.resolveDelay)/3;
    }
  }
  return plan.duration;
}
const clamp=value=>Math.max(0,Math.min(1,value));
const clearArt=node=>{if(node.removeAttribute)node.removeAttribute('src');else delete node.src;};
export function developmentCue(elapsed,plan){
  if(!plan.long)return null;
  const cues=[{at:10,start:6.8,text:'発展',detail:'この想いは、まだ終わらない。',level:1},
    {at:21.2,start:18.3,text:'×2',detail:'さらに、その先へ。',level:2}];
  if(plan.duration>=40)cues.push({at:38.2,start:35,text:'×3',detail:'運命が、動き出す。',level:3});
  return cues.find(c=>elapsed>=c.start&&elapsed<c.at+2.5)??null;
}
export class ReachDevelopment{
  constructor(root,{reducedMotion=false,onBeat=()=>{}}={}){
    this.root=root;this.reducedMotion=reducedMotion;this.onBeat=onBeat;this.seen=new Set();this.stage='none';this.lastPaint=-1;
    const doc=root.ownerDocument;this.overlay=doc.createElement('div');this.overlay.className='reach-development';
    this.overlay.setAttribute('aria-hidden','true');this.overlay.hidden=true;
    this.rays=doc.createElement('i');this.rays.className='reach-development__rays';
    this.ring=doc.createElement('i');this.ring.className='reach-development__ring';
    this.title=doc.createElement('div');this.title.className='reach-development__title';
    this.art=doc.createElement('img');this.art.decoding='async';this.art.alt='発展';this.art.className='reach-development__art';
    this.multiplier=doc.createElement('b');this.multiplier.className='reach-development__multiplier';
    this.title.append(this.art,this.multiplier);this.detail=doc.createElement('small');
    this.storm=doc.createElement('div');this.storm.className='reach-development__storm';
    this.glyphs=Array.from({length:15},(_,i)=>{const node=createSymbol(i%9+1,doc);this.storm.append(node);return node;});
    this.overlay.append(this.rays,this.ring,this.storm,this.title,this.detail);root.append(this.overlay);
  }
  reset(){this.seen.clear();this.overlay.hidden=true;clearArt(this.art);this.stage='none';this.lastPaint=-1;this.root.dataset.development='none';this.root.dataset.developmentBurst='false';this.root.dataset.developmentStage='none';}
  update(kind,elapsed,duration){
    const plan=getReachTiming(kind,duration),cue=developmentCue(elapsed,plan);
    this.root.dataset.development=plan.long?reachStage(elapsed,plan):'none';
    // Tribute keeps the established titles but has no number-rush prelude.
    // Do not emit a storm state either: the caller keys its storm sound to it.
    const tributeStorm=Boolean(cue&&kind==='tribute'&&elapsed<cue.at);
    this.root.dataset.developmentBurst=String(Boolean(cue&&!tributeStorm));this.overlay.hidden=!cue||tributeStorm;
    this.stage=cue&&!tributeStorm?(elapsed<cue.at?'storm':'title'):'none';this.root.dataset.developmentStage=this.stage;
    if(!cue){clearArt(this.art);return;}
    // Prepare while the preceding numbers are moving, before the title shows.
    const originalTitleSrc=kind==='allure'&&cue.level>1?`assets/reaches/layered-v01/allure-x${cue.level}-${cue.level===2?'green':'red'}-v31.png`:`assets/reaches/layered-v01/${cue.level===1?'development-title-v01':cue.level===2?'development-x2-green-v01':'development-x3-red-v01'}.webp`;
    const titleSrc=selectAsset(originalTitleSrc);
    if((this.art.getAttribute?.('src')??this.art.src)!==titleSrc)this.art.src=titleSrc;this.art.alt=cue.text;
    if(tributeStorm)return;
    const age=elapsed-cue.at,storm=this.stage==='storm',stamp=Math.floor(elapsed*30);
    this.overlay.dataset.stage=this.stage;this.overlay.dataset.level=String(cue.level);
    this.overlay.dataset.tone=kind==='allure'&&(cue.level===1||storm)?'pearl':'default';
    this.title.hidden=storm;this.detail.hidden=storm;this.storm.hidden=!storm;
    this.art.hidden=false;this.multiplier.hidden=true;
    this.title.setAttribute('aria-label',cue.text);this.multiplier.textContent=cue.level===1?'':cue.text;this.detail.textContent=cue.detail;
    if(age>=0&&!this.seen.has(cue.at)){this.seen.add(cue.at);if(age<.25)this.onBeat({kind,text:'発展',at:cue.at,elapsed,lateness:age});}
    if(stamp===this.lastPaint)return;this.lastPaint=stamp;
    const time=elapsed-cue.start;
    this.overlay.style.opacity=String(storm?clamp(time/.2):clamp((2.5-age)/.4));
    this.rays.style.transform=this.reducedMotion?'none':`rotate(${elapsed*28}deg) scale(${1+Math.sin(elapsed*5)*.12})`;
    if(storm){
      for(let i=0;i<this.glyphs.length;i++){
        this.glyphs[i].hidden=false;
        const p=((time*1.15+i*.193)%1),angle=i*2.4,dist=8+p*p*80;
        const x=Math.cos(angle)*dist,y=Math.sin(angle)*dist;
        this.glyphs[i].style.transform=this.reducedMotion?`translate(${Math.cos(angle)*30}%,${Math.sin(angle)*30}%) scale(.7)`:`translate(${x}%,${y}%) scale(${.12+p*p*3.5}) rotate(${Math.sin(angle)*18}deg)`;
        this.glyphs[i].style.opacity=String(this.reducedMotion?.35:clamp(p/.14)*clamp((1-p)/.15));
      }
      this.ring.style.opacity='0';
    }else{
      const enter=clamp(1-age/.32),beat=Math.exp(-(age%.62)*12)*.055;
      this.title.style.transform=this.reducedMotion?'none':cue.level===2?`translateX(${enter*120}%) scale(${1+beat}) rotate(${-7+Math.sin(age*18)*Math.exp(-age*2)*3}deg)`:cue.level===3?`translateY(${-enter*20}%) scale(${1+enter*3+beat*2}) rotate(${Math.sin(age*45)*Math.exp(-age*1.5)*5}deg)`:`scale(${1+enter*2.1+beat}) rotate(${-5+Math.sin(age*23)*Math.exp(-age*1.8)*3}deg)`;
      this.ring.style.transform=this.reducedMotion?'scale(1)':`scale(${.35+(age%.65)*3.5})`;
      this.ring.style.opacity=String(this.reducedMotion?.3:clamp(1-(age%.65)/.65));
    }
  }
}
