import {MODE_ENTRY_SECONDS} from './impact-titles.js';
const ZONES=['frame','accent','subtitle','title','push','warp'];
const all=color=>Object.fromEntries(ZONES.map(zone=>[zone,color]));
const BEATS={allure:[1.3,4,7.2,10.4,12.2],promise:[.55,2,4.3,11.1],judgment:[2.2,5.6,6.3,9.4,12,17.8],tribute:[.25,1.8,4.3,7.6],shutter:[1.6,3.2,6,9.5],temptation:[.2,1.1,2.2],mode:[3.3,4.2,5.35,6.05].map(at=>MODE_ENTRY_SECONDS+at)};

// Three-second PV cuts, half-shot accents and the frame share the song clock.
export function pvLighting(seconds,reducedMotion=false){
 const time=Math.max(0,Number.isFinite(seconds)?seconds:0),section=Math.floor(time/12)%4,local=time%3;
 const palette=['#98ffbb','#d09aff','#ffe07c','#ffd7ef'],color=palette[section];
 if(reducedMotion)return {colors:all(color),mode:'steady',brightness:.9,time:0};
 const impact=local<.16||local>=1.5&&local<1.66;
 return {colors:{...all(impact?'#fff4d0':color),accent:palette[(section+1)%4]},mode:impact?'steady':section===3?'rainbow':'pulse',pulseRate:1.7,rainbowSpeed:150,brightness:impact?1:.96,time};
}

// The same scene clock drives text, video and lamps. Pausing the scene freezes
// its lights too; no timer can spill a previous reach's flash into a new one.
export function sceneLighting({phase,mode,bonus,scene,elapsed=0,clock=0,pushedAt=null,promotion=false,reducedMotion=false}){
  let cue=null;
  if(phase==='result'){
    const wide=scene==='revival'&&elapsed>=1.6;
    const slam=wide&&[2.5,3.1].some(at=>elapsed>=at&&elapsed<at+.15);
    cue=wide?{colors:all(slam?'#fff2da':'#ec9bff'),mode:slam?'steady':'rainbow',rainbowSpeed:160,brightness:slam?1:.95,time:elapsed}
      :{colors:all(scene==='revival'&&elapsed>=.95?'#ffd3ec':'#746085'),mode:'steady',brightness:scene==='revival'&&elapsed>=.95?.9:.3,time:elapsed};
  }
  else if(scene==='spam')cue={colors:all('#ff485b'),mode:'pulse',pulseRate:2.8,brightness:.9,time:elapsed};
  else if(scene==='mode'){
    const local=elapsed-MODE_ENTRY_SECONDS;
    cue=local<0?{mode:'pulse',pulseRate:.9,colors:{...all('#ffe09a'),accent:'#c39bff',push:'#bdffdc'},brightness:.8,time:elapsed}
      :local<3.3?{mode:'pulse',pulseRate:1.1,colors:{frame:'#9a69f3',title:'#e2b4ff',push:'#bfffe1'},brightness:local<2.7?.5:.18,time:local}
      :{mode:'rainbow',rainbowSpeed:130,brightness:.95,time:local};
  }
  else if(phase==='win')cue={colors:all({blessing:'#91f5c4',queen:'#d58bff',awakening:'#ffda70'}[bonus]||'#91f5c4'),mode:bonus==='awakening'?'rainbow':'pulse',pulseRate:bonus==='queen'?3:1.2,rainbowSpeed:165,brightness:.95,time:elapsed};
  else if(phase==='reach'||scene){
    const soft=scene==='prayer',promise=scene==='promise',hot=scene==='judgment';
    const color=soft?'#a6efce':promise?(elapsed>=4.3?'#aaffc7':'#dca4ff'):hot?'#ff304b':['temptation','allure'].includes(scene)?'#ff78ca':'#d798ff';
    cue={colors:all(color),mode:'pulse',pulseRate:soft?.65:promise?1.1:hot?3:1.5,brightness:soft?.7:.95,time:elapsed};
  }else if(mode==='rush')cue={mode:'rainbow',rainbowSpeed:100,brightness:.9,time:clock};
  else if(mode==='challenge')cue={colors:{frame:'#b6ffe0',title:'#c699ff',push:'#b081ff'},mode:'pulse',pulseRate:1.5,brightness:.9,time:clock};
  if(!cue)return null;
  if(reducedMotion)return {...cue,mode:'steady',brightness:.8,time:0};
  const beats=phase==='win'?(promotion?[.8,1.55]:[0,bonus==='awakening'?.6:.7]):(BEATS[scene]||[]);
  const impact=beats.some(at=>elapsed>=at&&elapsed<at+.18);
  const pushed=phase==='reach'&&scene!=='prayer'&&pushedAt!==null&&elapsed>=pushedAt&&elapsed<pushedAt+.22;
  if(impact||pushed){
    cue={...cue,mode:'steady',brightness:1,colors:all(phase==='win'||scene==='mode'?'#fff0ad':scene==='judgment'?'#ff9f9f':['temptation','allure'].includes(scene)?'#ffd1ed':'#e9fff4')};
    cue.colors.accent=scene==='judgment'?'#ff304b':'#c494ff';
  }
  return cue;
}

// Low-load cabinet strips have no blur/masks. During ordinary play their color
// and opacity are steady; existing scene cues run only while an effect owns them.
const LOW_LOAD_IDLE_LIGHT=Object.freeze({mode:'steady',brightness:.46,time:0});
export function lowLoadCabinetLighting(cue,{active=false,pushAge=Infinity,reducedMotion=false}={}){
  if(!reducedMotion&&pushAge>=0&&pushAge<.24)
    return {...cue,mode:'steady',brightness:1,colors:cue?.colors??all('#fff0cd'),time:0};
  if(!active)return LOW_LOAD_IDLE_LIGHT;
  return cue??LOW_LOAD_IDLE_LIGHT;
}
