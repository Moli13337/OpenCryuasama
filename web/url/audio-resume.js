// Gesture-driven unlocks can overlap; resume only a suspended/interrupted context.
const pending=new WeakMap();
export function resumeAudioIfNeeded(context){
  if(!context||context.state==='running'||context.state==='closed')return false;
  if(pending.has(context))return pending.get(context);
  let attempt;try{attempt=context.resume();}catch{return false;}
  const job=Promise.resolve(attempt).then(()=>true,()=>false).finally(()=>{if(pending.get(context)===job)pending.delete(context);});
  pending.set(context,job);return job;
}
