// Canvas2D restores its default state after backing-store loss. Rebuild cached
// artwork and transforms without touching the game, RNG or pending balls.
export function watchCanvasRecovery({targets,rebuild}){
  const states=targets.map(target=>({...target,lost:false,polledRestore:false})),bindings=[];
  let needsRebuild=false,destroyed=false;
  function poll(){
    for(const state of states){
      const read=state.context?.isContextLost;
      if(typeof read!=='function')continue;
      let actual;
      try{actual=read.call(state.context);}catch{continue;}
      if(typeof actual!=='boolean')continue;
      // The browser may restore before delivering contextrestored, or omit
      // either event. A recovered backing store still needs fresh artwork.
      if(actual!==state.lost){state.polledRestore=!actual;state.lost=actual;needsRebuild=true;}
    }
  }
  function canDraw(){
    if(destroyed)return true;
    poll();
    if(states.some(state=>state.lost))return false;
    if(needsRebuild){
      rebuild();
      needsRebuild=false;
    }
    return true;
  }
  for(const state of states){
    const onLost=()=>{state.lost=true;state.polledRestore=false;needsRebuild=true;}; // 2D needs default restoration.
    const onRestored=()=>{
      // If polling already observed the recovery, this delayed event must not
      // invalidate the same caches again. Event-only browsers retain this path.
      if(!state.polledRestore)needsRebuild=true;
      state.lost=false;state.polledRestore=false;
      canDraw();
    };
    state.canvas.addEventListener('contextlost',onLost);
    state.canvas.addEventListener('contextrestored',onRestored);
    bindings.push(()=>{state.canvas.removeEventListener('contextlost',onLost);state.canvas.removeEventListener('contextrestored',onRestored);});
  }
  return {canDraw,destroy(){destroyed=true;bindings.forEach(unbind=>unbind());states.length=0;needsRebuild=false;}};
}
