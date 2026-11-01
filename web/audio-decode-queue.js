// Share one decoder lane across effects and voices in an AudioContext.
// Waiting jobs retain only their encoded bytes; completed tails never retain
// an AudioBuffer and the final tail is removed as soon as the queue drains.
const tails=new WeakMap();

export function decodeAudioQueued(context,bytes,{signal,isCurrent}={}){
  if(!context||typeof context.decodeAudioData!=='function')return Promise.reject(new TypeError('AudioContext.decodeAudioData is required'));
  // A scene may end while its voice waits behind a different decode. Drop
  // its encoded copy immediately and never start work for the departed scene.
  const cancel=()=>{bytes=null;};
  if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
  const previous=tails.get(context)||Promise.resolve();
  const result=previous.then(()=>{
    signal?.removeEventListener('abort',cancel);
    const valid=!signal?.aborted&&(!isCurrent||isCurrent());
    isCurrent=null;signal=null;
    const input=bytes;bytes=null;if(!valid)return null;
    return context.decodeAudioData(input);
  });
  // A rejected decode belongs to its caller. The lane still advances and
  // neither a successful buffer nor a rejected error is held by its tail.
  const tail=result.then(()=>undefined,()=>undefined);
  tails.set(context,tail);
  tail.then(()=>{if(tails.get(context)===tail)tails.delete(context);});
  return result;
}
