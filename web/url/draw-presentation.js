import {SHUTTER_RULES} from './engine.js';
// Cues use the frozen entry outcome and its scene clock, never another draw.
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
// The first heavy impacts have room to breathe; a pair leads into four quicker
// strikes. Uneven opening widths prevent the doors from feeling like a loop.
// Only the captured BEFORE figures show through; the real reveal stays at 9.5s.
export const SHUTTER_FEINTS=Object.freeze([
  {at:2.70,peak:2.98,closeAt:3.08,end:3.30,amount:.18,strength:.50},
  {at:4.68,peak:4.92,closeAt:5.02,end:5.20,amount:.34,strength:.63},
  {at:5.67,peak:5.89,closeAt:5.96,end:6.10,amount:.24,strength:.58},
  {at:6.25,peak:6.44,closeAt:6.50,end:6.62,amount:.42,strength:.76},
  {at:7.38,peak:7.56,closeAt:7.62,end:7.72,amount:.29,strength:.72},
  {at:7.86,peak:8.02,closeAt:8.065,end:8.15,amount:.47,strength:.88},
  {at:8.245,peak:8.39,closeAt:8.42,end:8.49,amount:.35,strength:.84},
  {at:8.535,peak:8.655,closeAt:8.68,end:8.74,amount:.53,strength:1},
].map(Object.freeze));
export function spinTreatment(hold){return hold?.reachType==='shutter'&&hold.shutter?'shutter':'none';}
export function shutterState(phase,elapsed,treatment,{reducedMotion=false}={}){
  if(phase!=='reach'||treatment!=='shutter')return {active:false,closed:0};
  const {closeAt,closedAt,openAt,openEnd}=SHUTTER_RULES;
  let closed=elapsed<closedAt?clamp((elapsed-closeAt)/(closedAt-closeAt)):elapsed<openAt?1:1-clamp((elapsed-openAt)/(openEnd-openAt));
  let feint=-1,impact=0;
  if(!reducedMotion&&elapsed<openAt)for(let i=0;i<SHUTTER_FEINTS.length;i++){
    const cycle=SHUTTER_FEINTS[i];
    if(elapsed>=cycle.at&&elapsed<cycle.end){
      const opening=elapsed<cycle.peak?smooth((elapsed-cycle.at)/(cycle.peak-cycle.at))
        :elapsed<cycle.closeAt?1:1-clamp((elapsed-cycle.closeAt)/(cycle.end-cycle.closeAt))**3;
      closed=1-cycle.amount*opening;feint=i;
    }
    impact=Math.max(impact,elapsed>=cycle.end?cycle.strength*clamp(1-(elapsed-cycle.end)/.18):0);
  }
  return {active:elapsed>=closeAt&&elapsed<openEnd,closed,feint,impact};
}
export class DrawPresentation{
  constructor(root,reels,{reducedMotion=false,onBeat=()=>{}}={}){this.root=root;this.reels=reels;this.reducedMotion=reducedMotion;this.onBeat=onBeat;this.key=null;this.beaten=new Set();this.shutterVisible=null;this.reelsMoving=null;}
  update({phase,elapsed,hold,blocked=false,paused=false}){
    if(paused)return;
    // Figure motion also belongs to ordinary reaches. Hiding the shutter must
    // not stop those figures; only its stationary pose needs writing once.
    const moving=!blocked&&!this.reducedMotion&&((phase==='spin'&&elapsed>1.4)||phase==='reach');
    if(moving||this.reelsMoving!==false){
      const amplitude=phase==='reach'?1.2:.5;
      this.reels.style.setProperty('--digit-x',`${moving?Math.sin(elapsed*37)*amplitude:0}cqw`);
      this.reels.style.setProperty('--digit-y',`${moving?Math.sin(elapsed*23)*amplitude*.4:0}cqw`);
      this.reels.style.setProperty('--digit-tilt',`${moving?Math.sin(elapsed*31)*amplitude:0}deg`);
      this.reelsMoving=moving;
    }
    const key=`${hold?.id}:${phase}`;
    if(this.key!==key){this.key=key;this.beaten.clear();}
    const treatment=spinTreatment(hold),s=shutterState(phase,elapsed,treatment,{reducedMotion:this.reducedMotion});
    if(blocked||!s.active){
      if(this.shutterVisible!==false){
        this.root.hidden=true;
        this.root.dataset.reduced=String(this.reducedMotion);this.root.dataset.stage='close';
        for(const name of ['close','energy','pressure','release','impact'])this.root.style.setProperty(`--shutter-${name}`,'0');
        this.root.style.setProperty('--shutter-jolt','0px');
        this.shutterVisible=false;
      }
      return;
    }
    if(this.shutterVisible!==true){this.root.hidden=false;this.shutterVisible=true;}
    this.root.dataset.reduced=String(this.reducedMotion);
    this.root.style.setProperty('--shutter-close',String(s.closed));
    this.root.dataset.stage=s.feint>=0?'feint':elapsed<3.2?'close':elapsed<6?'charge':elapsed<9.5?'expect':'open';
    const pressure=s.active?clamp((elapsed-SHUTTER_RULES.closedAt)/(SHUTTER_RULES.openAt-SHUTTER_RULES.closedAt)):0;
    const pulse=.5+.5*Math.sin(elapsed*12+elapsed*elapsed*1.4);
    const reveal=s.active&&elapsed>=SHUTTER_RULES.openAt?clamp(1-(elapsed-SHUTTER_RULES.openAt)/.55):0;
    this.root.style.setProperty('--shutter-energy',String(this.reducedMotion?.3:s.closed*(.4+pressure*.2+pulse*.4)));
    this.root.style.setProperty('--shutter-pressure',String(this.reducedMotion?.12:pressure*(.3+pulse*.7)));
    this.root.style.setProperty('--shutter-release',String(this.reducedMotion?0:reveal));
    this.root.style.setProperty('--shutter-impact',String(this.reducedMotion?0:s.impact??0));
    this.root.style.setProperty('--shutter-jolt',`${this.reducedMotion?0:Math.sin(elapsed*43)*((s.impact??0)*2.5+pressure*pressure*2)}px`);
    const beats=[['close',SHUTTER_RULES.closedAt,'close'],['charge',2.35,'charge'],['charge2',7.1,'charge'],['pressure',8.84,'pressure'],['open',SHUTTER_RULES.openAt,'open']];
    if(!this.reducedMotion)for(const [index,cycle] of SHUTTER_FEINTS.entries())beats.push([`feint-${index}-open`,cycle.at,'open'],[`feint-${index}-close`,cycle.end,'close']);
    if(!blocked&&treatment==='shutter'&&phase==='reach'){
      let newest=null;
      for(const [id,at,type] of beats)if(elapsed>=at&&!this.beaten.has(id)){
        this.beaten.add(id);
        if(elapsed-at<.2&&(!newest||at>newest.at))newest={id,at,type};
      }
      // A skipped frame or resumed tab must not replay several overlapping
      // mechanical sounds. The newest recent impact matches the visible pose.
      if(newest){const {id,at,type}=newest;this.onBeat(type,{id,at,final:id==='open',feint:id.startsWith('feint-')});}
    }
  }
}
