import {selectAsset} from './asset-variants-v47.js';
// Presentation only. The caller supplies scene time; no timers or audio run here.
export const MODE_ENTRY_SECONDS=7;
const SCENES = Object.freeze({
  taunt: {duration:4.2,words:[{text:'おいマゾ♡',at:.25,row:37,size:25,fromX:0,fromY:-20,tilt:-4},{text:'貢げ♡♡',at:1.8,row:65,size:29,fromX:0,fromY:20,tilt:4}]},
  jackpot: { duration:1.9, words:[{text:'BONUS!!',at:.02,row:44,size:27,fromX:0,fromY:-22,tilt:-6}] },
  queen: { duration:1.9, words:[{text:'RUSH確定',at:.08,row:56,size:30,fromX:0,fromY:-28,tilt:-3}] },
  awakening: { duration:1.9, words:[{text:'覚醒',at:.02,row:39,size:37,fromX:0,fromY:-22,tilt:-6},{text:'BONUS!!',at:.6,row:68,size:24,fromX:0,fromY:22,tilt:4}] },
  promotion: { duration:3.3, words:[{text:'昇格',at:.8,row:40,size:34,fromX:-100,fromY:-8,tilt:-5},{text:'確変',at:1.55,row:70,size:34,fromX:100,fromY:8,tilt:5}] },
  mode: { duration:MODE_ENTRY_SECONDS+6.7, words:[
    {text:'狂信者',at:MODE_ENTRY_SECONDS+3.3,row:39,size:25,fromX:0,fromY:-24,tilt:-5},
    {text:'モード',at:MODE_ENTRY_SECONDS+4.2,row:66,size:27,fromX:0,fromY:22,tilt:4},
  ]},
  promise: { duration:3.8, words:[
    {text:'ゆあ様との',at:.55,row:51,size:14.5,fromX:-110,fromY:-8,tilt:-4},
    {text:'約束だよ',at:2,row:73,size:20,fromX:110,fromY:10,tilt:4},
  ]},
  temptation: { duration:3.8, words:[
    {text:'ドクン',at:.2,row:47,size:23,fromX:-112,fromY:-17,tilt:-9,until:2.45},
    {text:'ドクン',at:1.1,row:71,size:24,fromX:112,fromY:17,tilt:8,until:2.6},
    {text:'誘惑',at:2.2,row:64,size:32,fromX:0,fromY:-65,tilt:-3},
  ]},
});
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const easeOut=value=>1-(1-clamp(value))**3;

export class ImpactTitles {
  constructor(root,{reducedMotion=false,onBeat=()=>{}}={}){
    if(!root)throw new TypeError('ImpactTitles needs a dedicated root element');
    this.root=root;
    this.reducedMotion=Boolean(reducedMotion);
    this.onBeat=typeof onBeat==='function'?onBeat:()=>{};
    this.kind=null;this.key=null;this.duration=0;this.active=false;
    this._generation=0;this._lastElapsed=-1;this._beaten=new Set();this._words=[];
    root.classList.add('impact-titles');
    root.dataset.reduced=String(this.reducedMotion);
    root.setAttribute('aria-hidden','true');root.hidden=true;
  }

  start(kind,key){
    if(!Object.hasOwn(SCENES,kind))return false;
    if(this.active&&this.kind===kind&&this.key===key)return false;
    this.stop();
    this.kind=kind;this.key=key;this.duration=SCENES[kind].duration;this.active=true;
    this._lastElapsed=-1;this._beaten.clear();
    const document=this.root.ownerDocument;
    this._words=SCENES[kind].words.map((word,index)=>{
      const element=document.createElement('div');
      element.className='impact-titles__word';element.dataset.index=String(index);
      element.style.top=`${word.row}%`;
      element.style.setProperty('--impact-size',`${word.size}cqw`);
      element.style.opacity='0';element.style.visibility='hidden';
      const art={'RUSH確定':'rush-confirmed',昇格:'promotion',確変:'kakuhen',誘惑:'temptation-title','BONUS!!':'bonus-title',狂信者:'fanatic-title',モード:'mode-title','ゆあ様との':'promise-voice-1','約束だよ':'promise-voice-2','おいマゾ♡':'taunt-oi','貢げ♡♡':'taunt-offer'}[word.text];
      if(art){
        const image=document.createElement('img');image.className='impact-titles__art';
        image.src=selectAsset(art==='rush-confirmed'?'assets/reaches/layered-v01/rush-confirmed-v32.png':`assets/reaches/layered-v01/${art}-v01.webp`);image.alt=word.text;
        element.dataset.art=art;element.append(image);
        return {...word,element};
      }
      if(word.text==='ドクン'){
        const manga=document.createElement('span');manga.className='impact-titles__manga';
        manga.setAttribute('aria-label',word.text);element.dataset.art='manga';element.append(manga);
        return {...word,element};
      }
      const ink=document.createElement('span');ink.className='impact-titles__ink';
      const face=document.createElement('span');face.className='impact-titles__face';face.textContent=word.text;
      ink.dataset.text=word.text;ink.append(face);element.append(ink);
      return {...word,element};
    });
    const afterglow=document.createElement('div');afterglow.className='impact-titles__afterglow';
    if(['promise','temptation','queen','promotion'].includes(kind)){
      for(let i=0;i<16;i++){
        const petal=document.createElement('i'),angle=(i/16*Math.PI*2)+.2;
        petal.className='impact-titles__petal';
        petal.style.setProperty('--petal-x',String(Math.cos(angle)*(42+i%3*5)));
        petal.style.setProperty('--petal-y',String(Math.sin(angle)*(48+i%4*4)));
        petal.style.setProperty('--petal-rotation',`${i*47}deg`);
        petal.style.setProperty('--petal-size',`${i%3===0?5:2.5}cqw`);
        afterglow.append(petal);
      }
    }
    this.root.replaceChildren(...this._words.map(word=>word.element),afterglow);
    this.root.dataset.kind=kind;this.root.dataset.pushed='false';
    this.root.style.setProperty('--impact-flash','0');
    this.root.style.setProperty('--impact-burst-opacity','0');
    this.root.style.setProperty('--impact-tail-opacity','0');
    this.root.hidden=false;
    return true;
  }

