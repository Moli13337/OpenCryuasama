import {decodeAudioQueued} from './audio-decode-queue.js';

const IDS = ['versus-1','versus-2','slow-motion','energy','spotlight','dark-magic','thunder','magic-circle','aura','reward','reflect','crack'];

const EXTRA_IDS = ['hot-hold','frame-prepare','apex-face','sword-arrival','sword-heavy','confirmed-success','spam-alert','round-call'];
const NEW_IDS=['miss-bite','heartbeat','miss-shatter','question','versus-upgrade','text-arrival','foreboding','inspiration'];
export const SOUND_PRESETS=Object.freeze({
  'faith-metal-hit':Object.freeze({src:'assets/audio/pachinko-user-v21/faith-metal-hit.mp3',playbackRate:1}),
  'prayer-sparkle':Object.freeze({src:'assets/audio/pachinko-user-v17/prayer-sparkle.mp3',playbackRate:1}),
  'poison-magic':Object.freeze({src:'assets/audio/pachinko-user-v17/poison-magic.mp3',playbackRate:1.15}),
});
export const SOUND_COUNT = IDS.length+EXTRA_IDS.length+NEW_IDS.length+Object.keys(SOUND_PRESETS).length;
const ALL_IDS=Object.freeze([...IDS,...EXTRA_IDS,...NEW_IDS,...Object.keys(SOUND_PRESETS)]);
export const SFX_COMMON=Object.freeze(['faith-metal-hit','poison-magic','heartbeat','reward','reflect','hot-hold']);
export const SFX_CACHE_BYTES=28*1024*1024;
const REACH_BASE=['slow-motion','text-arrival','miss-bite','miss-shatter','crack','thunder','frame-prepare'];
const DEVELOPMENT=['energy','versus-upgrade','inspiration','foreboding'];
const BONUS=['spotlight','dark-magic','thunder','apex-face','sword-arrival','confirmed-success','energy','aura','sword-heavy','round-call','frame-prepare','crack'];
const SCENE_SOUNDS=Object.freeze({
  normal:[],
  standard:[...REACH_BASE,'versus-2','question','spam-alert','spotlight','energy'],
  shutter:[...REACH_BASE,'energy','aura'],
  prayer:[...REACH_BASE,'prayer-sparkle','magic-circle','aura','sword-heavy'],
  judgment:[...REACH_BASE,...DEVELOPMENT,'sword-arrival','sword-heavy','confirmed-success'],
  promise:[...REACH_BASE,...DEVELOPMENT,'spotlight','aura','sword-arrival','sword-heavy'],
  allure:[...REACH_BASE,...DEVELOPMENT,'spotlight'],
  tribute:[...REACH_BASE,...DEVELOPMENT,'spotlight'],
  spam:[...REACH_BASE,'spam-alert','energy','versus-2','question'],
  temptation:[...REACH_BASE,'spotlight','energy','versus-2','question'],
  taunt:[...REACH_BASE,...DEVELOPMENT,'spotlight'],
  mode:['energy','aura','sword-heavy','thunder','frame-prepare','sword-arrival'],
  bonus:BONUS,blessing:BONUS,queen:BONUS,awakening:BONUS,
});
export function soundsForScene(scene='normal',options={}){
  let selected=SCENE_SOUNDS[scene];
  if(!selected)return [...ALL_IDS];
  // A known non-ascension prayer cannot emit these three descent-only cues.
  // Older saves and preview callers without branch flags retain full preparation.
  if(scene==='prayer'&&(options?.prayerDevelops===false||options?.prayerAscension===false))
    selected=selected.filter(id=>!['magic-circle','aura','sword-heavy'].includes(id));
  // Bonus cues are prepared at confirmed victory, not for the entire reach.
  return [...new Set([...SFX_COMMON,...selected])];
}
const pcmBytes=buffer=>Number.isFinite(buffer?.length)&&Number.isFinite(buffer?.numberOfChannels)?buffer.length*buffer.numberOfChannels*4:0;

