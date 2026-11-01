export const LOW_LOAD_AUDIO_SAMPLE_RATE=24000;

// decodeAudioData resamples into this context's rate. Durations and playback
// rates stay unchanged while low-load decoded PCM uses fewer samples.
export function createGameAudioContext({lowLoad=false,AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext}={}){
  if(typeof AudioContextClass!=='function')throw new TypeError('Web Audio is unavailable');
  if(lowLoad){
    try{return new AudioContextClass({sampleRate:LOW_LOAD_AUDIO_SAMPLE_RATE});}
    catch{/* Some devices reject custom output rates; preserve normal playback. */}
  }
  return new AudioContextClass();
}
