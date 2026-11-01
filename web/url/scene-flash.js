import {MODE_ENTRY_SECONDS} from './impact-titles.js';

export const FLASH_PULSE_SECONDS=.25;
export const SCENE_FLASH_BEATS=Object.freeze({
  mode:Object.freeze([3.3,4.2,5.35,6.05].map(at=>MODE_ENTRY_SECONDS+at)),
  spam:Object.freeze([.05,1.05,2.05]),
  temptation:Object.freeze([.2,1.1,2.2]),
});
// These colors build anticipation; they do not change or certify an outcome.
const LEVELS=Object.freeze([
  Object.freeze({color:'#ffffff',opacity:.22,shake:4}),
  Object.freeze({color:'#72ffac',opacity:.25,shake:6}),
  Object.freeze({color:'#c486ff',opacity:.30,shake:8}),
  Object.freeze({color:'#ff3c57',opacity:.35,shake:10}),
]);
const LENGTHS=Object.freeze({mode:MODE_ENTRY_SECONDS+6.7,spam:3,temptation:3.8});
const NONE=Object.freeze({color:'#ffffff',opacity:0,active:false,beatId:null,shake:0,at:null,age:null});
const smooth=x=>x*x*(3-2*x);

export function judgmentPushFlash({elapsed,pushedAt,reducedMotion=false}={}){
 const age=elapsed-pushedAt;
 if(!Number.isFinite(elapsed)||!Number.isFinite(pushedAt)||age<0||age>=.85)return NONE;
 if(reducedMotion)return {...NONE,color:'#c486ff',opacity:.06,active:true};
 const force=Math.max(0,1-age/.85)**2;
 return {color:'#c486ff',opacity:.65*force,active:true,beatId:`judgment-push:${pushedAt}`,shake:18*force,at:pushedAt,age};
}

// No clocks or timers are read here: holding elapsed freezes both the lamp cue
// and LCD flash. The caller may use a newly observed beatId for ONE white frame;
// subsequent frames use this envelope. Reduced motion never exposes a beatId.
export function screenFlash({scene,elapsed=0,reducedMotion=false}={}){
  if(!Object.hasOwn(SCENE_FLASH_BEATS,scene)||!Number.isFinite(elapsed)||elapsed<0||elapsed>=LENGTHS[scene])return NONE;
  if(reducedMotion)return {color:LEVELS[2].color,opacity:.035,active:true,beatId:null,shake:0,at:null,age:null};
  const beats=SCENE_FLASH_BEATS[scene];
  const index=beats.findIndex(at=>elapsed>=at&&elapsed<at+FLASH_PULSE_SECONDS);
  if(index<0)return NONE;
  const at=beats[index],age=elapsed-at;
  // A 25 ms eased attack followed by a smooth decay to transparent. Small
  // negative floating-point differences cannot escape the bounded envelope.
  const attack=.025,level=LEVELS[index+(beats.length===3?1:0)];
  const envelope=age<attack?smooth(Math.max(0,age/attack)):1-smooth(Math.min(1,(age-attack)/(FLASH_PULSE_SECONDS-attack)));
  return {color:level.color,opacity:level.opacity*envelope,active:true,
    beatId:`${scene}:${index+1}`,shake:level.shake*envelope,at,age};
}
