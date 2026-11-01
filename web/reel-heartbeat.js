// Source: user-supplied 心臓の鼓動1.mp3, duration measured with ffprobe.
// Peaks were measured from 5 ms RMS windows, not inferred from a nominal BPM.
export const HEARTBEAT_PROFILE=Object.freeze({
  duration:3.872154,attack:.045,decay:.21,
  peaks:Object.freeze([
    [.046281,.003152,1],[.362109,.307596,.65],
    [1.043832,1.000272,1],[1.359773,1.317596,.65],
    [1.982290,1.939161,1],[2.298095,2.243583,.65],
    [2.979819,2.936281,1],[3.295760,3.253605,.65],
  ].map(([at,onset,strength])=>Object.freeze({at,onset,attack:at-onset,strength}))),
});
export const HEARTBEAT_MAX_START_LATENESS=.2;
const NEUTRAL=Object.freeze({active:false,scale:1,brightness:1,pulse:0,sourceTime:0,cycle:-1});

// Pure sampling makes visual timing independent of render rate. peak.at is the
// audio source position: the source is never stretched to an approximate BPM.
export function heartbeatPulse(sourceTime,{reducedMotion=false,profile=HEARTBEAT_PROFILE}={}){
  let pulse=0;
  if(Number.isFinite(sourceTime)&&sourceTime>=0&&sourceTime<profile.duration){
    for(const {at,strength,attack=profile.attack} of profile.peaks){
      const delta=sourceTime-at;
      if(delta< -attack||delta>profile.decay)continue;
      const envelope=delta<0?1-(delta/attack)**2:(1-delta/profile.decay)**2;
      pulse=Math.max(pulse,strength*envelope);
    }
  }
  return {pulse,scale:1+pulse*(reducedMotion?.012:.065),brightness:1+pulse*(reducedMotion?.1:.24)};
}

export class ReelHeartbeat{
  // onCycle must synchronously play a ready buffer (or return false). It must
  // not queue playback while loading: missed cycles are intentionally consumed.
  // onStop should stop only the dedicated heartbeat lane.
  constructor({onCycle=()=>false,onStop=()=>{},reducedMotion=false}={}){
    this.onCycle=onCycle;this.onStop=onStop;this.reducedMotion=reducedMotion;
    this.key=null;this.at=null;this.lastCycle=-1;this.audioRunning=false;
    this.state=NEUTRAL;
  }

  update({key='heartbeat',active=false,time=0,at=0,duration=HEARTBEAT_PROFILE.duration,
    enabled=true,paused=false}={}){
    if(this.key!==key||this.at!==at){
      this.stopAudio('window-change');this.key=key;this.at=at;
      this.lastCycle=-1;this.state=NEUTRAL;
    }
    const valid=Number.isFinite(time)&&Number.isFinite(at)&&Number.isFinite(duration)&&duration>0;
    const elapsed=time-at;
    if(!active||!valid||elapsed<0||elapsed>=duration){
      this.stopAudio(!active?'inactive':'outside-window');this.state=NEUTRAL;
      return this.state;
    }
    const cycle=Math.floor(elapsed/HEARTBEAT_PROFILE.duration);
    const sourceTime=elapsed-cycle*HEARTBEAT_PROFILE.duration;
    const newCycle=cycle>this.lastCycle;
    // Consume the observed cycle even during mute, pause or an unloaded buffer.
    // Unmuting/resuming must not replay the old start later in that cycle.
    this.lastCycle=Math.max(this.lastCycle,cycle);
    if(paused){this.stopAudio('paused');return this.state;}
    if(!enabled)this.stopAudio('muted');
    if(newCycle){
      this.stopAudio('next-cycle');
      if(enabled&&sourceTime<=HEARTBEAT_MAX_START_LATENESS){
        const event=Object.freeze({key,cycle,at:at+cycle*HEARTBEAT_PROFILE.duration,
          windowAt:at,offset:sourceTime,sourceTime,
          duration:Math.min(HEARTBEAT_PROFILE.duration-sourceTime,duration-elapsed)});
        this.audioRunning=this.onCycle(event)!==false;
      }
    }
    this.state=Object.freeze({active:true,cycle,sourceTime,
      ...heartbeatPulse(sourceTime,{reducedMotion:this.reducedMotion})});
    return this.state;
  }

  stopAudio(reason){
    if(!this.audioRunning)return;
    this.audioRunning=false;this.onStop({key:this.key,reason});
  }

  reset(){
    this.stopAudio('reset');this.key=null;this.at=null;
    this.lastCycle=-1;this.state=NEUTRAL;return this.state;
  }
}
