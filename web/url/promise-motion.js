// One scene clock drives camera, light and sound; pause never drifts the cuts.
const clamp=n=>Math.max(0,Math.min(1,n));
export const LEGACY_SWORD_SHOTS=Object.freeze([
  {at:27.8,end:30.4,id:'draw',from:[-23,10,1.18,-12],to:[4,-3,1.04,3],sound:null},
  {at:30.4,end:33,id:'blade',from:[-22,12,1.65,-6],to:[8,3,1.22,5],sound:'sword-arrival'},
  {at:33,end:35.6,id:'slash',from:[15,-8,1.25,11],to:[-11,7,1.08,-9],sound:'sword-heavy'},
  {at:35.6,end:38.2,id:'gaze',from:[10,13,1.8,4],to:[-5,7,1.48,-3],sound:'aura'},
  {at:38.2,end:40.8,id:'rise',from:[-13,17,1.1,-11],to:[7,-8,1.34,7],sound:'sword-arrival'},
  {at:40.8,end:44,id:'cross',from:[17,-6,1.32,10],to:[-14,5,1.07,-9],sound:'sword-heavy'},
  {at:44,end:47.6,id:'vow',from:[7,12,1.65,3],to:[-4,6,1.37,-4],sound:null},
  {at:47.6,end:50,id:'release',from:[-19,12,1.15,-13],to:[13,-7,1.32,10],sound:'sword-heavy'},
  {at:50,end:52,id:'charge',from:[8,-4,1.2,5],to:[0,0,1.05,0],sound:'energy'},
]);
// New scenes are concise; saved 60-second reaches keep their captured clock.
export const SWORD_SHOTS=Object.freeze([
  {at:27.8,end:29,id:'draw',from:[-10,5,1.16,-6],to:[2,-2,1.04,2],focus:'54% 42%',sound:null},
  {at:29,end:30.2,id:'blade',from:[-5,5,1.24,-4],to:[-9,0,1.12,2],focus:'80% 30%',sound:'sword-arrival'},
  {at:30.2,end:33.8,id:'vow',from:[1,2,1.04,-2],to:[-1,-2,1.17,1],focus:'50% 27%',art:'promise-red-key-v01.png',sound:null},
  {at:33.8,end:34.8,id:'release',from:[13,-6,1.22,9],to:[-9,4,1.04,-7],focus:'58% 40%',sound:'sword-heavy'},
  {at:34.8,end:36,id:'charge',from:[-4,2,1.13,-3],to:[0,0,1.02,0],focus:'60% 42%',sound:'energy'},
]);
export const promiseSwordVowAt=duration=>duration===60?44:30.2;
export function swordMotionAt(elapsed,{reducedMotion=false,duration=44}={}){
  const shot=(duration===60?LEGACY_SWORD_SHOTS:SWORD_SHOTS).find(s=>elapsed>=s.at&&elapsed<s.end);
  if(!shot)return null;
  const age=elapsed-shot.at,p=clamp(age/(shot.end-shot.at));
  const ease=1-(1-p)**2,hit=Math.exp(-age*8);
  const [x,y,scale,angle]=shot.from.map((v,i)=>v+(shot.to[i]-v)*ease);
  return {shot,age,progress:p,flash:reducedMotion?0:hit*.48,
    transform:reducedMotion?'none':`translate(${(x+Math.sin(age*53)*hit*1.5).toFixed(3)}%,${y.toFixed(3)}%) scale(${scale.toFixed(3)}) rotate(${angle.toFixed(3)}deg)`,
    sweep:reducedMotion?0:(p*2.3%1),rays:reducedMotion?0:elapsed*37};
}
export function promiseAnnouncementAt(elapsed,{reducedMotion=false}={}){
  const t=clamp(elapsed/3)*3,arrive=Math.max(0,1-t/.38),pulse=Math.exp(-(t%.58)*13);
  return {rays:reducedMotion?0:t*52,tunnel:reducedMotion?1:.85+(t%.48)*1.5,
    transform:reducedMotion?'none':`translate(${(Math.sin(t*39)*pulse*1.4).toFixed(3)}%,${(Math.cos(t*31)*pulse*.8).toFixed(3)}%) scale(${(1+arrive*.9+pulse*.075).toFixed(3)}) rotate(${(-3+Math.sin(t*5)*2).toFixed(3)}deg)`};
}
