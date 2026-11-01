import {selectAsset} from './asset-variants-v47.js';
export const REVIVAL_SECONDS = 5;
export const RESULT_SECONDS = 7;
export const REVIVAL_LINES = Object.freeze(['ゆあ様はまだ', 'マゾが苦しんでるのを', 'みたいんだ！！']);
const ART = './assets/reaches/layered-v01/pv-premium-cry-v34.png';
const CONTINUE_ART = './assets/reaches/layered-v01/revival-continue-v32.png';
const BEATS = [
  { id:'star', at:.95, text:'' }, { id:'yua', at:1.6, text:'' },
  ...REVIVAL_LINES.map((text,i)=>({ id:`line-${i+1}`, at:[2.1,2.9,3.65][i], text })),
  { id:'continue-hit',at:2.5,text:'継続' }, { id:'continue-seal',at:3.1,text:'' },
].sort((a,b)=>a.at-b.at);
const clamp = n => Math.max(0,Math.min(1,n));
const smooth = n => { const t=clamp(n);return t*t*(3-2*t); };
const integer = value => Number.isFinite(Number(value)) ? Math.max(0,Math.floor(Number(value))) : 0;
const clearImage=node=>{if(node.removeAttribute)node.removeAttribute('src');else delete node.src;};

/** Presentation only: all totals and the revival decision come from the engine. */
export class ResultPresentation {
  constructor(root,{reducedMotion=false,onBeat=()=>{}}={}) {
    this.root=root;this.reducedMotion=Boolean(reducedMotion);this.onBeat=typeof onBeat==='function'?onBeat:()=>{};
    this.state='idle';this.elapsed=0;this.resultElapsed=0;this.duration=0;this.fired=new Set();this.artReady=false;this.artStarted=false;this.continueReady=false;this.artGeneration=0;
    root.classList.add('result-presentation');root.setAttribute('aria-hidden','true');root.hidden=true;
    const add=(tag,name,parent=root)=>{const node=root.ownerDocument.createElement(tag);node.className=name;parent.append(node);return node;};
    this.panel=add('section','result-presentation__panel');
    this.modeLabel=add('div','result-presentation__mode',this.panel);
    const title=add('h2','result-presentation__heading result-presentation__metal',this.panel);title.textContent='連荘結果';title.dataset.face=title.textContent;
    const count=add('div','result-presentation__count',this.panel);
    this.wins=add('strong','result-presentation__metal',count);const unit=add('span','',count);unit.textContent='連';
    const label=add('div','result-presentation__label',this.panel);label.textContent='獲得玉';
    const payout=add('div','result-presentation__payout',this.panel);
    this.payout=add('strong','result-presentation__metal',payout);const balls=add('span','',payout);balls.textContent='玉';
    const end=add('div','result-presentation__end',this.panel);end.setAttribute('aria-hidden','true');end.textContent='◆';
    this.star=add('div','result-presentation__star');
    this.flash=add('div','result-presentation__flash');
    this.rainbow=add('div','result-presentation__rainbow');this.rainbow.setAttribute('aria-hidden','true');
    this.character=add('img','result-presentation__yua');this.character.alt='';this.character.decoding='async';this.character.draggable=false;
    this.continue=add('div','result-presentation__continue');
    this.continueArt=add('img','',this.continue);this.continueArt.alt='継続';this.continueArt.decoding='async';this.continueArt.draggable=false;this.continueArt.hidden=true;
    this.continueText=add('strong','',this.continue);this.continueText.textContent='継続';
    this.dialogue=add('div','result-presentation__dialogue');
    this.lines=REVIVAL_LINES.map(text=>{const node=add('span','result-presentation__line',this.dialogue);node.textContent=text;return node;});
    this._paint();
  }

  get active(){return this.state!=='idle';}
  get blocking(){return this.state==='finish'||this.state==='revive';}
  get wide(){return this.state==='revive'&&this.elapsed>=1.6;}

  showResult({wins=0,payout=0,mode='rush',residual=false}={}) {
    if(this.state==='idle'){
      this.state='result';this.elapsed=0;this.resultElapsed=0;this.fired.clear();
    }
    this.wins.textContent=String(integer(wins));this.payout.textContent=integer(payout).toLocaleString('ja-JP');
    for(const [node,maximum,budget] of [[this.wins,25,68],[this.payout,21,70]]){
      const text=node.textContent;
      node.dataset.face=text;node.setAttribute('aria-label',text);
      // Fit the actual digit/comma count before paint; no measuring or layout loop.
      const widthUnits=[...text].reduce((sum,char)=>sum+(char===','?.29:.67),0);
      node.style.fontSize=`${Math.min(maximum,budget/Math.max(1,widthUnits)).toFixed(3)}cqw`;
    }
    this.modeLabel.textContent=mode==='challenge'?'RUSH 挑戦':'狂信者モード';
    this.root.dataset.residual=String(Boolean(residual));
    this.root.hidden=false;this._paint();
    return this._status();
  }

