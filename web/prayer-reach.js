import {decodeAudioQueued} from './audio-decode-queue.js';
import {MediaRetryGuard} from './media-retry.js';
import {selectAsset} from './asset-variants-v47.js';
import {PrayerAscension,ASCENSION_START} from './prayer-ascension.js';
const clamp=value=>Math.max(0,Math.min(1,value));
const data=(node,key,value)=>{if(node.dataset[key]!==value)node.dataset[key]=value;};
const hidden=(node,value)=>{if(node.hidden!==value)node.hidden=value;};
const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
const style=(node,key,value)=>{if(node.style[key]!==value)node.style[key]=value;};
const property=(node,key,value)=>{if(node.style.getPropertyValue?.(key)!==value)node.style.setProperty(key,value);};
const clearImage=node=>{if(node?.removeAttribute)node.removeAttribute('src');else if(node)delete node.src;};
// A captured losing draw is revealed before its scenery fades. No new lottery.
export function prayerForecastState(elapsed,duration=10){
  const time=Math.max(0,elapsed)*10/duration;
  return {stage:time<4?'presence':time<5?'digits':time<7.5?'result':time<9?'fade':'normal',
    digits:time>=4&&time<9,settled:time>=5,
    digitOpacity:clamp((time-4)/.3)*(1-clamp((time-7.5)/1.5)),
    black:time<9?clamp((time-7.5)/1.5):1-clamp(time-9),
    reveal:time>=9,resultAt:duration*.5};
}

