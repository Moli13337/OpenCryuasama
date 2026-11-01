// Bounds native-media work during an interruption without scheduling timers.
// Owners invalidate their play promises before intentional pause/source changes.
export class MediaRetryGuard {
  constructor({now=()=>performance.now()/1000,playDelays=[.25,.75,1.5],seekInterval=1,seekWindow=10,maxSeeks=6}={}){
    this.now=now;this.playDelays=playDelays;this.seekInterval=seekInterval;this.seekWindow=seekWindow;this.maxSeeks=maxSeeks;this.reset();
  }
  reset(){this.playFailures=0;this.nextPlay=-Infinity;this.playExhausted=false;this.seeks=[];}
  canPlay(){return !this.playExhausted&&this.now()>=this.nextPlay;}
  playSucceeded(){this.playFailures=0;this.nextPlay=-Infinity;this.playExhausted=false;}
  playFailed(){
    const delay=this.playDelays[this.playFailures++];
    if(delay===undefined){this.playExhausted=true;return true;}
    this.nextPlay=this.now()+delay;return false;
  }
  seek(){
    const now=this.now();
    this.seeks=this.seeks.filter(time=>now-time<this.seekWindow);
    if(this.seeks.length&&now-this.seeks.at(-1)<this.seekInterval)return 'wait';
    if(this.seeks.length>=this.maxSeeks)return 'failed';
    this.seeks.push(now);return 'seek';
  }
}
