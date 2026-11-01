// A small local flight record. It never reloads, changes a save, or transmits data.
export const BUILD_ID='v56-light';
export const DIAGNOSTICS_KEY='yua-pachinko-diagnostics-v1';
const LIMIT=12,INTERVAL=10000,MAX_BYTES=16000;
const text=(v,n=64)=>typeof v==='string'?v.slice(0,n):'';
function sampleFields(s={}){
 const out={};for(const key of ['phase','scene','mode','quality','audio','pause','media'])if(typeof s[key]==='string')out[key]=text(s[key],160);
 for(const key of ['elapsed','balls','holds','gap','rushRemaining','specialHolds','saveRevision'])if(Number.isFinite(s[key]))out[key]=Math.round(Math.max(0,s[key])*100)/100;
 return out;
}
function cleanRecord(raw){
 if(typeof raw!=='string'||raw.length>MAX_BYTES)return null;
 try{const r=JSON.parse(raw);if(r?.version!==1||!Array.isArray(r.events))return null;
 return {version:1,build:text(r.build),started:Number(r.started)||0,ended:text(r.ended),events:r.events.slice(-LIMIT).map(e=>({at:Number(e.at)||0,type:text(e.type),...sampleFields(e)}))};}catch{return null;}
}
export function createFlightRecord({storage,now=()=>Date.now(),sample=()=>({})}={}){
 let previous=null;try{previous=cleanRecord(storage?.getItem(DIAGNOSTICS_KEY));}catch{}
 const current={version:1,build:BUILD_ID,started:now(),ended:'',events:[]};let lastWrite=-Infinity,lastTick=0,writable=Boolean(storage);
 function flush(force=false){
  const time=now();if(!writable||(!force&&time-lastWrite<5000))return false;
  try{const raw=JSON.stringify(current);if(raw.length>MAX_BYTES)return false;storage.setItem(DIAGNOSTICS_KEY,raw);lastWrite=time;return true;}catch{writable=false;return false;}
 }
 function record(type,extra={},force=false){
  let state={};try{state=sample();}catch{}
  current.events.push({at:Math.max(0,now()-current.started),type:text(type),...sampleFields({...state,...extra})});
  if(current.events.length>LIMIT)current.events.shift();flush(force);
 }
 record('start',{},true);
 return {record,tick(time){if(time-lastTick<INTERVAL)return;lastTick=time;record('playing');},
  leave(reason){current.ended=text(reason);record(reason,{},true);},
  resume(){current.ended='';record('visible',{},true);},
  report(){return {previous,current:JSON.parse(JSON.stringify(current)),storageAvailable:writable};},
  exportText(){return JSON.stringify({game:'YUA PACHINKO',...this.report()});}
 };
}
export function attachRuntimeDiagnostics({root,sample,view=root.ownerDocument.defaultView}={}){
 const doc=root.ownerDocument;let storage;try{storage=view.localStorage;}catch{}
 const recorder=createFlightRecord({storage,sample});
 view.addEventListener('pagehide',()=>recorder.leave('pagehide'));
 doc.addEventListener('visibilitychange',()=>doc.hidden?recorder.leave('hidden'):recorder.resume());
 let lastError=-Infinity;
 const recordError=(type,name)=>{const now=Date.now();if(now-lastError<1000)return;lastError=now;recorder.record(type,{media:text(name,160)});};
 view.addEventListener('error',event=>recordError('script-error',event.error?.name||event.message));
 view.addEventListener('unhandledrejection',event=>recordError('promise-error',event.reason?.name||'unknown'));
 const section=doc.createElement('details');section.className='runtime-diagnostics';
 section.innerHTML='<summary>不具合の記録</summary><p>再読み込みや停止を報告するときに、この記録をコピーしてお送りください。</p><button type="button" data-diagnostics-copy>記録をコピー</button><textarea data-diagnostics-text readonly rows="5" hidden aria-label="不具合の記録"></textarea><p data-diagnostics-status role="status"></p>';
 root.append(section);
 section.querySelector('textarea').style.cssText='width:100%;box-sizing:border-box;margin-top:12px;font-size:12px;';
 section.querySelector('[data-diagnostics-copy]').addEventListener('click',async()=>{
  const report=recorder.exportText(),field=section.querySelector('textarea'),status=section.querySelector('[data-diagnostics-status]');
  try{if(!view.navigator.clipboard?.writeText)throw Error('unavailable');await view.navigator.clipboard.writeText(report);status.textContent='コピーしました。';}
  catch{field.hidden=false;field.value=report;field.focus();field.select();status.textContent='表示した記録を選択してコピーしてください。';}
 });
 return recorder;
}
