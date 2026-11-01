import {selectAsset} from './asset-variants-v47.js';
/** Song-clock montage: three reusable images; premium cuts crossfade two actors. */
import {premiumMusicEnergy,PREMIUM_LIGHT_DURATION} from './premium-pv-music.js';
export const PV_DURATION=72;
export const PREMIUM_PV_DURATION=114;
// Visuals remain available with sound off, loading, or rejected playback.
export function pvPlaybackClock({song,audioTime=0,audioPlaying=false,phaseElapsed=0}={}){
  if(song?.active&&Number.isFinite(song.time))return Math.max(0,song.time);
  if(audioPlaying&&Number.isFinite(audioTime))return Math.max(0,audioTime);
  return Number.isFinite(phaseElapsed)?Math.max(0,phaseElapsed):0;
}
export const PV_ASSETS=Object.freeze(['room','invitation','full','arm','heart','gaze','beckon','point','kiss','key-ready','key-turn','key-close','palm-ready','palm-impact','reaction'].map(id=>Object.freeze({id,role:id==='room'?'room':'yua',src:`./assets/reaches/layered-v01/pv-${id}-v02.webp`}))); 
export const PREMIUM_PV_ASSETS=Object.freeze([...['tear','call','cry','resolve'].map(id=>[id,34]),...['silence','farewell','vow','relief','dawn','charge','dash','embers','sing','rescue'].map(id=>[id,35])].map(([expression,version])=>Object.freeze({id:`premium-${expression}`,role:'yua',src:`./assets/reaches/layered-v01/pv-premium-${expression}-v${version}.png`})));
const ASSETS=Object.fromEntries([...PV_ASSETS,...PREMIUM_PV_ASSETS].map(asset=>[asset.id,asset]));
export const PV_CROSSFADE_SECONDS=.4;
// Each illustration remains for three seconds; camera, lighting and foreground
// effects create motion within each shot rather than rapid image replacement.
const sequence=[
 ['full','half'],['heart','close'],['arm','half'],['gaze','slit'],
 ['beckon','half'],['point','half'],['kiss','close'],['invitation','wide'],
 ['key-ready','half'],['key-turn','half'],['key-close','close'],['full','wide'],
 ['heart','half'],['arm','close'],['palm-ready','half'],['palm-impact','strike'],
 ['reaction','half'],['full','half'],['beckon','half'],['point','half'],
 ['kiss','close'],['invitation','wide'],['heart','half'],['gaze','slit'],
].map(([id,camera])=>[3,id,camera]);
let boundary=0;
export const PV_CUTS=Object.freeze(sequence.map(([duration,id,camera],index)=>{const cut=Object.freeze({index,id,camera,start:boundary,duration});boundary+=duration;return cut;}));
// Insert between complete original shots: the sword and palm action sequences
// remain intact, with emotional close/half shots punctuating the full montage.
const PREMIUM_INSERTS={
  1:[['silence','half']],2:[['tear','half']],3:[['farewell','half']],
  5:[['vow','half']],6:[['call','close']],7:[['charge','half']],
  11:[['cry','half'],['dash','half']],12:[['embers','close']],
  16:[['rescue','half']],18:[['sing','half']],20:[['resolve','close']],21:[['relief','half']],
};
const premiumSequence=PV_CUTS.flatMap(cut=>[
  ...(PREMIUM_INSERTS[cut.index]||[]).map(([id,camera])=>({id:`premium-${id}`,camera,duration:3})),cut,
]);
premiumSequence.push({id:'premium-dawn',camera:'wide',duration:3});
export const PREMIUM_PV_CUTS=Object.freeze(premiumSequence.map((cut,index)=>Object.freeze({...cut,index,start:index*3})));
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
/** Whole-song escalation, independent of the repeating 114-second picture edit.
 * Pure and bounded so the cabinet lights can share this exact progression.
 */
