import {selectAsset} from './asset-variants-v47.js';
// The monitor cut-in masks a size change; it never changes the captured draw.
const clearImage=node=>{if(node.removeAttribute)node.removeAttribute('src');else delete node.src;};
export class NumberFocusCutin{
  constructor(lcd,{reducedMotion=false}={}){
    this.reducedMotion=reducedMotion;this.active=false;this.elapsed=0;this.generation=0;this.pendingPlay=false;this.paused=true;
    const doc=lcd.ownerDocument;this.root=doc.createElement('div');this.root.className='number-focus-cutin';this.root.hidden=true;
    const streak=doc.createElement('i');streak.className='number-focus-cutin__streak';
    this.art=doc.createElement('img');this.art.decoding='async';this.art.alt='ゆあ様';
    const word=this.word=doc.createElement('img');word.decoding='async';word.className='number-focus-cutin__title';word.alt='雑魚マゾくん♡';
    this.root.append(streak,this.art,word);lcd.append(this.root);
    this.voice=doc.createElement('audio');this.voice.src='assets/reaches/layered-v01/number-taunt-voice-v01.m4a';this.voice.preload='auto';this.voice.volume=.75;this.voice.hidden=true;this.voice.setAttribute('aria-hidden','true');lcd.append(this.voice);
    this.voice.addEventListener('playing',()=>this.didPlay());
  }
  start({soundOn=false}={}){
    this.stop();this.active=true;this.root.hidden=false;this.elapsed=0;this.soundOn=soundOn;this.blocked=false;this.paused=false;
    this.art.src=selectAsset('assets/reaches/layered-v01/temptation-heart-v01.webp');
    this.word.src=selectAsset('assets/reaches/layered-v01/number-taunt-title-v01.webp');
    this.voiceStarted=false;this.voiceSkipped=!soundOn;
    try{this.voice.currentTime=0;}catch{}
    if(soundOn)this.play();this.paint();
  }
  didPlay(){
    // A slow permission/load response must not speak after pause, mute or exit.
    if(!this.active||this.paused||!this.soundOn||this.voiceSkipped){this.voice.pause();return;}
    if(!this.voiceStarted&&this.elapsed>.2){this.voiceSkipped=true;this.pauseVoice();return;}
    this.voiceStarted=true;
  }
  pauseVoice(){this.generation++;this.pendingPlay=false;this.voice.pause();}
  pause(){this.paused=true;this.pauseVoice();}
  play(){
    if(!this.active||this.paused||!this.soundOn||this.voiceSkipped||this.blocked||this.pendingPlay||this.elapsed>=1.4)return;
    // Resume the current scene position, never the old media position.
    try{this.voice.currentTime=this.elapsed;}catch{if(this.elapsed>0)return;}
    const generation=++this.generation;this.pendingPlay=true;
    let attempt;try{attempt=this.voice.play();}catch(error){attempt=Promise.reject(error);}
    Promise.resolve(attempt).then(()=>{if(generation===this.generation)this.didPlay();}).catch(error=>{
      if(generation===this.generation&&error?.name!=='AbortError')this.blocked=true;
    }).finally(()=>{if(generation===this.generation)this.pendingPlay=false;});
  }
  paint(){
    const t=this.elapsed,p=Math.min(1,t/.18),exit=Math.min(1,(1.5-t)/.15);
    this.root.style.opacity=String(Math.max(0,Math.min(p,exit)));
    this.art.style.transform=this.reducedMotion?'none':`translateX(${(1-p)*65}%) scale(${1.05+t*.12})`;
    this.root.style.setProperty('--focus-cut',`${this.reducedMotion?0:Math.sin(t*55)*Math.exp(-t*4)*2}px`);
  }
  update(dt,{paused=false,soundOn=this.soundOn,blocked=false}={}){
    if(!this.active)return;
    if(blocked){this.stop();return;}
    this.soundOn=Boolean(soundOn);
    // Muting consumes this short voice. Unmuting cannot introduce a late phrase.
    if(!soundOn){this.voiceSkipped=true;this.pauseVoice();}
    if(paused){this.pause();return;}
    this.paused=false;
    this.elapsed+=Number.isFinite(dt)?Math.max(0,dt):0;
    if(this.elapsed>=1.5){this.stop();return;}
    if(!this.voiceStarted&&this.elapsed>.2){this.voiceSkipped=true;if(this.pendingPlay||!this.voice.paused)this.pauseVoice();}
    if(this.soundOn&&!this.voiceSkipped){
      if(!this.voice.paused&&Math.abs(this.voice.currentTime-this.elapsed)>.2){try{this.voice.currentTime=this.elapsed;}catch{this.pauseVoice();}}
      if(this.voice.paused&&!this.voice.ended)this.play();
    }
    this.paint();
  }
  stop(){this.active=false;this.root.hidden=true;this.pause();clearImage(this.art);clearImage(this.word);}
}
