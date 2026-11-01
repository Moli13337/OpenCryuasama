export const RENDER_QUALITY_KEY='yua-pachinko-render-quality-v1';
const PRESETS=new Set(['auto','light']);
const normalize=value=>PRESETS.has(value)?value:'auto';
function defaultStorage(){try{return globalThis.localStorage??null;}catch{return null;}}

export function readRenderQuality(storage=defaultStorage()){
  try{const saved=JSON.parse(storage?.getItem(RENDER_QUALITY_KEY)||'null');return saved?.version===1?normalize(saved.preset):'auto';}
  catch{return 'auto';}
}
export function resolveRenderQuality(preset='auto',{userAgent='',platform='',maxTouchPoints=0,coarsePointer=false,width=1024}={}){
  preset='light'; // Fixed for this separate light-only distribution.
  const ios=/iPad|iPhone|iPod/.test(userAgent)||(platform==='MacIntel'&&maxTouchPoints>1);
  const mobile=ios||(maxTouchPoints>0&&coarsePointer&&width<=1024);
  return Object.freeze({preset,renderQuality:preset==='light'||mobile?'mobile':'desktop'});
}
export function applyInitialRenderQuality({document=globalThis.document,navigator=globalThis.navigator,storage=defaultStorage(),width=globalThis.innerWidth,coarsePointer=globalThis.matchMedia?.('(pointer: coarse)').matches??false}={}){
  const profile=resolveRenderQuality(readRenderQuality(storage),{userAgent:navigator?.userAgent,platform:navigator?.platform,maxTouchPoints:navigator?.maxTouchPoints,coarsePointer,width});
  if(document?.documentElement){document.documentElement.dataset.renderQuality=profile.renderQuality;document.documentElement.dataset.qualityPreset=profile.preset;}
  return profile;
}
export function getRenderQualityProfile(document=globalThis.document){
  const lowLoad=document?.documentElement?.dataset.qualityPreset==='light';
  return Object.freeze({lowLoad,renderQuality:document?.documentElement?.dataset.renderQuality==='mobile'?'mobile':'desktop',boardScale:lowLoad?.5:1,reelDpr:lowLoad?1:2,reelPixelLimit:196608});
}

// Only this preference key is owned here. The caller owns the current game and
// must commit it successfully before this module may save or reload anything.
export async function saveRenderQuality({preset,checkpoint,storage=defaultStorage(),reload=()=>globalThis.location.reload()}={}){
  if(!PRESETS.has(preset))return {ok:false,reason:'invalid-preset'};
  let saved;
  try{saved=await checkpoint?.();}catch{return {ok:false,reason:'checkpoint-failed'};}
  if(saved?.ok!==true)return {ok:false,reason:saved?.reason||'checkpoint-failed'};
  try{if(!storage)throw Error('Storage unavailable');storage.setItem(RENDER_QUALITY_KEY,JSON.stringify({version:1,preset}));}
  catch{return {ok:false,reason:'preference-storage-failed'};}
  try{reload();}catch{return {ok:false,reason:'reload-failed'};}
  return {ok:true,preset};
}

export function setupRenderQualitySettings({root}={}){
 if(!root)return null;
 const section=root.ownerDocument.createElement('section');section.className='render-quality-settings';
 section.innerHTML='<h3>軽量版</h3><p>低負荷モードで動作しています。音量はこの画面で調整できます。</p>';
 const actions=root.querySelector('.audio-settings-actions');if(actions)root.insertBefore(section,actions);else root.append(section);
 return {element:section,destroy(){section.remove();}};
}
