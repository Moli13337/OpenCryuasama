// Selection and fades are explicit so original prayer audio can overlap BGM.
export function musicState({phase,reachType,mode,awakening=false,intro=false,outro=null,modeSplash=false,result=false}){
  const prayer=phase==='reach'&&reachType==='prayer';
  return {
    paused:intro||result,
    kind:awakening||outro!==null?'awakening':prayer?'normal':phase==='win'?'challenge':mode==='rush'||modeSplash?'rush':mode==='challenge'?'challenge':phase==='reach'&&reachType==='judgment'?'reach':'normal',
    duck:phase==='reach'&&['prayer','promise'].includes(reachType),
    gainScale:outro!==null?Math.max(0,1-outro/1.8):1,
  };
}
