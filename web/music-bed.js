import {MediaRetryGuard} from './media-retry.js';
export const MUSIC_TRACKS = Object.freeze({
  normal: { src:'assets/audio/d-elf-v01/broadcast.mp3', title:'Broadcast / Free BGM Ver.1', volume:.13 },
  reach: { src:'assets/audio/d-elf-v01/flash-forward.mp3', title:'Flash-forward / Dubstep remix Demo Free BGM Ver.', volume:.19 },
  rush: { src:'assets/audio/d-elf-v01/effective-breakthrough.mp3', title:'Effective Breakthrough / Free BGM Ver.', volume:.25 },
  shadow: { src:'assets/audio/d-elf-v01/shadow-driver.mp3', title:'SHADOW DRIVER ver.2 / TRANCE', volume:.25 },
  answer: { src:'assets/audio/d-elf-v01/code-answer.mp3', title:'Code: Answer - rebirth Ver.1', volume:.25 },
});

// One streaming player avoids decoding every complete song into PCM memory.
export class MusicBed {
  constructor(media, credit) {
    this.media=media;this.credit=credit;this.track=null;this.generation=0;this.pending=false;this.blocked=false;this.ended=false;
    this.rushChoice='shadow';this.normalChoice='normal';this.level=1;
    this._outputVolume=0;this.outputGain=null;this.mediaSource=null;
    this.mediaRetry=new MediaRetryGuard();this.wasInactive=false;
    media.loop=true;media.preload='none';media.volume=0;
    media.addEventListener('ended',()=>{this.ended=true;});
    media.addEventListener('error',()=>{if(this.track)this.fail();});
  }
  // iOS controls HTMLMediaElement.volume at the device level. Route the
  // streaming element through one Web Audio gain without decoding the song.
  connectAudio(context){
    if(this.outputGain)return true;
    if(typeof context?.createMediaElementSource!=='function'||typeof context?.createGain!=='function')return false;
    const gain=context.createGain();gain.gain.value=this._outputVolume;
    const source=context.createMediaElementSource(this.media);
    source.connect(gain);gain.connect(context.destination);
    this.mediaSource=source;this.outputGain=gain;
    this.media.volume=1;
    return true;
  }
  get outputVolume(){return this._outputVolume;}
  getOutputVolume(){return this._outputVolume;}
  setOutputVolume(value){
    const volume=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
    if(this._outputVolume===volume)return volume;
    this._outputVolume=volume;
    if(this.outputGain)this.outputGain.gain.value=volume;
    else this.media.volume=volume;
    return volume;
  }
  setCreditHidden(hidden){if(this.credit.hidden!==hidden)this.credit.hidden=hidden;}
  pause(){this.generation++;this.pending=false;this.mediaRetry.reset();this.media.pause();}
  releaseStream(){if(this.media.getAttribute?.('src')){this.media.removeAttribute('src');this.media.load();}}
  fail(){
    if(this.blocked)return;
    this.blocked=true;this.pause();this.setOutputVolume(0);this.setCreditHidden(true);this.releaseStream();
  }
  stop(){
    this.pause();this.media.currentTime=0;this.setOutputVolume(0);this.track=null;this.ended=false;this.setCreditHidden(true);
    // Pause retains a song for resume; an explicit stop starts the next track
    // afresh, so its old stream/decoder has no further owner.
    this.releaseStream();
  }
  update(state,dt){
    const {enabled=false,paused=false,kind='normal',duck=false,gainScale=1,rewardTarget=0}=state;
    if(!enabled||paused){if(!this.media.paused||this.pending)this.pause();this.wasInactive=true;this.setCreditHidden(true);return;}
    if(this.wasInactive){this.wasInactive=false;this.mediaRetry.reset();if(this.blocked)this.track=null;}
    let selection=kind==='awakening'?(rewardTarget===10000?'answer':'rush'):kind==='challenge'?'rush':kind==='rush'?this.rushChoice:kind==='normal'?this.normalChoice:kind;
    if(selection==='answer'&&!(kind==='awakening'&&rewardTarget===10000))selection=kind==='rush'?'shadow':'normal';
    const track=MUSIC_TRACKS[selection]||MUSIC_TRACKS.normal;
    if(this.track!==track){
      this.pause();this.track=track;this.blocked=false;this.ended=false;this.media.src=track.src;this.setOutputVolume(0);
      this.credit.querySelector('[data-track-name]').textContent=track.title;
    }
    const looping=kind!=='awakening';if(this.media.loop!==looping)this.media.loop=looping;
    if(this.blocked){this.setCreditHidden(true);return;}
    const target=(duck?.035:track.volume)*this.level*Math.max(0,Math.min(1,gainScale));
    this.setOutputVolume(this._outputVolume+(target-this._outputVolume)*Math.min(1,dt*5));
    if(this.media.paused&&!this.pending&&!this.blocked&&!this.ended&&this.mediaRetry.canPlay()){
      const generation=++this.generation;this.pending=true;
      const failed=()=>{if(this.generation===generation&&this.mediaRetry.playFailed())this.fail();};
      try{
        Promise.resolve(this.media.play()).then(()=>{if(this.generation===generation)this.mediaRetry.playSucceeded();},failed)
          .finally(()=>{if(this.generation===generation)this.pending=false;});
      }catch{failed();if(this.generation===generation)this.pending=false;}
    }
    this.setCreditHidden(this.blocked||this.media.paused);
  }
}
