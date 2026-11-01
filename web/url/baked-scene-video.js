const SEEK_EPSILON=.045,DRIFT_LIMIT=.35,END_MARGIN=.04,MAX_CORRECTIONS=6;

/** One silent native video; a false update result leaves the live art in charge. */
export class BakedSceneVideo {
  constructor(parent,{src,start=15,end=44,className='baked-scene-video',onFrameReady=null,onFailure=null}={}){
    if(typeof src!=='string'||!src||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new TypeError('Invalid baked scene');
    this.src=src;this.start=start;this.end=end;this.generation=0;
    this.onFrameReady=typeof onFrameReady==='function'?onFrameReady:null;this.notifyingFrame=false;
    this.onFailure=typeof onFailure==='function'?onFailure:null;
    this.video=parent.ownerDocument.createElement('video');this.root=this.video;
    const v=this.video;v.className=className;v.muted=true;v.defaultMuted=true;v.playsInline=true;v.loop=false;v.preload='auto';v.controls=false;v.disablePictureInPicture=true;
    v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');v.hidden=true;
    parent.append(v);this._clear();this._publish('idle',false);
  }
  _clear(){
    this.prepared=false;this.mediaAttached=false;this.failed=false;this.synced=false;this.lastElapsed=null;this.notifiedFrame=null;
    this.seekTarget=null;this.seekResolved=false;this.corrections=0;this.lastCorrection=-Infinity;
    this.playToken=(this.playToken||0)+1;this.playPending=false;this.playRequested=false;this.wantRunning=false;
  }
  _publish(status,visible){
    if(this.video.dataset.bakedVideo!==status)this.video.dataset.bakedVideo=status;
    if(this.video.hidden===visible)this.video.hidden=!visible;
    return visible;
  }
  _stopPlayback(){
    this.wantRunning=false;
    if(this.playRequested||this.playPending||!this.video.paused){
      this.playToken++;this.playPending=false;this.playRequested=false;
      try{this.video.pause();}catch{}
    }
  }
  _releaseMedia(){
    this.generation++;const v=this.video;v.onerror=null;v.onseeked=null;v.onloadeddata=null;
    v.removeAttribute('src');v.removeAttribute('poster');
    if(this.mediaAttached){this.mediaAttached=false;try{v.load();}catch{}}
  }
  _fail(){
    if(this.failed)return this._publish('error',false);
    this.failed=true;this._stopPlayback();this._releaseMedia();this._publish('error',false);
    this.onFailure?.({elapsed:this.lastElapsed,paused:true,video:this.video});
    return false;
  }
  _notifyFrameReady(generation){
    const v=this.video;
    if(generation!==this.generation||!this.prepared||this.failed||!this.onFrameReady||this.notifyingFrame||this.lastElapsed===null||!v.hidden||v.seeking||v.readyState<2||!v.videoWidth||!v.videoHeight)return;
    if(this.seekTarget!==null&&!this.seekResolved)return;
    const frame=`${generation}:${this.corrections}:${v.currentTime}`;
    if(this.notifiedFrame===frame)return;
    this.notifiedFrame=frame;this.notifyingFrame=true;
    // A paused game may have no RAF updates left after seeking. Ask its owner
    // to repaint only when the replacement frame is actually available.
    try{this.onFrameReady({elapsed:this.lastElapsed,paused:!this.wantRunning||v.paused,video:v});}finally{this.notifyingFrame=false;}
  }
  prepare(){
    if(this.prepared)return !this.failed;
    this.prepared=true;const generation=++this.generation,v=this.video;
    v.onerror=()=>{if(generation===this.generation&&this.prepared)this._fail();};
    v.onseeked=()=>{
      if(generation!==this.generation)return;
      if(this.seekTarget!==null)this.seekResolved=true;
      this._notifyFrameReady(generation);
    };
    v.onloadeddata=()=>this._notifyFrameReady(generation);
    this._publish('loading',false);
    try{this.mediaAttached=true;v.src=this.src;v.load();return true;}catch{return this._fail();}
  }
  _play(){
    this.wantRunning=true;
    if(this.playRequested||this.failed)return;
    this.playRequested=true;this.playPending=true;
    const generation=this.generation,token=++this.playToken;
    const current=()=>generation===this.generation&&token===this.playToken&&this.prepared&&this.wantRunning;
    try{
      Promise.resolve(this.video.play()).then(()=>{if(current())this.playPending=false;},()=>{if(current())this._fail();});
    }catch{if(current())this._fail();}
  }
  _seek(target,elapsed){
    if(this.corrections>=MAX_CORRECTIONS)return this._fail();
    this.corrections++;this.lastCorrection=elapsed;this.seekTarget=target;this.seekResolved=false;this.synced=false;
    this._publish('seeking',false);
    try{this.video.currentTime=target;}catch{return this._fail();}
    // Even a synchronously changed currentTime can still expose the old frame.
    // Wait for seeked plus HAVE_CURRENT_DATA before allowing the overlay back.
    return false;
  }
  update(elapsed,{paused=false}={}){
    const v=this.video;
    if(!Number.isFinite(elapsed)){this._stopPlayback();return this._publish('invalid',false);}
    if(elapsed<this.start){this._stopPlayback();this.lastElapsed=null;this.synced=false;return this._publish('before',false);}
    if(!this.prepared)this.prepare();
    if(this.failed||v.error)return this._fail();
    const duration=Number.isFinite(v.duration)&&v.duration>0?Math.min(this.end-this.start,v.duration):this.end-this.start;
    const local=elapsed-this.start,target=Math.max(0,Math.min(local,duration-END_MARGIN));
    const finished=elapsed>=this.end||local>=duration-END_MARGIN;
    const stationary=this.lastElapsed!==null&&Math.abs(elapsed-this.lastElapsed)<1e-8;
    const shouldPause=paused||stationary||finished;this.lastElapsed=elapsed;
    if(shouldPause)this._stopPlayback();else this._play();
    if(this.failed)return false;
    if(v.readyState<1)return this._publish('loading',false);
    if(this.seekTarget!==null){
      if(v.seeking||!this.seekResolved||v.readyState<2)return this._publish('seeking',false);
      this.seekTarget=null;this.seekResolved=false;this.synced=true;
    }
    if(v.seeking)return this._publish('seeking',false);
    const drift=Math.abs(v.currentTime-target);
    if(!this.synced){
      if(drift>SEEK_EPSILON)return this._seek(target,elapsed);
      this.synced=true;
    }else if(drift>(finished?.005:DRIFT_LIMIT)){
      if(!finished&&elapsed>=this.lastCorrection&&elapsed-this.lastCorrection<1)return this._publish('lagging',false);
      return this._seek(target,elapsed);
    }
    if(v.readyState<2||!v.videoWidth||!v.videoHeight)return this._publish('loading',false);
    return this._publish(finished?'held':shouldPause?'paused':'playing',true);
  }
  pause(){
    this._stopPlayback();
    if(!this.video.hidden)this._publish('paused',true);
  }
  reset(){
    this._stopPlayback();this._releaseMedia();
    this._clear();this._publish('idle',false);
  }
}
