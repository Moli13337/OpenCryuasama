// Opt-in, local-only timing: open /?profile=1 and read the browser console.
// It observes rendering; it never changes physics, launch rate, or outcomes.
export function createRenderProfile(enabled){
  if(!enabled)return null;
  let previous=0,start=0,intervals=[],work=[],phases=new Set();
  return (now,cpuMilliseconds,phase,paused)=>{
    if(paused){previous=0;start=0;intervals=[];work=[];phases.clear();return;}
    if(!previous){previous=now;return;}
    start ||= previous;
    intervals.push(now-previous);work.push(cpuMilliseconds);phases.add(phase);previous=now;
    if(now-start<8000)return;
    const sorted=[...intervals].sort((a,b)=>a-b);
    const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
    console.info('[render-profile] '+JSON.stringify({
      frames:intervals.length,fps:+(1000/mean(intervals)).toFixed(1),
      frameP95Ms:+sorted[Math.floor(sorted.length*.95)].toFixed(2),
      over33ms:intervals.filter(ms=>ms>33.4).length,
      mainWorkMs:+mean(work).toFixed(2),phases:[...phases]
    }));
    start=now;intervals=[];work=[];phases.clear();
  };
}
