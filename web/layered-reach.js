import {MediaRetryGuard} from './media-retry.js';
import {selectAsset} from './asset-variants-v47.js';
import {decodeAudioQueued} from './audio-decode-queue.js';
import { ImpactTitles, MODE_ENTRY_SECONDS } from './impact-titles.js';
import {REACH_TIMES,getReachTiming} from './reach-timing.js';
import {ReachDevelopment,reachArtTime,reachRealTime} from './reach-development.js';
import {AllureDevelopment,ALLURE_DEVELOPMENT_START} from './allure-development.js';
import {TributeDevelopment} from './tribute-development.js';
import {PromiseRedDevelopment,PROMISE_RED_START} from './promise-red-development.js';
import {promiseAnnouncementAt,promiseSwordVowAt} from './promise-motion.js';

const ASSETS = 'assets/reaches/layered-v01/';
const VOICE_ASSETS=Object.freeze({promise:['buffer','promise-voice-v01.mp3'],judgment:['judgmentBuffer','judgment-voice-v01.mp3'],allure:['allureNormalBuffer','allure-voice-normal-v02.mp3'],allureHot:['allureHotBuffer','allure-voice-hot-v04.mp3']});
const voiceAsset=(kind,hot=false)=>VOICE_ASSETS[kind==='allure'&&hot?'allureHot':kind];
const clearImage=node=>{if(node?.removeAttribute)node.removeAttribute('src');else if(node)delete node.src;};
// Assigning an unchanged hidden attribute still mutates the DOM. Keep scene
// visibility on the same clock, but only write it when it actually changes.
const setHidden=(node,hidden)=>{if(node.hidden!==hidden)node.hidden=hidden;};
export const SCENES = Object.freeze({
  allure: {duration:REACH_TIMES.allure,label:'誘惑リーチ',character:'allure-character',title:'temptation'},
  promise: { duration: REACH_TIMES.promise, label: '約束リーチ', background: 'pearl-tunnel', character: 'promise-character', title: 'promise' },
  judgment: { duration: REACH_TIMES.judgment, label: '蛇眼の審判', background: 'red-rays', character: 'judgment-prepare' },
  taunt: {duration:4.2,label:'黒背景・ピンクの煽り',title:'taunt'},
  tribute: {duration:REACH_TIMES.tribute,label:'お貢ぎリーチ',background:'pearl-tunnel',title:'taunt'},
  shutter: {duration:4.2,label:'図柄振動・シャッター'},
  temptation: { duration: 4.2, label: '誘惑カットイン', background: 'pearl-tunnel', character: 'temptation-full', title: 'temptation' },
  spam: {duration:3,label:'スパム襲来',background:'pearl-tunnel'},
  mode: { duration: MODE_ENTRY_SECONDS+6.8, label: '狂信者モード', background: 'mode-entry', title: 'mode' },
});