export function premiumPVProgress(seconds,{duration=PREMIUM_LIGHT_DURATION,reducedMotion=false,energy}={}){
  const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const length=Number.isFinite(duration)&&duration>0?duration:PREMIUM_LIGHT_DURATION;
  const progress=reducedMotion?0:clamp(time/length);
  const music=reducedMotion?0:clamp(Number.isFinite(energy)?energy:premiumMusicEnergy(time));
  const stageIndex=progress>=.82?3:progress>=.55?2:progress>=.25?1:0;
  const growth=smooth(progress);
  // Baseline color keeps building even during quiet passages; music adds the
  // local emphasis. No full-frame white flash or high-gain face wash is used.
  const rainbow=reducedMotion?0:.08+.92*growth;
  return {
    progress,stage:['intro','middle','late','finale'][stageIndex],stageIndex,energy:music,
    brightness:reducedMotion?1:Math.min(1.24,1.02+growth*.11+music*.11),
    roomBrightness:reducedMotion?1:.9+growth*.16+music*.25,
    saturation:reducedMotion?1:1.1+growth*.16,
    rainbow,
    aurora:reducedMotion?0:.07+rainbow*.43+music*.08,
    prism:reducedMotion?0:.025+rainbow*.2+music*.06,
    rays:reducedMotion?0:.17+rainbow*.32+music*.14,
    sparkle:reducedMotion?0:.38+rainbow*.37+music*.15,
    glow:reducedMotion?0:.9+rainbow*1.5+music*.8,
    hue:reducedMotion?0:Math.sin(time*.32)*(5+rainbow*9),
    auroraX:reducedMotion?0:Math.sin(time*.13)*(3+rainbow*5),
    auroraAngle:reducedMotion?0:Math.sin(time*.085)*(4+rainbow*7),
    prismAngle:reducedMotion?0:time*(2+rainbow*2),
  };
}

export function pvFrame(seconds,reducedMotion=false,premium=false){
  const absolute=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const time=absolute%(premium?PREMIUM_PV_DURATION:PV_DURATION);
  const cuts=premium?PREMIUM_PV_CUTS:PV_CUTS;
  if(reducedMotion)return {time:0,index:-1,id:'heart',nextId:null,camera:'half',local:0,duration:Infinity,roomX:0,roomScale:1.08,x:0,y:0,scale:1,angle:0,impact:0,veil:0,theme:'rose',premium:Boolean(premium)};
  let index=cuts.length-1;
  for(let i=0;i<cuts.length;i++)if(time<cuts[i].start+cuts[i].duration-1e-8){index=i;break;}
  const cut=cuts[index],local=Math.max(0,time-cut.start),p=smooth(local/cut.duration);
  const action=cut.id.startsWith('palm')||cut.id==='reaction',key=cut.id.startsWith('key');
  const direction=index%2?1:-1;
  const accent=Math.exp(-local*7)+Math.max(0,1-Math.abs(local-1.55)/.24)*.42;
  const impact=(cut.camera==='strike'?1:.48)*accent;
  return {time,index,id:cut.id,nextId:cuts[(index+1)%cuts.length].id,camera:cut.camera,local,duration:cut.duration,
    roomX:Math.sin(absolute*.32)*8,roomScale:1.18+Math.cos(absolute*.21)*.055,
    x:direction*(p-.5)*9+(action?impact*3:0),y:Math.sin(local*1.3)*2.4+(action?-impact*2:0),
    scale:cut.camera==='close'?1.12+p*.16:cut.camera==='wide'?1+p*.1:1.04+p*.13+impact*.06,
    angle:direction*Math.sin(local*1.25)*1.6+(action?impact*-2:0),impact,veil:(1-smooth(local/.2))*.5,
    theme:action||cut.id==='premium-cry'?'violet':key||cut.id==='premium-resolve'?'mint':'rose',premium:Boolean(premium)};
}

