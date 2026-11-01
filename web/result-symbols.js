// Presentation only. Never call the engine RNG to choose a displayed figure.
// Separate lane salts also keep these figures independent of reach selection.
function symbolHash(seed,holdId,lane){
  const high=Math.floor(holdId/4294967296);
  let value=(seed>>>0)^Math.imul(holdId>>>0,0x9e3779b1)^Math.imul(high,0x85ebca6b)^Math.imul(lane+1,0x27d4eb2d);
  value=Math.imul(value^(value>>>16),0x7feb352d);
  value=Math.imul(value^(value>>>15),0x846ca68b);
  return (value^(value>>>16))>>>0;
}

export function resultSymbols({seed,holdId,win,reach,kind=null,even=false}){
  if(!Number.isSafeInteger(holdId)||holdId<1||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||
    typeof win!=='boolean'||typeof reach!=='boolean')throw new TypeError('Invalid symbol decision');
  const pick=lane=>symbolHash(seed,holdId,lane);
  if(win){
    const choices=kind==='blessing'?[2,4,8]:kind==='queen'?(even?[6]:[1,3,5,7]):kind==='awakening'?[9]:null;
    if(!choices)throw new TypeError('A winning symbol requires its captured bonus kind');
    const symbol=choices[pick(0)%choices.length];
    return Object.freeze([symbol,symbol,symbol]);
  }
  const left=1+pick(0)%9;
  const different=(left+pick(1)%8)%9+1;
  return Object.freeze(reach?[left,different,left]:[left,1+pick(2)%9,different]);
}