// User-supplied originals are kept separately. No delayed playback after loading.
export class SoundEffects {
  constructor(context,{destination=context.destination,maxDecodedBytes=SFX_CACHE_BYTES,idleDecodedBytes=8*1024*1024,releaseUnused=false}={}) {
    this.context=context; this.buffers=new Map(); this.voices=[]; this.last=new Map(); this.enabled=false;
    this.releaseUnused=releaseUnused;this.selective=false;this.encoded=new Map();this.fetching=new Map();this.decoding=new Map();this.activeVoices=new Set();
    this.wanted=new Set(SFX_COMMON);this.used=new Map();this.useClock=0;this.sceneGeneration=0;this.scene='normal';
    this.maxDecodedBytes=Number.isFinite(maxDecodedBytes)?Math.max(0,maxDecodedBytes):SFX_CACHE_BYTES;
    this.idleDecodedBytes=Math.min(this.maxDecodedBytes,Number.isFinite(idleDecodedBytes)?Math.max(0,idleDecodedBytes):8*1024*1024);
    this.master=context.createGain(); this.master.gain.value=.7;
    this.limiter=context.createDynamicsCompressor();
    this.limiter.threshold.value=-10; this.limiter.knee.value=12;
    this.limiter.ratio.value=8; this.limiter.attack.value=.003; this.limiter.release.value=.18;
    this.master.connect(this.limiter); this.limiter.connect(destination);
  }
  load({selective=false}={}) {
    if(this.loading)return this.loading;
    this.selective=Boolean(selective);
    if(!this.selective)return this.loading=Promise.all(ALL_IDS.map(id=>this.ensure(id))).then(()=>this.buffers.size);
    // Compressed originals are only about 2 MB. Keep these ready so scene
    // preparation needs no network request, while decoding only useful cues.
    const fetched=Promise.all(ALL_IDS.map(id=>this.fetchEncoded(id).catch(error=>this.warn(id,error))));
    const prepared=this.prepareScene(this.scene);
    return this.loading=Promise.all([fetched,prepared]).then(()=>this.buffers.size);
  }
  warn(id,error){console.warn(`効果音 ${id} を読み込めませんでした`,error);}
  fetchEncoded(id){
    if(this.encoded.has(id))return Promise.resolve(this.encoded.get(id));
    if(this.fetching.has(id))return this.fetching.get(id);
    const task=(async()=>{
      const response=await fetch(SOUND_PRESETS[id]?.src??`assets/audio/${NEW_IDS.includes(id)?'pachinko-user-v03':EXTRA_IDS.includes(id)?'pachinko-user-v02':'pachinko-user-v01'}/${id}.mp3`);
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const bytes=await response.arrayBuffer();if(this.selective)this.encoded.set(id,bytes);return bytes;
    })();
    this.fetching.set(id,task);const clear=()=>{if(this.fetching.get(id)===task)this.fetching.delete(id);};task.then(clear,clear);return task;
  }
  ensure(id){
    if(this.buffers.has(id)){this.used.set(id,++this.useClock);return Promise.resolve(true);}
    if(this.decoding.has(id))return this.decoding.get(id);
    const task=(async()=>{
      try{
        const bytes=await this.fetchEncoded(id);
        if(this.selective&&!this.wanted.has(id))return false;
        // decodeAudioData detaches its input; retain the tiny compressed source.
        const buffer=await decodeAudioQueued(this.context,this.selective?bytes.slice(0):bytes,{isCurrent:()=>!this.selective||this.wanted.has(id)});
        if(!buffer||(this.selective&&!this.wanted.has(id)))return false;
        this.buffers.set(id,buffer);this.used.set(id,++this.useClock);this.trim();return true;
      }catch(error){this.warn(id,error);return false;}
    })();
    this.decoding.set(id,task);const clear=()=>{if(this.decoding.get(id)===task)this.decoding.delete(id);};task.then(clear,clear);return task;
  }
  prepareScene(scene='normal',options={}){
    if(!this.selective)return this.load();
    const ids=soundsForScene(scene,options),key=ids.join('|');
    if(key===this.sceneKey)return this.preparing||Promise.resolve(this.buffers.size);
    this.scene=scene;this.sceneKey=key;this.wanted=new Set(ids);const generation=++this.sceneGeneration;
    this.trim();
    // Submit at most one new effect decode at a time. If the next scene changes
    // while awaiting a job, discard the obsolete remainder before it decodes.
    const task=(async()=>{
      for(const id of ids){if(generation!==this.sceneGeneration)break;await this.ensure(id);}
      this.trim();return this.buffers.size;
    })();
    this.preparing=task;task.then(()=>{if(this.preparing===task)this.preparing=null;});return task;
  }
  trim(){
    if(!this.selective)return;
    const active=new Set([...this.activeVoices].map(voice=>voice.id));
    const budget=this.scene==='normal'?this.idleDecodedBytes:this.maxDecodedBytes;
    let total=[...this.buffers.values()].reduce((sum,buffer)=>sum+pcmBytes(buffer),0);
    for(const id of [...this.buffers.keys()].sort((a,b)=>(this.used.get(a)||0)-(this.used.get(b)||0))){
      if(!this.releaseUnused&&total<=budget)break;
      // Never evict the prepared scene or a still-playing source. A protected
      // working set can exceed the target; preserving its timing takes priority.
      if(this.wanted.has(id)||active.has(id))continue;
      total-=pcmBytes(this.buffers.get(id));this.buffers.delete(id);this.used.delete(id);
    }
  }
  get cacheStats(){
    return {selective:this.selective,scene:this.scene,decodedSounds:this.buffers.size,
      decodedBytes:[...this.buffers.values()].reduce((sum,b)=>sum+pcmBytes(b),0),
      encodedBytes:[...this.encoded.values()].reduce((sum,b)=>sum+b.byteLength,0),
      pendingDecodes:this.decoding.size,preparedSounds:this.wanted.size,maxDecodedBytes:this.maxDecodedBytes,idleDecodedBytes:this.idleDecodedBytes};
  }
  setEnabled(value) { this.enabled=Boolean(value); if(!this.enabled)this.stop(); }
  releaseVoice(voice,stop=false){
    if(voice.released)return;
    voice.released=true;voice.source.onended=null;
    this.voices=this.voices.filter(item=>item!==voice);this.activeVoices.delete(voice);
    if(stop)try{voice.source.stop();}catch{}
    voice.source.disconnect();voice.volume.disconnect();
    try{voice.source.buffer=null;}catch{}
  }
  stop(lane) {
    let stopped=false;
    for(const voice of [...this.voices])if(!lane||voice.lane===lane){this.releaseVoice(voice,true);stopped=true;}
    if(stopped)this.trim();
  }
  play(id,{gain=.65,lane='accent',cooldown=0,offset=0,duration,playbackRate}={}) {
    if(!this.enabled||this.context.state!=='running'||!this.buffers.has(id))return false;
    const rate=playbackRate??SOUND_PRESETS[id]?.playbackRate??1;
    if(!Number.isFinite(rate)||rate<.25||rate>4)return false;
    const now=this.context.currentTime,buffer=this.buffers.get(id);
    if(now-(this.last.get(id)??-Infinity)<cooldown)return false;
    this.last.set(id,now);
    this.used.set(id,++this.useClock);
    if(lane==='scene'||lane==='prompt'||lane==='heartbeat'||lane==='result')this.stop(lane);
    while(this.voices.length>=6)this.releaseVoice(this.voices[0],true);
    const source=this.context.createBufferSource(),volume=this.context.createGain();
    source.buffer=buffer;source.playbackRate.value=rate;volume.gain.value=gain;
    source.connect(volume);volume.connect(this.master);
    const voice={id,source,volume,lane};this.voices.push(voice);this.activeVoices.add(voice);
    source.onended=()=>{this.releaseVoice(voice);this.trim();};
    // Offset and duration retain AudioBufferSource semantics: source seconds,
    // not wall-clock seconds. Changing rate never modifies the shared buffer.
    try{
      if(Number.isFinite(duration)&&duration>0)source.start(0,Math.max(0,offset),duration);else source.start(0,Math.max(0,offset));return true;
    }catch(error){this.releaseVoice(voice,true);this.trim();this.warn(id,error);return false;}
  }
}