export class JackpotPV{
  constructor(root){
    this.root=root;root.classList.add('jackpot-pv');root.setAttribute('aria-hidden','true');root.hidden=true;
    this.lastFrame=null;this.lastProgress=null;this.prepared=false;this.ready=null;this._renderKey=null;this.fade=null;
    this.mobile=root.ownerDocument.documentElement?.dataset.renderQuality==='mobile';this.lowLoad=root.ownerDocument.documentElement?.dataset.qualityPreset==='light';this._requestedActive=false;this._lifecycle=0;this._styles=new WeakMap();
    const create=(role)=>{const node=root.ownerDocument.createElement('img');node.className=`jackpot-pv__${role}`;node.alt='';node.decoding='async';node.draggable=false;return {node,id:null,loaded:false,version:0,ready:null,cancel:null};};
    this.room=create('room');this.front=create('actor');this.spare=create('actor');
    root.append(this.room.node,this.front.node);
    this.effects={};
    for(const name of ['aurora','prism','rays','ribbon','sparks','shockwave','sweep','shade']){const node=root.ownerDocument.createElement('div');node.className=`jackpot-pv__${name}`;root.append(node);this.effects[name]=node;}
    this.images=[this.room.node,this.front.node];
  }

  _style(node,key,value){
    let cached=this._styles.get(node);if(!cached){cached=new Map();this._styles.set(node,cached);}
    if(cached.get(key)===value)return;cached.set(key,value);
    if(key.startsWith('--'))node.style.setProperty(key,value);else node.style[key]=value;
  }
  _data(node,key,value){if(node.dataset[key]!==value)node.dataset[key]=value;}
  _release(slot){
    slot.cancel?.();slot.version++;slot.id=null;slot.loaded=false;slot.ready=null;slot.cancel=null;
    slot.node.onload=slot.node.onerror=null;slot.node.hidden=true;slot.node.removeAttribute?.('src');
    if(slot.node.style.transform)slot.node.style.transform='';slot.node.style.opacity='';this._styles.delete(slot.node);
  }

  _load(slot,id){
    if(slot.id===id)return slot.ready;
    slot.cancel?.();slot.id=id;slot.loaded=false;const version=++slot.version;
    slot.ready=new Promise(resolve=>{
      let settled=false;
      const finish=ok=>{
        if(settled)return;settled=true;
        if(version===slot.version){slot.loaded=ok;slot.node.onload=slot.node.onerror=null;slot.cancel=null;}
        resolve(ok&&version===slot.version);
      };
      slot.cancel=()=>finish(false);
      const image=slot.node;
      image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=selectAsset(ASSETS[id].src,this.root.ownerDocument);
      if(typeof image.decode==='function'){
        try{image.decode().then(()=>finish(true),()=>{if(image.complete)finish(image.naturalWidth>0);});}
        catch{if(image.complete)finish(image.naturalWidth>0);}
      }else if(image.complete)finish(image.naturalWidth>0);
    });
    return slot.ready;
  }

  prepare(seconds=0,reducedMotion=false,premium=false){
    const frame=pvFrame(seconds,reducedMotion,premium);
    this._load(this.room,'room');
    if(!this.front.id)this._load(this.front,frame.id);
    if(!this.ready){const lifecycle=this._lifecycle;this.ready=Promise.all([this.room.ready,this.front.ready]).then(results=>{if(lifecycle!==this._lifecycle)return false;this.prepared=true;return results.some(Boolean);});}
    return this.ready;
  }

  _detach(slot){if(slot.node.parentNode===this.root)this.root.removeChild(slot.node);}

  _finishFade(){
    if(!this.fade)return;
    this._style(this.front.node,'opacity','1');this._style(this.spare.node,'opacity','0');
    this._detach(this.spare);this.fade=null;this.images=[this.room.node,this.front.node];
  }