// One reusable, muted video. The original prayer voice follows simulation time,
// including dialog pause, tab hiding, mute changes and a reset during loading.
export class PrayerReach {
  constructor(root, { reducedMotion = false, onIntro=()=>{},onFizzle=()=>{},onPrelude=()=>{},onPreludeStop=()=>{},onAscensionBeat=()=>{} } = {}) {
    this.root = root;
    this.video = root.querySelector('video');
    this.logicalVideoSource=this.video.getAttribute?.('data-src')||this.video.getAttribute?.('src')||'assets/reaches/prayer-original-v01.mp4';
    this.videoSource=selectAsset(this.logicalVideoSource,root.ownerDocument);
    this.caption = root.querySelector('[data-prayer-caption]');
    this.reducedMotion = reducedMotion;
    this.onPrelude=onPrelude;this.onPreludeStop=onPreludeStop;this.particles=[];this.onIntro=onIntro;this.onFizzle=onFizzle;this.introDuration=0;
    if(root.ownerDocument){
      this.intro=root.ownerDocument.createElement('div');this.intro.className='prayer-intro';this.intro.hidden=true;
      this.introPortrait=root.ownerDocument.createElement('img');this.introPortrait.decoding='async';this.introPortrait.className='prayer-intro__yua';this.introPortrait.alt='ゆあ様';
      this.introLight=root.ownerDocument.createElement('i');this.introLight.className='prayer-intro__light';
      this.introTitle=root.ownerDocument.createElement('img');this.introTitle.decoding='async';this.introTitle.className='prayer-intro__title';this.introTitle.alt='お祈りリーチ！！';
      this.intro.append(this.introPortrait,this.introLight,this.introTitle);
      for(let index=0;index<38;index++){
        const particle=root.ownerDocument.createElement('i'),feather=index<12;
        particle.className=feather?'prayer-feather':'prayer-mote';particle.setAttribute('aria-hidden','true');
        particle.style.left='0';particle.style.top='0';
        if(feather)particle.innerHTML='<svg viewBox="0 0 30 90" fill="none"><path d="M15 85C12 64 7 39 23 4C33 28 31 45 21 64L15 76C2 60 -3 35 23 4" fill="#fff8db" fill-opacity=".88"/><path d="M15 85Q9 48 23 4M15 62L5 47M15 54L26 39M15 45L7 29M17 35L27 20M19 24L14 16" stroke="#c7e6df" stroke-width="1.1"/></svg>';
        this.intro.append(particle);this.particles.push({node:particle,feather,index});
      }
      this.introBlack=root.ownerDocument.createElement('i');this.introBlack.className='prayer-blackout';this.intro.append(this.introBlack);root.append(this.intro);
      this.ascension=new PrayerAscension(root,{reducedMotion,onBeat:onAscensionBeat});
      this.motionSize={width:0,height:0};
      if(typeof ResizeObserver==='function')new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;if(width&&height)this.motionSize={width,height};}).observe(root);
    }
    this.key = null;
    this.voice = null;
    this.pendingPlay = false;
    this.playGeneration = 0;
    this.playBlocked = false;
    this.mediaRetry = new MediaRetryGuard();
    this.voiceFinished = false;
    this.voiceStarted = false;
    this.voiceSkipped = false;
    this.buffer = null;
    this.voiceGeneration=0;
    this.video.muted = true;
    this.video.addEventListener('error', () => { if(this.key!==null)this.failVideo(); });
    for(const event of ['loadeddata','seeked','playing','ended'])this.video.addEventListener(event,()=>this.showVideoFrame());
  }
  showVideoFrame() {
    // A paused/restored or completed movie still owns its decoded frame.
    // Do not wait exclusively for a new 'playing' event to reveal that frame.
    if(this.key!==null&&!this.playBlocked&&!this.video.error&&this.video.readyState>=2)
      data(this.root,'media',this.video.ended?'ended':this.video.paused?'ready':'playing');
  }
  loadVoice(context) {
    if (!context) return;
    this.context = context;
    // Enabling sound does not decode both prayer variants for the whole game.
    // The seven-second introduction provides the preparation window instead.
    return this.loadCurrentVoice();
  }
  loadCurrentVoice(){
    if(this.key===null||!this.develops||this.ascensionEntered||typeof this.context?.decodeAudioData!=='function')return;
    const field=this.fullChant?'strongBuffer':'buffer';
    if(this[field]||this.loading)return this.loading;
    const generation=this.voiceGeneration,context=this.context;
    const controller=this.voiceAbort=typeof AbortController==='function'?new AbortController():null;
    const src=this.fullChant?'assets/reaches/prayer-ascension-v01/prayer-full-chant-v01.mp3':'assets/reaches/prayer-voice-v01.mp3';
    const loading=fetch(src,{signal:this.voiceAbort?.signal})
      .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.arrayBuffer();})
      .then(bytes=>generation===this.voiceGeneration?decodeAudioQueued(context,bytes,{signal:controller?.signal,isCurrent:()=>generation===this.voiceGeneration}):null)
      .then(buffer=>{if(generation===this.voiceGeneration&&this.key!==null)this[field]=buffer;})
      .catch(error=>{if(error.name!=='AbortError'&&generation===this.voiceGeneration)console.warn('お祈りの音声を読み込めませんでした',error);})
      .finally(()=>{if(this.loading===loading){this.loading=null;this.voiceAbort=null;}});
    this.loading=loading;return loading;
  }
  releaseVoiceAssets({clearBuffers=true}={}){
    this.voiceGeneration++;this.voiceAbort?.abort();this.voiceAbort=null;this.loading=null;
    if(clearBuffers){this.buffer=null;this.strongBuffer=null;}
  }
  releaseVideo({keepPoster=false}={}){
    if(!keepPoster){this.video.removeAttribute?.('poster');this.root.style?.removeProperty?.('--prayer-poster');}
    this.video.pause();
    if(this.video.getAttribute?.('src')??this.video.src){clearImage(this.video);this.video.load();}
  }
  failVideo(){
    if(this.playBlocked)return;
    this.playBlocked=true;this.playGeneration++;this.pendingPlay=false;
    this.releaseVideo({keepPoster:true});data(this.root,'media','fallback');
  }
  releaseIntro(){
    if(this.intro)this.intro.hidden=true;
    clearImage(this.introPortrait);clearImage(this.introTitle);
  }
  prepare() {
    const poster=selectAsset(this.video.dataset?.poster,this.root.ownerDocument);
    if(poster){this.video.setAttribute('poster',poster);this.root.style?.setProperty('--prayer-poster',`url("${poster}")`);}
    // Mobile browsers may ignore preload while the scene is hidden.
    // Starting play below must not depend on that preload having completed.
    const selected=this.video.getAttribute?.('src')??this.video.src;
    if(selected!==this.videoSource){this.video.src=this.videoSource;this.video.load();}
    else if(this.video.error||this.video.readyState===0)this.video.load();
  }
  start(key,elapsed=0,{introDuration=0,develops=true,strong=false,strongDuration=45}={}) {
    this.stop({releaseMedia:false});
    this.key = key;
    this.strong=Boolean(strong&&develops);this.fullChant=this.strong&&strongDuration!==36;this.strongOffset=this.strong&&strongDuration===36?9:0;this.ascensionEntered=false;if(this.strong)this.ascension?.start(elapsed+this.strongOffset);
    if(this.fullChant)this.buffer=null;else this.strongBuffer=null;
    this.introDuration=Math.max(0,introDuration);this.preludeDuration=develops?Math.max(0,introDuration-3):introDuration*.4;this.develops=develops;
    this.introSeen=elapsed>=this.preludeDuration+.4;this.fizzleSeen=elapsed>=introDuration*.5+.4;this.preludeSeen=elapsed>=.5;this.introEnded=false;
    this.root.hidden = false;
    if(this.motionSize)this.motionSize={width:this.root.clientWidth||this.motionSize.width,height:this.root.clientHeight||this.motionSize.height};
    if(this.intro&&elapsed<this.introDuration){
      this.introPortrait.src=selectAsset('assets/reaches/layered-v01/prayer-cien-character-v01.webp',this.root.ownerDocument);
      if(develops)this.introTitle.src=selectAsset('assets/reaches/layered-v01/prayer-title-v01.webp',this.root.ownerDocument);
    }
    // Reduced motion softens the surrounding effects, not this essential story clip.
    this.root.dataset.media = 'loading';
    this.playBlocked = false;
    this.voiceFinished = false;
    this.voiceStarted = false;
    this.voiceSkipped = false;
    this.video.loop=this.fullChant;
    if(develops&&!(this.strong&&elapsed+this.strongOffset>=ASCENSION_START))this.prepare();else this.releaseVideo();
    if(!(this.strong&&elapsed+this.strongOffset>=ASCENSION_START))this.loadCurrentVoice();
    this.seekOnReady=Math.max(0,elapsed-this.introDuration);
    if(this.video.readyState>=1&&Number.isFinite(this.video.duration)){
      const time=this.fullChant&&this.video.duration>0?this.seekOnReady%this.video.duration:this.seekOnReady;
      this.video.currentTime=Math.min(time,Math.max(0,this.video.duration-.04));this.seekOnReady=null;
    }
    this.showVideoFrame();
  }
  stopVoice() {
    if(this.voice){
      const source=this.voice,release=this.voiceCleanup;this.voice=null;this.voiceGain=null;this.voiceCleanup=null;source.onended=null;
      try{source.stop();}catch{}
      release?.();
    }
  }
  pause() {
    this.onPreludeStop();
    this.playGeneration++;
    this.pendingPlay = false;
    this.mediaRetry.reset();
    this.video.pause();
    this.stopVoice();
  }
  stop({releaseMedia=true}={}) {
    this.key = null;
    this.pause();
    this.root.hidden = true;
    this.releaseVoiceAssets({clearBuffers:releaseMedia});
    if(releaseMedia)this.releaseVideo();
    this.releaseIntro();
    this.ascension?.reset();delete this.root.dataset.ascension;
    if(this.intro)this.intro.hidden=true;
    delete this.root.dataset.intro;delete this.root.dataset.fizzleReveal;delete this.root.dataset.fizzleDigits;
    delete this.root.dataset.media;delete this.root.dataset.step;
  }
  update(elapsed, { paused, soundOn, pushed }) {
    if (this.key === null) return;
    const introducing=elapsed<this.introDuration||!this.develops;
    data(this.root,'intro',String(introducing));
    const forecast=this.develops?null:prayerForecastState(elapsed,this.introDuration);
    data(this.root,'fizzleReveal',String(Boolean(forecast?.reveal)));
    data(this.root,'fizzleDigits',String(Boolean(forecast?.digits)));
    if(this.introBlack)style(this.introBlack,'opacity',String(forecast?.black??0));
    if(this.intro)hidden(this.intro,!introducing);
    if(this.intro&&introducing){
      const age=elapsed-this.preludeDuration,enter=Math.max(0,1-Math.max(0,age)/.35),leave=Math.max(0,Math.min(1,(this.introDuration-elapsed)/.3));
      style(this.intro,'opacity',String(Math.min(1,elapsed/.12)*(forecast?1:leave)));
      property(this.intro,'--prayer-title-scale',String(this.reducedMotion?1:1+enter*1.8));
      property(this.intro,'--prayer-title-tilt',`${this.reducedMotion?0:Math.sin(Math.max(0,age)*28)*enter*5}deg`);
      hidden(this.introTitle,age<0||!this.develops);
      hidden(this.introPortrait,this.preludeDuration===0);
      data(this.intro,'stage',forecast?forecast.stage:age>=0?'declare':elapsed<1.2?'light':'presence');
      property(this.intro,'--prayer-light-drop',String(Math.min(1,elapsed/1.3)));
      property(this.intro,'--prayer-presence',String(Math.max(0,Math.min(1,(elapsed-.65)/1.1))));
      property(this.intro,'--prayer-aura',String(Math.max(0,Math.min(1,(elapsed-1.35)/1.25))));
      const {width,height}=this.motionSize;
      for(const {node,feather,index} of this.particles){
        const speed=feather?6+index*.17:3.2+(index%7)*.22;
        const age=elapsed-(feather?1.2:0),progress=((Math.max(0,age)/speed+index*.618)%1);
        const x=5+(index*37%90)+Math.sin(elapsed*(feather?.8:1.2)+index)*(feather?5:2);
        style(node,'opacity',String(Math.min(1,Math.max(0,age)/1.3)*(feather?.62:.75)*(this.reducedMotion?.45:1)));
        style(node,'transform',`translate(${x*width/100}px,${(-12+progress*122)*height/100}px) rotate(${index*33+Math.sin(elapsed+index)*28}deg) scale(${feather?.65+(index%4)*.16:.55+(index%5)*.16})`);
      }
      property(this.intro,'--prayer-drift',`${this.reducedMotion?0:Math.sin(elapsed*1.5)*1.5}%`);
    }
    const ascensionTime=elapsed+(this.strongOffset||0);
    const ascending=this.strong&&ascensionTime>=ASCENSION_START;
    data(this.root,'ascension',String(Boolean(ascending)));
    if(this.strong&&ascensionTime>=ASCENSION_START-2)this.ascension?.prepare();
    if(ascending){
      if(!this.ascensionEntered){this.ascensionEntered=true;this.pause();this.releaseVideo();this.releaseIntro();this.releaseVoiceAssets();}
      text(this.caption,'');data(this.root,'step','ascension');
      this.ascension?.update(ascensionTime,{paused,soundOn});return;
    }
    if(introducing){
      text(this.caption,'');data(this.root,'step','intro');
      if(paused){this.pause();return;}
      if(elapsed>=.2&&!this.preludeSeen){this.preludeSeen=true;if(elapsed<.5&&soundOn&&this.preludeDuration>0)this.onPrelude();}
      if(this.develops&&elapsed>=this.preludeDuration+.2&&!this.introSeen){this.introSeen=true;if(elapsed<this.preludeDuration+.4&&soundOn)this.onIntro();}
      if(forecast?.settled&&!this.fizzleSeen){this.fizzleSeen=true;this.onPreludeStop();if(elapsed<forecast.resultAt+.2&&soundOn)this.onFizzle();}
      return;
    }
    if(!this.introEnded){this.introEnded=true;this.onPreludeStop();this.releaseIntro();}
    elapsed=Math.max(0,elapsed-this.introDuration);
    data(this.root,'step',elapsed < 2.5 ? 'call' : elapsed < 5 ? 'prayer' : 'resolve');
    text(this.caption,this.fullChant?(elapsed<3?'ゆあ様へ、祈りを。':elapsed<7.9?'ゆあ様だーい好き':elapsed<10.4?'声に出して、繰り返して。':'祈りは、届く……？'):elapsed < .15 ? 'ゆあ様へ、祈りを。' : elapsed < 4.85 ? 'ゆあ様だーい好き' : pushed ? '届いて……！' : '祈りは、届く？');
    this.showVideoFrame();
    if (paused) { this.pause(); return; }
    const video = this.video;
    if (!this.playBlocked) {
      if(video.readyState>=1&&Number.isFinite(video.duration)){
        const videoTime=this.fullChant&&video.duration>0?elapsed%video.duration:elapsed;
        const target = Math.min(this.seekOnReady??videoTime, Math.max(0, video.duration - .04));
        if (!video.seeking && (this.seekOnReady!==null||Math.abs(video.currentTime - target) > .35)) {
          const correction=this.mediaRetry.seek();
          if(correction==='failed')this.failVideo();
          else if(correction==='seek'){try{video.currentTime=target;this.seekOnReady=null;}catch{}}
        }
      }
      if (!this.playBlocked&&video.paused && !video.ended && !this.pendingPlay&&this.mediaRetry.canPlay()) {
        this.pendingPlay = true;
        const generation = ++this.playGeneration;
        const failed=()=>{if(this.playGeneration===generation&&this.mediaRetry.playFailed())this.failVideo();};
        try{
          Promise.resolve(video.play()).then(()=>{if(this.playGeneration===generation)this.mediaRetry.playSucceeded();},failed)
            .finally(()=>{if(this.playGeneration===generation)this.pendingPlay=false;});
        }catch{failed();if(this.playGeneration===generation)this.pendingPlay=false;}
      }
    }
    const voiceStart=this.fullChant?3:.15;
    const offset = elapsed - voiceStart,voiceBuffer=this.fullChant?this.strongBuffer:this.buffer;
    // A late load or late sound enable must not begin halfway through a word.
    // An already-started voice may resume at its paused simulation position.
    if (!this.voiceStarted && elapsed > voiceStart+.25) this.voiceSkipped = true;
    if (!soundOn || this.context?.state !== 'running') { this.stopVoice(); return; }
    if (this.voice && Math.abs(this.context.currentTime - this.voiceClock + this.voiceOffset - offset) > .25) this.stopVoice();
    if (!this.voice && !this.voiceFinished && !this.voiceSkipped && voiceBuffer && offset >= 0 && offset < voiceBuffer.duration - .04) {
      const source = this.context.createBufferSource(), gain = this.context.createGain();
      source.buffer = voiceBuffer; gain.gain.value = .68;
      source.connect(gain); gain.connect(this.voiceDestination||this.context.destination);
      this.voice = source;this.voiceGain=gain;
      let released=false;
      const release=()=>{if(released)return;released=true;source.onended=null;source.disconnect();gain.disconnect();try{source.buffer=null;}catch{}};
      this.voiceCleanup=release;
      this.voiceStarted = true; this.voiceClock = this.context.currentTime; this.voiceOffset = offset;
      source.onended = () => { if (this.voice === source) { this.voice = null;this.voiceGain=null;this.voiceCleanup=null; this.voiceFinished = true; } release(); };
      source.start(0, offset);
    }
  }
}
