import {selectAsset} from './asset-variants-v47.js';
// Presentation-only red continuation. A captured hold owns the result.
import {swordMotionAt} from './promise-motion.js';
import {BakedSceneVideo} from './baked-scene-video.js';
const ASSETS='assets/reaches/layered-v01/';
export const PROMISE_RED_START=15;
export const PROMISE_RED_CUES=Object.freeze([
  {at:15,stage:'key',word:'約束を示せ'},
  {at:21,stage:'x2',word:'×2'},
  {at:23,stage:'words-one',word:'拘束'},
  {at:23.7,stage:'words-one',word:'する'},
  {at:24.4,stage:'words-one',word:'力が'},
  {at:25.4,stage:'words-two',word:'ゆあ様の力だ♡'},
  {at:27.8,stage:'sword',word:''},
  {at:36,stage:'beam',word:''},
  {at:40,stage:'resolve',word:''},
]);
export const LEGACY_PROMISE_RED_CUES=Object.freeze(PROMISE_RED_CUES.map(c=>c.stage==='beam'?{...c,at:52}:c.stage==='resolve'?{...c,at:56}:c));
const WORD_ASSETS=Object.freeze({
  prompt:['約束を示せ','promise-red-word-prompt-v01.png',14,21],
  bind:['拘束','promise-red-word-kousoku-v01.png',22,25.4],
  do:['する','promise-red-word-suru-v01.png',22.7,25.4],
  power:['力が','promise-red-word-chikaraga-v01.png',23.4,25.4],
  yua:['ゆあ様の力だ♡','promise-red-word-yua-power-v01.png',24.4,27.8],
});
const cueAt=(cues,t)=>{for(let i=cues.length-1;i>=0;i--)if(t>=cues[i].at)return cues[i];};
const data=(n,k,v)=>{if(n.dataset[k]!==v)n.dataset[k]=v;};
const style=(n,k,v)=>{if(n.style[k]!==v)n.style[k]=v;};
const property=(n,k,v)=>{if(n.style.getPropertyValue?.(k)!==v)n.style.setProperty(k,v);};
const hidden=(n,v)=>{if(n.hidden!==v)n.hidden=v;};
const clearImage=n=>{if(n.getAttribute?.('src'))n.removeAttribute('src');};
const image=(n,file)=>{const src=selectAsset(`${ASSETS}${file}`);if(n.getAttribute?.('src')!==src)n.src=src;};
export function promiseRedState(elapsed,duration=44){
  if(!Number.isFinite(elapsed)||elapsed<PROMISE_RED_START)return {stage:'base',word:'',art:null,reels:null};
  const cues=duration===60?LEGACY_PROMISE_RED_CUES:PROMISE_RED_CUES;
  const cue=cueAt(cues,elapsed);
  const motion=cue.stage==='sword'?swordMotionAt(elapsed,{duration}):null;
  return {stage:cue.stage,word:cue.word,art:cue.stage==='key'?'promise-red-key-v01.png':cue.stage==='x2'?'promise-red-x2-v01.png':motion?.shot.art??(['sword','beam'].includes(cue.stage)||cue.stage==='resolve'&&duration===60?'promise-red-key-sword-v01.png':null),reels:cue.stage==='beam'?'small':cue.stage==='resolve'?'settle':'hidden'};
}
export class PromiseRedDevelopment{
  constructor(root,{onBeat=()=>{},reducedMotion=false,bakedVideo=true}={}){
    this.root=root;this.onBeat=onBeat;this.reducedMotion=reducedMotion;const doc=root.ownerDocument;
    this.overlay=doc.createElement('div');this.overlay.className='promise-red-development';this.overlay.setAttribute('aria-hidden','true');this.overlay.hidden=true;
    this.art=doc.createElement('img');this.art.decoding='async';this.art.className='promise-red-development__art';this.art.alt='';
    this.beam=doc.createElement('i');this.beam.className='promise-red-development__beam';
    this.slash=doc.createElement('i');this.slash.className='promise-red-development__slash';
    this.flash=doc.createElement('i');this.flash.className='promise-red-development__flash';
    this.words=new Map();
    for(const [id,[alt]] of Object.entries(WORD_ASSETS)){
      const node=doc.createElement('img');node.decoding='async';node.className='promise-red-development__word';node.dataset.word=id;node.alt=alt;node.hidden=true;this.words.set(id,node);
    }
    this.overlay.append(this.art,this.slash,this.beam,this.flash,...this.words.values());root.append(this.overlay);
    const profile=doc.documentElement?.dataset;
    const repaintFilm=()=>{
      // Result presentation freezes the game clock, so its pending native seek
      // must be allowed to reveal the last frame without another game tick.
      if(this.started&&this.lastDuration===44)this.update(this.lastElapsed,{duration:44,paused:!this.film.wantRunning});
    };
    this.film=bakedVideo&&!reducedMotion&&profile?.renderQuality==='mobile'?new BakedSceneVideo(this.overlay,{src:'assets/reaches/films-v44/promise-red-light-v44.mp4',start:15,end:44,className:'promise-red-development__film',onFrameReady:repaintFilm,onFailure:repaintFilm}):null;
    this.reset();
  }
  pause(){this.film?.pause();}
  reset(){
    this.film?.reset();data(this.overlay,'baked','false');
    hidden(this.overlay,true);data(this.root,'promiseRedStage','none');this.lastCue=null;this.lastShot=null;this.started=false;
    style(this.art,'transform','none');style(this.art,'objectPosition','center');clearImage(this.art);
    for(const node of this.words.values()){hidden(node,true);clearImage(node);}
  }
  update(elapsed,{duration=44,paused=false}={}){
    this.lastElapsed=elapsed;this.lastDuration=duration;
    const state=promiseRedState(elapsed,duration);
    if(state.stage==='base'){
      if(this.started)this.reset();
      if(elapsed>=14)image(this.art,'promise-red-key-v01.png');
      return state;
    }
    this.started=true;hidden(this.overlay,false);data(this.overlay,'stage',state.stage);data(this.root,'promiseRedStage',state.stage);
    // A native film replaces the fixed artwork only. The same game clock still
    // drives cue sounds, voice, reel decisions and PUSH outside this overlay.
    const baked=duration===44&&this.film?this.film.update(elapsed,{paused}):false;
    data(this.overlay,'baked',String(baked));
    const cues=duration===60?LEGACY_PROMISE_RED_CUES:PROMISE_RED_CUES,cue=cueAt(cues,elapsed);
    const motion=swordMotionAt(elapsed,{reducedMotion:this.reducedMotion,duration});
    if(motion&&this.lastShot!==motion.shot){
      this.lastShot=motion.shot;
      if(motion.shot.sound&&motion.age<.25)this.onBeat({kind:'promise',text:'剣閃',sound:motion.shot.sound,at:motion.shot.at,elapsed,lateness:motion.age,index:`promise-sword-${motion.shot.id}`});
    }
    if(cue!==this.lastCue){this.lastCue=cue;const lateness=elapsed-cue.at;if(lateness<.25)this.onBeat({kind:'promise',text:state.word||state.stage,at:cue.at,elapsed,lateness,index:`promise-red-${cue.at}`});}
    if(baked){
      clearImage(this.art);hidden(this.art,true);
      for(const node of this.words.values()){hidden(node,true);clearImage(node);}
      return state;
    }
    hidden(this.art,!state.art);if(state.art)image(this.art,state.art);else if(elapsed>=26.8&&elapsed<27.8)image(this.art,'promise-red-key-sword-v01.png');else clearImage(this.art);
    hidden(this.beam,!['beam','resolve'].includes(state.stage));
    const wordTimes={bind:23,do:23.7,power:24.4,yua:25.4};
    data(this.overlay,'shot',motion?.shot.id??'none');
    hidden(this.slash,!motion);hidden(this.flash,!motion);
    property(this.overlay,'--promise-ray-turn',`${this.reducedMotion?0:elapsed*37}deg`);
    if(motion){
      style(this.art,'transform',motion.transform);style(this.art,'objectPosition',motion.shot.focus??'center');
      property(this.overlay,'--promise-sweep',String(motion.sweep));property(this.overlay,'--promise-flash',String(motion.flash));property(this.overlay,'--promise-charge',String(.3+motion.progress*.7));
    }else{
      style(this.art,'objectPosition','center');style(this.art,'transform',this.reducedMotion?'none':state.stage==='key'?`translate(${Math.sin(elapsed*1.9)*2}%,${Math.cos(elapsed*1.5)*1.4}%) scale(${1.03+(elapsed-15)*.012}) rotate(${Math.sin(elapsed)*1.2}deg)`:'none');
    }
    for(const [id,node] of this.words){
      const [,file,prepareAt,releaseAt]=WORD_ASSETS[id];
      const visible=id==='prompt'?state.stage==='key':state.stage==='words-one'&&['bind','do','power'].includes(id)&&elapsed>=wordTimes[id]||state.stage==='words-two'&&id==='yua';
      hidden(node,!visible);
      if(elapsed>=prepareAt&&elapsed<releaseAt)image(node,file);else clearImage(node);
    }
    return state;
  }
}
