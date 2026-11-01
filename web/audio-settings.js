export const AUDIO_SETTINGS_KEY = 'yua-pachinko-audio-v1';
export const AUDIO_DEFAULTS = Object.freeze({master:.8,music:.7,effects:.75,voice:.9});
const CHANNELS = Object.freeze(Object.keys(AUDIO_DEFAULTS));

export function normalizeAudioSettings(value) {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return Object.freeze(Object.fromEntries(CHANNELS.map(channel=>{
    const level=source[channel];
    return [channel,typeof level==='number'&&Number.isFinite(level)&&level>=0&&level<=1?level:AUDIO_DEFAULTS[channel]];
  })));
}

export function audioScale(levels,channel) {
  if(!CHANNELS.includes(channel))return 0;
  const safe=normalizeAudioSettings(levels);
  return channel==='master'?safe.master:safe.master*safe[channel];
}

function defaultStorage() {try{return globalThis.localStorage;}catch{return null;}}

// Settings have their own storage key: continuing, resetting or previewing a
// game cannot change the listener's mix. Storage restrictions never block play.
export function createAudioSettings({root,openButton,onChange=()=>{},onOpen=()=>{},onClose=()=>{},storage=defaultStorage()}={}) {
  let levels=AUDIO_DEFAULTS,storageAvailable=Boolean(storage);
  try {
    const raw=storage?.getItem(AUDIO_SETTINGS_KEY);
    if(raw){const saved=JSON.parse(raw);if(saved?.version===1)levels=normalizeAudioSettings(saved.levels);}
  }catch{storageAvailable=false;}
  const listeners=[];
  const bind=(target,type,callback)=>{if(!target)return;target.addEventListener(type,callback);listeners.push(()=>target.removeEventListener(type,callback));};
  const render=()=>{
    for(const channel of CHANNELS){
      const percent=Math.round(levels[channel]*100),input=root?.querySelector(`[data-volume="${channel}"]`),output=root?.querySelector(`[data-volume-output="${channel}"]`);
      if(input){input.value=String(percent);input.setAttribute('aria-valuetext',`${percent}%`);input.style.setProperty('--volume-fill',`${percent}%`);}
      if(output)output.textContent=`${percent}%`;
    }
    const note=root?.querySelector('[data-audio-storage]');if(note)note.hidden=storageAvailable;
  };
  const publish=({persist=true,initial=false}={})=>{
    if(persist)try{if(!storage)throw new Error('Storage unavailable');storage.setItem(AUDIO_SETTINGS_KEY,JSON.stringify({version:1,levels}));storageAvailable=true;}catch{storageAvailable=false;}
    render();onChange(levels,{initial,saved:storageAvailable});
  };
  const controller={
    dialog:root,
    get levels(){return levels;},
    get storageAvailable(){return storageAvailable;},
    scale(channel){return audioScale(levels,channel);},
    set(channel,value){
      if(!CHANNELS.includes(channel)||typeof value!=='number'||!Number.isFinite(value))return false;
      levels=normalizeAudioSettings({...levels,[channel]:Math.max(0,Math.min(1,value))});publish();return true;
    },
    reset(){levels=AUDIO_DEFAULTS;publish();},
    open(){if(!root||root.open)return;onOpen(root);root.showModal();},
    close(){if(root?.open)root.close();},
    destroy(){for(const remove of listeners)remove();},
  };
  for(const channel of CHANNELS)bind(root?.querySelector(`[data-volume="${channel}"]`),'input',event=>controller.set(channel,Number(event.currentTarget.value)/100));
  bind(root?.querySelector('[data-audio-reset]'),'click',()=>controller.reset());
  bind(openButton,'click',()=>controller.open());
  bind(root,'close',()=>onClose(root));
  publish({persist:false,initial:true});
  return controller;
}