  _select(id,nextId,clock,premium,reducedMotion){
    if(this.fade&&(reducedMotion||!premium||clock<this.fade.at||clock-this.fade.at>=PV_CROSSFADE_SECONDS||id!==this.front.id))this._finishFade();
    if(this.front.id!==id){
      this._load(this.spare,id);
      if(this.spare.loaded){
        const canFade=premium&&!reducedMotion&&this.front.loaded&&!this.root.hidden;
        if(canFade){
          // Both images keep their own crop and transform until the outgoing
          // image is detached. Its source is never replaced while visible.
          this.root.append(this.spare.node);
          [this.front,this.spare]=[this.spare,this.front];
          this._style(this.front.node,'opacity','0');this._style(this.spare.node,'opacity','1');
          this.fade={at:clock};this.images=[this.room.node,this.front.node,this.spare.node];
        }else{
          this.root.replaceChild(this.spare.node,this.front.node);
          [this.front,this.spare]=[this.spare,this.front];
          this.images=[this.room.node,this.front.node];this._style(this.front.node,'opacity','1');
        }
      }
    }
    // No cache growth: the outgoing node becomes the single preloader after
    // its fade completes. A late decode simply leaves the old image intact.
    if(!this.fade&&this.front.id===id&&this.front.loaded&&nextId&&nextId!==id)this._load(this.spare,nextId);
  }