// Background movie, transparent character art, ornament, impact lettering and
// original voice are independent tracks. Only the selected background decodes.
export class LayeredReach {
  constructor(root, { reducedMotion = false, onBeat = () => {},onGlassMotion=()=>{} } = {}) {
    this.root = root;
    this.video = root.querySelector('video');
    this.character = root.querySelector('[data-character]');
    this.eyelids = root.querySelector('[data-eye-lids]');
    this.sceneImages=[...(root.querySelectorAll?.('img[data-layer-src]')??[])];
    // The controller schedules preparation; native lazy loading must not defer
    // an already selected hidden eyelid or ornament until its first paint.
    for(const image of this.sceneImages)image.loading='eager';
    this.caption = root.querySelector('[data-layer-caption]');
    this.titleArt = root.querySelector('[data-title-art]');
    this.shutter = root.querySelector('[data-layer-shutter]');
    this.titles = new ImpactTitles(root.querySelector('[data-impact]'), { reducedMotion, onBeat });
    this.reducedMotion = reducedMotion;
    this.onBeat = onBeat;
    this.onGlassMotion=onGlassMotion;this.glassMotionCycle=-1;
    this.development=new ReachDevelopment(root,{reducedMotion,onBeat});
    this.allureDevelopment=new AllureDevelopment(root,{reducedMotion,onBeat});
    this.tributeDevelopment=new TributeDevelopment(root,{onBeat,reducedMotion});
    this.promiseRedDevelopment=new PromiseRedDevelopment(root,{onBeat,reducedMotion});
    this.promiseIntro=root.ownerDocument.createElement('div');this.promiseIntro.className='promise-announcement';this.promiseIntro.hidden=true;
    this.promiseLogo=root.ownerDocument.createElement('img');this.promiseLogo.decoding='async';this.promiseLogo.alt='約束リーチ';this.promiseIntro.append(this.promiseLogo);root.append(this.promiseIntro);
    this.generation = 0;this.mediaRetry=new MediaRetryGuard();
    this.key = null;
    this.kind = null;
    this.buffer = null;
    this.voice = null;
    this.voiceLoads=new Map();this.preparedKind=null;
    // One bounded, code-drawn effect layer; no additional image/video decode.
    const document=root.ownerDocument;
    this.glassImpact=document.createElement('img');this.glassImpact.className='allure-glass-impact';
    this.glassImpact.decoding='async';this.glassImpact.alt='';this.glassImpact.hidden=true;root.append(this.glassImpact);
    this.tributeEffects=document.createElement('div');this.tributeEffects.className='tribute-intensity';
    this.tributeEffects.setAttribute('aria-hidden','true');this.tributeEffects.hidden=true;
    const glow=document.createElement('div');glow.className='tribute-intensity__glow';this.tributeEffects.append(glow);
    for(let i=0;i<3;i++){
      const ring=document.createElement('i');ring.className='tribute-intensity__ring';ring.style.setProperty('--wave',String(i));
      ring.style.setProperty('--wave-travel',`var(--tribute-wave-${i},0)`);this.tributeEffects.append(ring);
    }
    for(let i=0;i<12;i++){
      const spark=document.createElement('i');spark.className='tribute-intensity__spark';
      spark.style.setProperty('--spark-angle',`${i*30+13}deg`);spark.style.setProperty('--spark-travel',`var(--tribute-particle-${i%3},0)`);
      this.tributeEffects.append(spark);
    }
    root.append(this.tributeEffects);
    this.video.muted = true;
    this.video.addEventListener('error', () => { if(this.background)this.failVideo(); });
    this.video.addEventListener('playing', () => { this.root.dataset.media = 'playing'; });
  }
  loadVoice(context) {
    if(!context)return;this.context=context;this.audioRegistered=true;return this.loadSelectedVoice();
  }
  loadJudgmentVoice(context) {
    return this.loadVoice(context);
  }
  loadAllureVoices(context){
    return this.loadVoice(context);
  }
  loadSelectedVoice(kind=this.key!==null?this.kind:this.preparedKind){
    // The hot allure branch is not known during spin preparation. It still
    // has 4.2 seconds after scene start to decode its one selected phrase.
    if(kind==='allure'&&this.key===null)return;
    const spec=voiceAsset(kind,this.allureVoiceHot);if(!spec||!this.context||!this.audioRegistered)return;
    const [field,file]=spec;if(this[field])return;
    if(this.voiceLoads.has(field))return this.voiceLoads.get(field).promise;
    const job={abort:typeof AbortController==='function'?new AbortController():null};
    const context=this.context;this.voiceLoads.set(field,job);
    job.promise=fetch(`${ASSETS}${file}`,{signal:job.abort?.signal})
      .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.arrayBuffer();})
      .then(bytes=>this.voiceLoads.get(field)===job?decodeAudioQueued(context,bytes,{signal:job.abort?.signal,isCurrent:()=>this.voiceLoads.get(field)===job}):null)
      .then(buffer=>{if(this.voiceLoads.get(field)===job)this[field]=buffer;})
      .catch(error=>{if(error.name!=='AbortError'&&this.voiceLoads.get(field)===job)console.warn('演出の音声を読み込めませんでした',error);})
      .finally(()=>{if(this.voiceLoads.get(field)===job)this.voiceLoads.delete(field);});
    return job.promise;
  }
  releaseVoices(keepField=null){
    for(const [field] of Object.values(VOICE_ASSETS))if(field!==keepField){
      const job=this.voiceLoads.get(field);this.voiceLoads.delete(field);job?.abort?.abort();this[field]=null;
    }
  }
  prepare(kind) {
    const scene = SCENES[kind];
    if (!scene || this.key !== null) return;
    this.preparedKind=kind;this.releaseVoices(voiceAsset(kind)?.[0]);this.loadSelectedVoice(kind);
    this.setBackground(scene.background);
    this.setSceneImages(kind);
    if(kind==='allure'){this.setCharacter(scene.character);this.character.decode?.().catch(()=>{});}
  }
  setSceneImages(kind){
    for(const image of this.sceneImages){
      const role=image.dataset.layerAsset;
      const wanted=Boolean(kind)&&(role==='eyelids'?kind==='judgment':role==='spam'?kind==='spam':role==='temple'?!['allure','mode','spam'].includes(kind)&&!(kind==='tribute'&&this.key!==null&&this.intense):true);
      if(wanted){const src=selectAsset(image.dataset.layerSrc);if((image.getAttribute?.('src')??image.src)!==src)image.src=src;}
      else clearImage(image);
    }
  }
  failVideo(){
    if(this.playBlocked)return;
    this.generation++;this.pendingPlay=false;this.playBlocked=true;this.root.dataset.media='poster';
    this.video.pause();
    if(this.video.getAttribute?.('src')??this.video.src){this.video.removeAttribute?.('src');if(!this.video.removeAttribute)delete this.video.src;this.video.load();}
  }
  releaseBackground(){
    this.generation++;this.pendingPlay=false;this.video.pause();this.background=null;
    if(this.video.getAttribute?.('src')){this.video.removeAttribute('src');this.video.load();}
    this.video.removeAttribute?.('poster');this.root.style.backgroundImage='none';
  }
  setBackground(name,{restartFailed=false}={}) {
    if(!name){this.releaseBackground();return;}
    if (this.background === name&&(!restartFailed||(this.video.getAttribute?.('src')??this.video.src))) return;
    this.mediaRetry.reset();
    // Mode entry and its later rainbow share one video element. A pending
    // request for the outgoing clip must not block the newly selected source.
    this.generation++;
    this.pendingPlay=false;
    this.video.pause();
    this.playBlocked=false;
    this.root.dataset.media=this.reducedMotion?'still':'loading';
    this.background = name;
    this.video.poster = selectAsset(`${ASSETS}${name}-poster-v01.jpg`);
    this.root.style.backgroundImage = `url("${selectAsset(`${ASSETS}${name}-poster-v01.jpg`)}")`;
    this.video.src = selectAsset(`${ASSETS}${name}-v01.mp4`);
    this.video.load();
  }
  start(kind, key, {intense=false,duration,allureDevelops=false,allureVoiceHot=false,tributeBranch=null,promiseRed=false,win=false}={}) {
    if (!SCENES[kind]) return false;
    this.stop({releaseMedia:false,keepVoiceField:voiceAsset(kind,allureVoiceHot)?.[0],keepDecorKind:kind});
    this.kind = kind;
    this.intense=kind==='tribute'&&!tributeBranch&&Boolean(intense);
    this.allureDevelops=kind==='allure'&&allureDevelops===true;
    this.allureVoiceHot=kind==='allure'&&allureVoiceHot===true;
    this.tributeBranch=kind==='tribute'&&['green','red'].includes(tributeBranch)?tributeBranch:null;
    this.promiseRed=kind==='promise'&&promiseRed===true;
    this.tributeWin=win===true;
    this.key = key;
    this.scene = {...SCENES[kind],duration:duration??SCENES[kind].duration};
    this.setSceneImages(kind);
    this.loadSelectedVoice();
    if(kind==='promise'&&this.scene.duration>=30)this.promiseLogo.src=selectAsset(`${ASSETS}promise-full-title-v01.webp`);
    if(kind==='allure')this.glassImpact.src=selectAsset(`${ASSETS}allure-glass-impact-v01.png`);
    this.root.hidden = false;
    this.root.dataset.kind = kind;
    this.root.dataset.intense=String(this.intense);
    this.root.dataset.allureStrong=String(this.allureDevelops);
    this.root.dataset.tributeBranch=this.tributeBranch??'none';
    this.root.dataset.promiseRed=String(this.promiseRed);
    this.root.dataset.allureVoice=this.allureVoiceHot?'hot':'normal';
    this.root.dataset.voiceState=kind==='allure'?'before':'none';
    this.root.dataset.reduced=String(this.reducedMotion);
    this.root.dataset.media = this.reducedMotion ? 'still' : 'loading';
    this.root.dataset.step = kind==='mode'?'entry':'enter';
    this.glassImpact.hidden=true;
    if(this.shutter)this.shutter.hidden=kind!=='shutter';
    if(this.eyelids)this.eyelids.hidden=true;
    this.root.setAttribute('aria-label', this.scene.label);
    this.playBlocked = false;
    this.voiceStarted = this.voiceSkipped = this.voiceFinished = false;
    this.voiceCue=null;
    this.promiseIntro.hidden=true;
    this.lastElapsed = 0;this.glassPushAt=null;
    this.lastPaint = -1;
    this.setBackground(this.intense?null:this.scene.background,{restartFailed:true});
    try { this.video.currentTime = 0; } catch { /* poster remains during load */ }
    this.setCharacter(this.scene.character);
    this.setCaption('');
    if(this.titleArt){
      const tributeTitle=kind==='tribute'&&!this.tributeBranch;
      this.titleArt.hidden=(!['promise','judgment'].includes(kind)&&!tributeTitle)||(kind==='promise'&&this.scene.duration>=30);
      if(!this.titleArt.hidden){this.titleArt.src=selectAsset(tributeTitle?`${ASSETS}tribute-title-yellow-red-v01.png`:`${ASSETS}${kind==='promise'?'promise-full':kind}-title-v01.webp`);this.titleArt.alt=tributeTitle?'お貢ぎリーチ♡♡':this.scene.label;}
    }
    this.beats = new Set();
    if (this.scene.title) this.titles.start(this.scene.title, key);
    return true;
  }
  setCharacter(name) {
    if (this.character.hidden !== !name) this.character.hidden = !name;
    if(!name){if(this.character.dataset.art){clearImage(this.character);delete this.character.dataset.art;}return;}
    if (name && this.character.dataset.art !== name) {
      this.character.src = selectAsset(`${ASSETS}${name}-v01.webp`);
      this.character.dataset.art = name;
    }
  }
  stopVoice() {
    if (!this.voice) return;
    const source = this.voice;
    this.voice = null;
    source.onended=null;try{source.stop();}catch{}
    source.disconnect();this.voiceGain?.disconnect();this.voiceGain=null;source.buffer=null;
  }
  pause() {
    this.generation++;
    this.pendingPlay = false;
    this.video.pause();this.mediaRetry.reset();
    this.promiseRedDevelopment?.pause();
    this.stopVoice();
    if(this.kind==='allure')this.root.dataset.voiceState='paused';
  }
  stop({releaseMedia=true,keepVoiceField=null,preservePrepared=null,keepDecorKind=null}={}) {
    const retainPrepared=this.key===null&&preservePrepared!==null&&preservePrepared===this.preparedKind;
    if(retainPrepared){releaseMedia=false;keepVoiceField=voiceAsset(preservePrepared)?.[0];keepDecorKind=preservePrepared;}
    this.key = null;
    this.pause();
    if(!retainPrepared)this.preparedKind=null;this.releaseVoices(keepVoiceField);
    this.setSceneImages(keepDecorKind);
    if(releaseMedia)this.releaseBackground();
    this.titles.stop();
    this.development.reset();
    this.allureDevelopment.reset();
    this.tributeDevelopment.reset();
    this.promiseRedDevelopment.reset();
    this.glassImpact.hidden=true;
    clearImage(this.glassImpact);clearImage(this.promiseLogo);clearImage(this.titleArt);this.setCharacter(null);
    this.root.hidden = true;
    this.promiseIntro.hidden=true;this.root.dataset.promiseAnnouncement='false';
    this.root.dataset.reels = 'normal';this.glassPushAt=null;this.glassMotionCycle=-1;
    this.intense=false;this.allureDevelops=false;this.allureVoiceHot=false;this.tributeBranch=null;this.promiseRed=false;this.tributeWin=false;this.root.dataset.intense='false';this.root.dataset.allureStrong='false';this.root.dataset.allureVoice='normal';this.root.dataset.tributeBranch='none';this.root.dataset.promiseRed='false';this.root.dataset.voiceState='none';this.tributeEffects.hidden=true;
  }
  push(elapsed=this.lastElapsed){
    if(this.key===null||this.kind!=='allure'||!Number.isFinite(elapsed))return false;
    this.glassPushAt=elapsed;this.lastPaint=-1;this.onGlassMotion({source:'push',elapsed});return true;
  }
  beat(id, at, elapsed, text) {
    if (elapsed < at || this.beats.has(id)) return;
    this.beats.add(id);
    const realAt=reachRealTime(this.kind,at,this.allureDevelops?36:this.scene.duration),lateness=this.lastElapsed-realAt;
    if (lateness >= 0 && lateness < .25) this.onBeat({ kind: this.kind, key: this.key, text, elapsed:this.lastElapsed, at:realAt, lateness, index:id });
  }
  update(elapsed, { paused = false, soundOn = false, pushed = false } = {}) {
    if (this.key === null) return;
    if (paused) { if(this.kind==='allure'&&Number.isFinite(elapsed))this.glassMotionCycle=Math.max(this.glassMotionCycle,Math.floor((Math.min(elapsed,this.scene.duration)-1.3)/1.2));this.pause(); return; }
    this.lastElapsed = elapsed;
    const realTime = Math.min(elapsed, this.scene.duration);
    const promiseAnnouncement=this.kind==='promise'&&this.scene.duration>=30;
    setHidden(this.promiseIntro,!(promiseAnnouncement&&realTime<3));
    this.setData('promiseAnnouncement',String(!this.promiseIntro.hidden));
    if(!this.promiseIntro.hidden){
      const intro=promiseAnnouncementAt(realTime,{reducedMotion:this.reducedMotion});
      this.promiseIntro.style.setProperty('--promise-intro-rays',`${intro.rays}deg`);
      this.promiseIntro.style.setProperty('--promise-intro-tunnel',String(intro.tunnel));
      this.promiseLogo.style.transform=intro.transform;
    }else if(this.promiseLogo.getAttribute?.('src')||this.promiseLogo.src)clearImage(this.promiseLogo);
    if(promiseAnnouncement&&this.titleArt)setHidden(this.titleArt,true);
    const legacyClock=this.allureDevelops||this.promiseRed;
    const t = reachArtTime(this.kind,legacyClock?Math.min(realTime,36):realTime,legacyClock?36:this.scene.duration);
    if(this.tributeBranch||(this.allureDevelops&&realTime>=ALLURE_DEVELOPMENT_START)||(this.promiseRed&&realTime>=PROMISE_RED_START)){
      if(this.development.stage!=='none')this.development.reset();
    }else this.development.update(this.kind,realTime,legacyClock?36:this.scene.duration);
    if(this.kind==='mode'){
      const entry=t<MODE_ENTRY_SECONDS;
      this.setBackground(entry?'mode-entry':'rainbow-tunnel');
      this.updateVideo(entry?t:t-MODE_ENTRY_SECONDS,{loop:!entry});
      for(const [id,at,sound] of [['entry',.05,'frame-prepare'],['impact',3.45,'thunder'],['surge',5.8,'energy']]){
        const key=`mode-film-${id}`;
        if(realTime>=at&&!this.beats.has(key)){
          this.beats.add(key);const lateness=realTime-at;
          if(lateness<.25)this.onBeat({kind:'mode',index:key,sound,text:'突入映像',at,elapsed:realTime,lateness});
        }
      }
    }else if((this.tributeBranch&&realTime>=4)||(this.promiseRed&&realTime>=PROMISE_RED_START)){
      // Opaque tribute and red promise continuations replace the old movie.
      // Release its decoder and poster instead of playing it underneath.
      if(this.background)this.releaseBackground();
      this.setSceneImages(null);
    }else if(this.scene.background&&this.kind!=='spam'&&!this.intense)this.updateVideo(realTime);else this.video.pause();
    this.updateVoice(realTime, soundOn);
    const paint = Math.floor(realTime * 24);
    const tributeBoundary=this.kind==='tribute'&&this.intense&&((t>=4.2&&t<10)===this.tributeEffects.hidden);
    const shouldPaint = paint !== this.lastPaint || this.root.dataset.pushed !== String(pushed) || tributeBoundary;
    this.lastPaint = paint;
    this.setData('pushed', String(pushed));
    const reduced = this.reducedMotion;
    if(this.tributeBranch&&realTime>=4){
      // The complete opaque tribute scene owns every visible pixel from here.
      // Do not retain/play the old tunnel, actor, ornament or titles behind it.
      if(this.character.dataset.art)this.setCharacter(null);
      this.setCaption('');
      if(this.titles.key!==null)this.titles.stop();
      setHidden(this.tributeEffects,true);
      this.tributeDevelopment.update(realTime,this.tributeBranch,this.tributeWin);
      this.setData('step',this.tributeDevelopment.overlay.dataset.stage);
      this.setData('reels','hidden');
      return;
    }
    setHidden(this.glassImpact,this.kind!=='allure'||t<12.2);
    if(!this.glassImpact.hidden){const impactStart=reachRealTime(this.kind,12.2,this.scene.duration);const age=realTime-impactStart,arrival=Math.max(0,1-age/.32);this.glassImpact.style.transform=reduced?'rotate(-8deg)':`translateY(${arrival*115}%) rotate(-8deg) scale(${1+arrival*.25})`;}
    if(this.kind==='judgment'&&this.titleArt){
      const visible=t<1.5;
      setHidden(this.titleArt,!visible);
      if(visible){
        const src=selectAsset(`${ASSETS}judgment-title-v01.webp`);
        if((this.titleArt.getAttribute?.('src')??this.titleArt.src)!==src)this.titleArt.src=src;
      }else if(this.titleArt.getAttribute?.('src')??this.titleArt.src)clearImage(this.titleArt);
    }
    if(this.titleArt&&shouldPaint&&!this.titleArt.hidden){
      if(this.kind==='tribute'){
        const age=realTime-4.2;
        this.titleArt.style.top='55%';this.titleArt.style.height='32%';
        this.titleArt.style.opacity=String(Math.max(0,Math.min(1,age/.25,(6.8-realTime)/.35)));
        this.titleArt.style.transform=reduced?'none':`scale(${1+Math.max(0,1-age/.25)*.4})`;
      }else{
        const end=this.kind==='promise'?4.2:1.5;
        if(this.kind==='promise'){const shrink=Math.max(0,Math.min(1,(t-.5)/.35));this.titleArt.style.top=`${24-shrink*20}%`;this.titleArt.style.height=`${52-shrink*29}%`;}else{this.titleArt.style.top='16%';this.titleArt.style.height='69%';}
        this.titleArt.style.opacity=String(Math.min(1,t/.1)*Math.max(0,Math.min(1,(end-t)/.22)));
        this.titleArt.style.transform=reduced?'none':`scale(${1+Math.max(0,1-t/.24)*1.2}) rotate(-4deg)`;
      }
    }
    if (this.kind === 'promise'&&(!this.promiseRed||realTime<PROMISE_RED_START)) {
      this.setData('reels', t>=11.1?'settle':'small');
      this.setData('step', t < 4.3 ? 'voice' : t<8.6?'resolve':t<11.1?'suspense':'settle');
      this.setCharacter('promise-character');
      if (shouldPaint) this.character.style.transform = `translateY(${reduced ? 0 : 3 - Math.min(t, 7.6) * .7}%) scale(${reduced ? 1 : 1 + Math.min(t, 7.6) * .025})`;
      this.setCaption(t>=11.1?'':t>=8.6?'……':t > 4.2 ? (pushed ? '約束の印が、灯る。' : 'その約束を、示せ。') : '');
      this.beat('resolve', 4.3, t, '約束');
      this.beat('settle',11.1,t,'結末');
    } else if(this.kind==='promise'&&this.promiseRed){
      this.setData('reels','hidden');this.setData('step','red');this.setCharacter(null);this.setCaption('');
    } else if (this.kind === 'judgment') {
      // The figures disappear during the long scene, then return before settle.
      this.setData('reels', t < .6 || t >= 12 ? 'small' : 'hidden');
      this.setData('step', t < 2.2 ? 'enter' : t < 5.6 ? 'closed' : t<6.3?'opened':'resolve');
      this.setCharacter(t<2.2?'judgment-prepare':t<6.3?'eye-open':t>=8.4&&t<9.4?'judgment-prepare':'judgment-strike');
      const face=t>=2.2&&t<6.3;
      const attackAge=t>=12?t-12:t>=9.4?t-9.4:t-6.3;
      const zoom = face?1.85+(t-2.2)*.035:t<.4?.8+t*.7:t<6.3?1.08:t>=8.4&&t<9.4?1.5+(t-8.4)*.15:1.075+Math.max(0,.45-attackAge*1.5);
      const dx=t<.4?(1-t/.4)*28:t>=6.3?Math.sin(attackAge*55)*Math.exp(-attackAge*5)*4:0;
      const dy=face?18:t<.4?8*(1-t/.4):0;
      if (shouldPaint) this.character.style.transform = reduced?'none':`translate(${dx.toFixed(2)}%,${dy.toFixed(2)}%) scale(${zoom.toFixed(3)})`;
      if(this.eyelids){setHidden(this.eyelids,!(t>=2.2&&t<5.6));if(t>=5.6)clearImage(this.eyelids);if(shouldPaint)this.eyelids.style.transform=this.character.style.transform;}
      this.setCaption(t<2.35?'':t<4.6?'もう負けそうな顔してるんでしょ':t<6.3?'':t<9.4?(pushed?'審判の刻':'運命を、その手で。'):t<12?'まだ、決まらない。':'');
      this.beat('gaze', 2.2, t, '蛇眼');
      this.beat('open',5.6,t,'開眼');
      this.beat('judgment', 6.3, t, '審判');
      this.beat('second-strike',9.4,t,'追撃');
      this.beat('number-suspense',12,t,'溜め');
      this.beat('last-suspense',17.8,t,'決着前');
      if(shouldPaint)this.root.style.setProperty('--eye-flare',String(reduced?0:Math.max(0,1-(t-5.6)/.65)*(t>=5.6?1:0)));
    } else if(this.kind==='allure'){
      const cycle=Math.floor((realTime-1.3)/1.2),onset=1.3+cycle*1.2;
      if(cycle>=0&&cycle>this.glassMotionCycle){
        this.glassMotionCycle=cycle;
        if(t<10.4&&(!this.allureDevelops||realTime<ALLURE_DEVELOPMENT_START)&&realTime-onset<.15&&soundOn&&(this.glassPushAt===null||realTime-this.glassPushAt>.2))this.onGlassMotion({source:'automatic',elapsed:realTime});
      }
      this.setData('reels',t<1.3?'small':t<10.4?'hidden':'settle');
      this.setData('step',t<1.3?'enter':t<7.2?'approach':t<10.4?'suspense':'settle');
      this.setCharacter('allure-character');
      if(shouldPaint){
        const phase=Math.max(0,realTime-1.3),weight=t<7.2?1:t<10.4?.25:0;
        // The same whole-image movement used by the Othello glass layer.
        const pushAge=this.glassPushAt===null?Infinity:Math.max(0,realTime-this.glassPushAt);
        const pushBounce=pushAge<1.15?Math.sin(pushAge*Math.PI*2/1.15)*Math.exp(-pushAge*1.5)*12:0;
        const bounce=reduced?0:-pushBounce-Math.pow(Math.max(0,Math.sin(phase*Math.PI*2/1.2)),2)*5*weight;
        this.character.style.transform=reduced?'none':`translateY(${bounce.toFixed(2)}%) scale(${(1.03+Math.min(t,7.2)*.008).toFixed(3)})`;
        this.root.style.setProperty('--allure-light',String(reduced?.2:.18+Math.pow(Math.sin(t*2),2)*.25));
      }
      this.setCaption(t<3.8?'':t<4.8?'こっち、見て♡':t<7.2?'目をそらさないで♡':t<10.4?'……届く？':'');
      for(const [id,at,text] of [['enter',1.3,'誘惑'],['approach',4,'鼓動'],['wait',7.2,'溜め'],['settle',10.4,'結末']])if(!this.allureDevelops||id!=='settle'||realTime<ALLURE_DEVELOPMENT_START)this.beat(id,at,t,text);
      if(!this.allureDevelops)this.beat('glass-impact',12.2,t,'接触');
    } else if (this.kind === 'temptation') {
      this.setData('reels', t > .15 && t < 3.1 ? 'hidden' : 'small');
      this.setData('step', t < 1.25 ? 'enter' : 'heart');
      this.setCharacter(t < 1.25 ? 'temptation-full' : 'temptation-heart');
      if (shouldPaint) this.character.style.transform = `translateX(${reduced ? 0 : t < 1.25 ? Math.max(0, 12 - t * 28) : 0}%) scale(${reduced ? 1 : 1.03 + Math.min(t, 4) * .025})`;
      this.setCaption('');
    } else if(this.kind==='tribute'){
      this.setData('reels',t<4.2?'hidden':t<7.6?'small':'settle');
      this.setData('step',t<4.2?'words':t<7.6?'offer':'settle');
      this.setCharacter(t<4.2?null:'temptation-heart');
      if(shouldPaint){
        const age=Math.max(0,t-4.2),impact=this.intense?Math.exp(-(age%1.3)*7):0;
        this.character.style.transform=reduced?'none':this.intense?`translate(${Math.sin(age*8)*impact*1.6}%,${-age*.25}%) scale(${1.08+age*.033+impact*.07})`:`scale(${1.05+age*.025})`;
        this.paintTribute(t,realTime);
      }
      this.setCaption(t>=5.2&&t<7.6?(pushed?'その想い、見せてもらうよ♡':'想いを、示せ♡'):'');
      if(!this.tributeBranch){this.beat('offer',4.3,t,'貢げ');this.beat('settle',7.6,t,'結末');}
      if(this.intense)for(const [id,at] of [['surge',4.2],['wave-1',5.5],['wave-2',6.8],['wave-3',8.1],['wave-4',9.4]])this.beat(`tribute-${id}`,at,t,'衝撃');
    } else if(this.kind==='shutter'){
      this.setData('reels','small');this.setCharacter('temptation-heart');this.setCaption('');
      if(this.shutter){const p=t<.8?0:t<1.1?(t-.8)/.3:t<2.4?1:Math.max(0,1-(t-2.4)/.65);this.shutter.style.setProperty('--shutter-close',String(p));}
      this.beat('shut',1.1,t,'シャッター');
    } else if(this.kind==='taunt'){
      this.setData('reels','hidden');this.setData('step','words');this.setCharacter(null);this.setCaption('');
    } else if(this.kind==='spam'){
      this.setData('reels','small');this.setData('step','alert');this.setCharacter(null);
      this.setCaption('スパム襲来');
      if(shouldPaint){for(let i=0;i<3;i++)this.root.style.setProperty(`--spam-${i}`,String(reduced?1:Math.max(0,Math.min(1,(t-i*.38)/.24))));}
    } else {
      this.setData('reels', 'hidden');
      const local=t-MODE_ENTRY_SECONDS;
      this.setData('step',local<0?'entry':local<2.7?'gather':local<3.3?'silence':'release');
      this.setCharacter(local>=0&&local<3.3?'temptation-heart':null);
      if(shouldPaint&&local>=0&&local<3.3)this.character.style.transform=reduced?'none':`translateY(${3-local*2}%) scale(${1.05+local*.09})`;
      this.setCaption(local<0?'':local<2.7?'女王への信仰が、満ちる。':local>5.4?'女王 RUSH 突入':'');
    }
    if(shouldPaint&&!this.character.hidden&&getReachTiming(this.kind,this.scene.duration).long&&!reduced&&this.kind!=='allure'){
      const drift=` translate(${Math.sin(realTime*.7)*2.3}%,${Math.cos(realTime*.6)*1.5}%) scale(${1.02+Math.pow(Math.sin(realTime*.43),2)*.055})`;
      this.character.style.transform+=drift;
      if(this.eyelids&&!this.eyelids.hidden)this.eyelids.style.transform=this.character.style.transform;
    }
    if(this.allureDevelops){
      const state=this.allureDevelopment.update(realTime);
      if(state.stage!=='base'){
        this.setData('step',state.stage);this.setData('reels',state.reels);this.setCaption(state.caption);
        this.glassImpact.hidden=realTime<37;
        if(!this.glassImpact.hidden){const age=realTime-37,arrival=Math.max(0,1-age/.32);this.glassImpact.style.transform=reduced?'rotate(-8deg)':`translateY(${arrival*115}%) rotate(-8deg) scale(${1+arrival*.25})`;}
        if(shouldPaint)this.character.style.transform=reduced?'none':state.stage==='approach'?`translateY(${(21-realTime)*1.8}%) scale(${(1.08+(realTime-21)*.045).toFixed(3)})`:state.stage==='still'?'scale(1.31)':state.stage==='title'?'scale(1.37)':state.stage==='fracture'?'scale(1.42)':`scale(${state.stage==='resolve'?'1.16':'1.3'})`;
      }
    }
    if(this.tributeBranch){
      this.tributeDevelopment.update(realTime,this.tributeBranch,this.tributeWin);
      this.setData('step',this.tributeDevelopment.overlay.dataset.stage);
      this.setData('reels','hidden');this.setCaption('');
    }
    if(this.promiseRed){
      const state=this.promiseRedDevelopment.update(realTime,{duration:this.scene.duration});
      if(state.stage!=='base'){
        this.setData('step',state.stage);this.setData('reels',state.reels);this.setCaption('');this.setCharacter(null);
      }
    }
    if (shouldPaint) this.titles.update(promiseAnnouncement?Math.max(0,realTime-3):this.tributeBranch?realTime:t, { paused, pushed });
    if(this.development.stage!=='none')this.setData('reels','hidden');
  }
  setData(key, value) { if (this.root.dataset[key] !== value) this.root.dataset[key] = value; }
  paintTribute(t,realTime=t){
    const active=this.intense&&t>=4.2&&t<10;
    setHidden(this.tributeEffects,!active);if(!active)return;
    const age=realTime-4.2,reduced=this.reducedMotion;
    // Only narrow rings and particles brighten. The black field never flashes.
    this.root.style.setProperty('--tribute-glow',String(reduced?.45:.62+.13*Math.sin(age*2.2)));
    for(let i=0;i<3;i++){
      const waveAge=age-i*.33;
      const wave=waveAge<0?0:(waveAge%1.3)/1.3;
      this.root.style.setProperty(`--tribute-wave-${i}`,String(reduced?.48:wave));
      this.root.style.setProperty(`--tribute-particle-${i}`,String(reduced?.55:((age+i*.39)%1.6)/1.6));
    }
  }
  setCaption(value) { if (this.caption.textContent !== value) this.caption.textContent = value; }
  updateVideo(elapsed,{loop=true}={}) {
    const v = this.video;
    if(v.loop!==loop)v.loop=loop;
    if (this.reducedMotion || this.playBlocked || v.readyState < 2) return;
    // The seven-second entry plays once. Only ambient backgrounds loop.
    const duration=Number.isFinite(v.duration)&&v.duration>0?v.duration:this.scene.duration;
    if(!loop&&(v.ended||elapsed>=duration)){v.pause();return;}
    const target = loop?elapsed%Math.max(.1,duration):Math.min(elapsed,Math.max(0,duration-.025));
    if (!v.seeking && Math.abs(v.currentTime - target) > .4){
      const correction=this.mediaRetry.seek();
      if(correction==='failed'){this.failVideo();return;}
      if(correction==='seek')v.currentTime=target;
    }
    if (v.paused && !this.pendingPlay&&this.mediaRetry.canPlay()) {
      this.pendingPlay = true;
      const generation = ++this.generation;
      let attempt;try{attempt=v.play();}catch(error){attempt=Promise.reject(error);}
      Promise.resolve(attempt).then(()=>{if(this.generation===generation)this.mediaRetry.playSucceeded();},error=>{
        if(this.generation===generation&&(error?.name!=='AbortError'||this.mediaRetry.playFailed()))this.failVideo();
      }).finally(() => { if (this.generation === generation) this.pendingPlay = false; });
    }
  }
  updateVoice(elapsed, soundOn) {
    if (!['promise','judgment','allure'].includes(this.kind)) return;
    // The second vow accompanies the sword close-up, independently of the opening voice.
    const swordAt=promiseSwordVowAt(this.scene.duration);
    const swordVow=this.kind==='promise'&&this.promiseRed&&elapsed>=swordAt;
    const start = swordVow?swordAt:this.kind === 'judgment' ? 2.35 : this.kind==='allure'?4.2:this.scene.duration>=30?3.55:.55;
    const cue=`${this.kind}-${start}`;
    if(this.voiceCue!==cue){this.stopVoice();this.voiceCue=cue;this.voiceStarted=this.voiceSkipped=this.voiceFinished=false;}
    const buffer = this.kind === 'judgment' ? this.judgmentBuffer : this.kind==='allure'?(this.allureVoiceHot?this.allureHotBuffer:this.allureNormalBuffer):this.buffer;
    const offset = elapsed - start;
    if (!this.voiceStarted && elapsed > start + .25) this.voiceSkipped = true;
    if (!soundOn || this.context?.state !== 'running') { this.stopVoice();if(this.kind==='allure')this.setData('voiceState',soundOn?'suspended':'off');return; }
    if (this.voice && Math.abs(this.context.currentTime - this.voiceClock + this.voiceOffset - offset) > .25) this.stopVoice();
    if (this.kind==='allure')this.setData('voiceState',this.voice?'playing':this.voiceFinished?'ended':this.voiceSkipped?'skipped':!buffer?'loading':offset<0?'before':offset>=buffer.duration-.04?'ended':'ready');
    if (this.voice || this.voiceFinished || this.voiceSkipped || !buffer || offset < 0 || offset >= buffer.duration - .04) return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; gain.gain.value = .68;
    source.connect(gain); gain.connect(this.voiceDestination||this.context.destination);
    this.voice = source;this.voiceGain=gain;
    if(this.kind==='allure')this.root.dataset.voiceState='playing';
    this.voiceStarted = true; this.voiceClock = this.context.currentTime; this.voiceOffset = offset;
    source.onended = () => {
      source.onended=null;
      if (this.voice === source) { this.voice = null; this.voiceGain=null;this.voiceFinished = true;if(this.kind==='allure')this.root.dataset.voiceState='ended'; }
      source.disconnect(); gain.disconnect();source.buffer=null;
    };
    source.start(0, offset);
  }
}
