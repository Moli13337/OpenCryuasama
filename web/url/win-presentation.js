export const WIN_CONFIRM_SECONDS=.95;
export const WIN_MONITOR_SECONDS=Object.freeze({wideEnd:4,bonusStart:4.4});
const clamp=x=>Math.max(0,Math.min(1,x));
export function winMonitorState({phase,elapsed=0,blocked=false}={}){
  if(phase!=='win'||blocked)return {wide:false,bonusReady:false,opacity:1,stage:'inactive'};
  const {wideEnd,bonusStart}=WIN_MONITOR_SECONDS;
  if(elapsed<wideEnd)return {wide:true,bonusReady:false,stage:'wide',opacity:Math.min(clamp(elapsed/.15),clamp((wideEnd-elapsed)/.22))};
  return {wide:false,bonusReady:elapsed>=bonusStart,stage:elapsed<bonusStart?'return':'bonus',opacity:clamp((elapsed-wideEnd)/.2)};
}
export class WinConfirmation{
  constructor(){this.reset();}
  start(event,snapshot={}){this.event=event;this.snapshot=snapshot;this.elapsed=0;this.active=true;}
  update(dt,{paused=false}={}){
    if(!this.active||paused)return null;
    this.elapsed+=Math.max(0,Number.isFinite(dt)?dt:0);
    if(this.elapsed+1e-9<WIN_CONFIRM_SECONDS)return null;
    const event=this.event;this.reset();return event;
  }
  reset(){this.active=false;this.event=null;this.snapshot=null;this.elapsed=0;}
}