  _loadArt(){
    if(this.artStarted)return;this.artStarted=true;
    const generation=++this.artGeneration;
    const current=()=>generation===this.artGeneration&&this.artStarted&&this.state==='revive';
    const image=this.character;
    this.continueArt.onload=()=>{if(!current())return;this.continueReady=true;this.continueArt.hidden=false;this.continueText.hidden=true;};
    this.continueArt.onerror=()=>{if(!current())return;this.continueReady=false;this.continueArt.hidden=true;this.continueText.hidden=false;};
    this.continueArt.src=selectAsset(CONTINUE_ART);
    const success=()=>{if(!current())return;this.artReady=true;image.hidden=false;image.onload=image.onerror=null;};
    image.onload=success;image.onerror=()=>{if(!current())return;this.artReady=false;image.hidden=true;};image.src=selectAsset(ART);
    if(typeof image.decode==='function'){
      try{image.decode().then(success,()=>{if(current()&&image.complete&&!image.naturalWidth)image.onerror?.();});}catch{}
    }
  }

  _releaseArt(){
    this.artGeneration++;this.artStarted=false;this.artReady=false;this.continueReady=false;
    for(const image of [this.character,this.continueArt]){image.onload=image.onerror=null;image.hidden=true;clearImage(image);}
    this.continueText.hidden=false;
  }

  revive(){
    if(this.state==='revive')return this._status();
    if(this.state==='idle')this.showResult();
    this.state='revive';this.elapsed=0;this.duration=REVIVAL_SECONDS;this.fired.clear();
    this._loadArt();this.root.hidden=false;this._paint();return this._status();
  }

  finish(){
    if(this.state==='idle'||this.state==='finish'||this.state==='revive')return this._status();
    // Residual decisions run behind the result panel. Count that visible time
    // toward the seven seconds, then retain the existing short exit fade.
    this.state='finish';this.duration=Math.max(.45,RESULT_SECONDS-this.resultElapsed);this.elapsed=0;this._paint();return this._status();
  }

  update(dt,{paused=false}={}){
    if(!this.active)return this._status();
    if(paused||!Number.isFinite(dt)||dt<=0)return this._status();
    this.elapsed+=dt;
    if(this.state==='result')this.resultElapsed+=dt;
    if(this.state==='revive')for(const beat of BEATS){
      if(this.elapsed>=beat.at&&!this.fired.has(beat.id)){
        this.fired.add(beat.id);
        const lateness=this.elapsed-beat.at;
        if(lateness<=.25)this.onBeat({...beat,type:'revive',kind:'revive',elapsed:this.elapsed,lateness});
      }
    }
    if(this.blocking&&this.elapsed+1e-8>=this.duration){this.reset();return this._status(true);}
    this._paint();return this._status();
  }

  _status(completed=false){return {blocking:this.blocking,active:this.active,completed,wide:this.wide};}

  _paint(){
    const reviving=this.state==='revive',t=this.elapsed;
    const reduced=this.reducedMotion;
    this.root.dataset.state=this.state;
    this.root.dataset.wide=String(this.wide);
    this.root.dataset.step=!reviving?'result':t<.95?'result':t<1.6?'star':t<2.1?'yua':'dialogue';
    this.root.dataset.reduced=String(reduced);
    const entrance=reviving?smooth((t-1.6)/.35):0;
    const fade=this.state==='finish'?1-smooth((t-(this.duration-.45))/.45):reviving?1-smooth((t-4.7)/.3):1;
    this.root.style.opacity=String(fade);
    this.panel.style.opacity=String(1-entrance);
    const travel=clamp((t-.95)/.65);
    this.star.style.opacity=String(reviving&&t>=.95&&t<1.7?(reduced?.5:Math.sin(travel*Math.PI)):0);
    this.star.style.transform=reduced?'translate(0,0) rotate(-26deg)':`translate(${(-130+travel*260).toFixed(2)}%,${(80-travel*180).toFixed(2)}%) rotate(-26deg)`;
    this.flash.style.opacity=String(reviving&&!reduced?Math.max(0,1-Math.abs(t-1.55)/.22)*.8:0);
    this.character.style.opacity=String(this.artReady?entrance:0);
    const portraitTime=Math.max(0,t-1.6);
    const sway=reviving&&!reduced?Math.sin(portraitTime*2.2)*1.1:0;
    this.character.style.transform=reduced?'scale(1)':`translateY(${sway.toFixed(3)}%) scale(${(1.13-entrance*.1+Math.min(portraitTime,2.7)*.012).toFixed(3)})`;
    const hitAge=Math.min(...[2.5,3.1].filter(at=>t>=at).map(at=>t-at));
    const hit=reviving&&!reduced&&Number.isFinite(hitAge)?Math.exp(-hitAge*9):0;
    this.rainbow.style.opacity=this.wide?String(reduced?.2:.5+hit*.45):'0';
    this.rainbow.style.transform=`rotate(${reduced?0:(portraitTime*38).toFixed(3)}deg)`;
    if(this.wide&&!reduced)this.flash.style.opacity=String(hit*.8);
    const continued=reviving&&t>=2.5;
    this.continue.style.opacity=continued?'1':'0';
    this.continue.style.transform=reduced?'none':`translate(${(Math.sin(t*95)*hit*3).toFixed(3)}%,${continued?0:8}%) scale(${continued?(1+hit*.48).toFixed(3):.9}) rotate(${(Math.sin(t*82)*hit*2).toFixed(3)}deg)`;
    this.lines.forEach((line,i)=>{
      const appeared=reviving&&t>=[2.1,2.9,3.65][i];
      line.style.opacity=appeared?'1':'0';
      line.style.transform=reduced?'none':`translateY(${appeared?0:12}%)`;
    });
  }

  reset(){
    this.state='idle';this.elapsed=0;this.resultElapsed=0;this.duration=0;this.fired.clear();
    this._releaseArt();
    this.root.hidden=true;this._paint();
  }
}
