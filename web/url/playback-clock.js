/** Keep short rendering delays from slowing the launcher and ball simulation.
 * A hidden tab is paused by the caller; the cap also prevents a long backlog.
 */
export function advancePlayback(engine,seconds,options=()=>({})){
  let remaining=Math.min(.25,Math.max(0,Number.isFinite(seconds)?seconds:0));
  while(remaining>1e-8){const dt=Math.min(1/60,remaining);engine.step(dt,options());remaining-=dt;}
}