  update(seconds,{active=false,paused=false,reducedMotion=false,premium=false}={}){
    if(!active||!Number.isFinite(seconds)){this.stop();return false;}
    if(paused)return !this.root.hidden;
    this._requestedActive=true;this.prepare(seconds,reducedMotion,premium);
    const clock=Math.floor(Math.max(0,seconds)*30)/30,pose=pvFrame(clock,reducedMotion,premium);
    this._select(pose.id,pose.nextId,clock,premium,reducedMotion);
    if(!this.room.loaded&&!this.front.loaded)return false;
    if(this.root.hidden)this.root.hidden=false;
    const key=`${reducedMotion?'still':clock}:${premium}:${this.front.id}:${this.front.loaded}:${this.room.loaded}`;
    if(this._renderKey===key)return true;
    this._renderKey=key;
    this._data(this.root,'shot',this.front.loaded?this.front.id:pose.id);
    // A slow next image retains the previous pose's crop, rather than fitting
    // the old portrait into a different character frame while it loads.
    if(this.front.id===pose.id||!this.root.dataset.camera){
      this._data(this.root,'camera',pose.camera);
      this._data(this.root,'theme',pose.theme);
    }
    this._data(this.root,'reduced',String(Boolean(reducedMotion)));
    this._data(this.root,'premium',String(Boolean(premium)));
    this._data(this.root,'current',this.front.loaded?this.front.id:'');
    if(this.room.node.hidden===this.room.loaded)this.room.node.hidden=!this.room.loaded;if(this.front.node.hidden===this.front.loaded)this.front.node.hidden=!this.front.loaded;
    this._style(this.room.node,'transform',`translate3d(${pose.roomX.toFixed(3)}%,0,0) scale(${pose.roomScale.toFixed(3)})`);
    if(this.front.id===pose.id){
      this._data(this.front.node,'shot',pose.id);this._data(this.front.node,'camera',pose.camera);
      this._style(this.front.node,'transform',`translate3d(${pose.x.toFixed(3)}%,${pose.y.toFixed(3)}%,0) rotate(${pose.angle.toFixed(3)}deg) scale(${pose.scale.toFixed(3)})`);
    }
    const mix=this.fade?smooth((clock-this.fade.at)/PV_CROSSFADE_SECONDS):1;
    this._style(this.front.node,'opacity',String(mix));
    if(this.fade)this._style(this.spare.node,'opacity',String(1-mix));
    const progression=premium?premiumPVProgress(clock,{reducedMotion}):null;
    this.lastProgress=progression;
    if(progression)this._data(this.root,'progressStage',progression.stage);else if('progressStage' in this.root.dataset)delete this.root.dataset.progressStage;
    // Dynamic variables belong to the actual painted leaf. Inheriting them
    // from the scene root invalidated all images and every decoration per tick.
    const set=(node,name,value)=>this._style(node,`--pv-${name}`,String(value));
    const fx=this.effects;
    // A single grading declaration avoids four separate style invalidations
    // per actor. Mobile keeps the same color grading without the glow pass.
    for(const actor of this.fade?[this.front.node,this.spare.node]:[this.front.node]){
      const grading=progression&&!this.lowLoad?(reducedMotion&&!this.mobile?'none':`brightness(${progression.brightness}) saturate(${progression.saturation}) hue-rotate(${progression.hue}deg)${this.mobile?'':` drop-shadow(0 0 ${progression.glow}cqw var(--pv-ink))`}`):'';
      this._style(actor,'filter',grading);
    }
    this._style(this.room.node,'filter',progression&&!reducedMotion&&!this.lowLoad?`brightness(${progression.roomBrightness}) saturate(${1.1+progression.rainbow*.32})`:'');
    if(progression&&!reducedMotion){
      if(!this.lowLoad){
        set(fx.prism,'prism',progression.prism);set(fx.prism,'prism-angle',`${progression.prismAngle}deg`);
        set(fx.sparks,'sparkle',progression.sparkle);set(fx.sparks,'rainbow',progression.rainbow);
        set(fx.ribbon,'rainbow',progression.rainbow);set(fx.shockwave,'rays',progression.rays);
      }
      set(fx.aurora,'aurora',progression.aurora);set(fx.aurora,'aurora-x',`${progression.auroraX}%`);
      set(fx.aurora,'aurora-angle',`${progression.auroraAngle}deg`);
      set(fx.rays,'rays',progression.rays);set(fx.sweep,'rainbow',progression.rainbow);
    }
    set(fx.shade,'veil',pose.veil.toFixed(3));
    if(!reducedMotion){
      set(fx.rays,'impact',pose.impact.toFixed(3));set(fx.rays,'orbit',`${clock*18}deg`);
      if(!premium)set(fx.rays,'power',.24+Math.sin(clock*3.4)**2*.3+pose.impact*.4);
      set(fx.sweep,'sweep',`${-120+(pose.local/pose.duration)*270}%`);
      if(!this.lowLoad){
        set(fx.sparks,'orbit',`${clock*18}deg`);set(fx.shockwave,'ring',.4+(pose.local%1.5)*1.5);
        if(!premium)set(fx.shockwave,'power',.24+Math.sin(clock*3.4)**2*.3+pose.impact*.4);
        set(fx.ribbon,'travel',`${(Math.sin(clock*.42)*12).toFixed(3)}%`);
      }
    }
    this.lastFrame=pose;
    return true;
  }
  stop(){
    if(this.root.hidden&&!this.lastFrame&&!this.fade&&!this._renderKey&&!this._requestedActive)return;
    const release=this.mobile&&this._requestedActive;this._requestedActive=false;
    this.root.hidden=true;this.lastFrame=null;this.lastProgress=null;this._renderKey=null;this._finishFade();
    for(const key of ['shot','camera','theme','reduced','current','premium','progressStage'])delete this.root.dataset[key];
    // Remove scoped grading too, so ordinary/reduced playback never inherits
    // the previous premium song's color after reset or a late decode.
    for(const node of [this.room.node,this.front.node,this.spare.node,...Object.values(this.effects)]){
      const cache=this._styles.get(node);
      if(cache)for(const key of cache.keys())if(key.startsWith('--pv-')){
        if(node.style.removeProperty)node.style.removeProperty(key);else delete node.style[key];
      }
    }
    for(const node of [this.room.node,this.front.node,this.spare.node])this._style(node,'filter','');
    this._style(this.front.node,'opacity','1');this._style(this.spare.node,'opacity','0');
    this._styles=new WeakMap();
    if(release){this._lifecycle++;for(const slot of [this.room,this.front,this.spare])this._release(slot);this.ready=null;this.prepared=false;}
  }
  reset(){this.stop();}
}