  stop(){
    this._generation++;
    this.active=false;this.kind=null;this.key=null;this.duration=0;
    this._beaten.clear();this._lastElapsed=-1;
    this.root.hidden=true;
    this.root.style.setProperty('--impact-flash','0');
    if(this._words.length){this.root.replaceChildren();this._words=[];}
  }

  update(elapsed,{paused=false,pushed=false}={}){
    if(!this.active||!Number.isFinite(elapsed))return false;
    if(paused)return true;
    // Rewinding a supplied clock cannot replay a beat. A new scene uses start().
    elapsed=Math.max(0,elapsed,this._lastElapsed);
    if(elapsed>=this.duration){this.stop();return false;}
    const generation=this._generation;
    this.root.dataset.pushed=String(Boolean(pushed));
    let flash=0,lastImpact=-1;
    for(let index=0;index<this._words.length;index++){
      const word=this._words[index],age=elapsed-word.at;
      if(age<0)continue;
      lastImpact=word.at;
      if(!this._beaten.has(index)){
        this._beaten.add(index);
        this.onBeat({kind:this.kind,key:this.key,index,text:word.text,at:word.at,elapsed,lateness:age});
        if(generation!==this._generation)return this.active;
      }
      const end=word.until??this.duration;
      const fade=clamp((end-elapsed)/.36);
      const mode=this.kind==='mode';
      const arrival=easeOut(age/(mode?.46:.24));
      const motion=this.reducedMotion?1:arrival;
      const settle=this.reducedMotion?0:Math.sin(Math.max(0,age-.24)*28)*Math.exp(-Math.max(0,age-.24)*14)*.055;
      const pulse=mode&&age>.46?Math.sin(age*10+index*1.7)*.055:0;
      const modeElapsed=elapsed-MODE_ENTRY_SECONDS;
      const barrage=mode&&modeElapsed>=4.48&&modeElapsed<5.3?Math.exp(-((modeElapsed-4.48)%.16)*22)*.2:0;
      const impact=mode?barrage+Math.max(0,1-Math.abs(modeElapsed-5.35)/.32)*.22+Math.max(0,1-Math.abs(modeElapsed-6.05)/.25)*.16:0;
      const scale=this.reducedMotion?1:1+(1-arrival)*(mode?2.4:1.65)+(age>=.24?settle:0)+pulse+impact;
      const x=word.fromX*(1-motion)+(mode&&!this.reducedMotion?Math.sin(age*9+index)*1.7:0),y=word.fromY*(1-motion)+(mode&&!this.reducedMotion?Math.sin(age*11)*1.8:0);
      const rotation=this.reducedMotion?0:mode?(index?-1:1)*((1-arrival)*65+Math.sin(age*7)*3.5):word.tilt*(1-arrival*.84);
      word.element.style.visibility=fade>0?'visible':'hidden';
      word.element.style.opacity=String(clamp(age/(this.reducedMotion?.12:.035))*fade);
      word.element.style.transform=`translate(-50%,-50%) translate(${x.toFixed(3)}cqw,${y.toFixed(3)}cqw) rotate(${rotation.toFixed(3)}deg) rotateY(${mode&&!this.reducedMotion?(1-arrival)*(index?72:-72):0}deg) scale(${scale.toFixed(3)})`;
      if(!this.reducedMotion)flash=Math.max(flash,clamp(1-age/.27)*.3);
    }
    this.root.style.setProperty('--impact-flash',flash.toFixed(3));
    if(this.kind==='mode'){
      this.root.style.setProperty('--mode-hue',`${this.reducedMotion?0:Math.max(0,elapsed-MODE_ENTRY_SECONDS)*110}deg`);
      for(const local of [4.48,4.64,4.8,4.96,5.12,5.35,6.05]){const at=MODE_ENTRY_SECONDS+local;if(elapsed>=at&&!this._beaten.has(`echo-${at}`)){this._beaten.add(`echo-${at}`);this.onBeat({kind:this.kind,key:this.key,text:'モード',at,elapsed,lateness:elapsed-at});}}
    }
    // Short foreground streaks, then a slower ring and small peripheral sparks.
    // Their staggered timing leaves the lettering and face clear after impact.
    const age=lastImpact<0?10:elapsed-lastImpact;
    this.root.style.setProperty('--impact-burst-opacity',String(this.reducedMotion?0:Math.max(0,1-age/.2)*.65));
    this.root.style.setProperty('--impact-ring-scale',String(.25+easeOut(age/.6)*1.65));
    this.root.style.setProperty('--impact-tail-opacity',String(this.reducedMotion?0:clamp((age-.09)/.13)*clamp((.95-age)/.7)*.7));
    this.root.style.setProperty('--impact-tail-scale',String(.7+easeOut(age/1.1)*.5));
    this.root.style.setProperty('--petal-progress',String(easeOut(Math.max(0,age-.08)/1.2)));
    this._lastElapsed=elapsed;
    return true;
  }
}
