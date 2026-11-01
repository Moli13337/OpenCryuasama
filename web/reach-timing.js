// Presentation clocks only. These helpers never draw an outcome or mutate a hold.
export const BASE_REACH_TIMES = Object.freeze({
  standard:4.5, prayer:5, promise:32, judgment:45, tribute:32, shutter:15, allure:32,
});
export const RESOLVE_DELAY_SECONDS=4;
export const PRAYER_INTRO_SECONDS=7;
export const PRAYER_FIZZLE_SECONDS=10;
export const PRAYER_ASCENSION_SECONDS=45;
export const ALLURE_DEVELOPMENT_SECONDS=45;
export const TRIBUTE_DEVELOPMENT_SECONDS=60;
export const PROMISE_RED_SECONDS=44;
export const SHUTTER_REACH_SECONDS=11.2;
export const REACH_TIMES=Object.freeze({...Object.fromEntries(Object.entries(BASE_REACH_TIMES).map(([kind,duration])=>[kind,duration+RESOLVE_DELAY_SECONDS+(kind==='prayer'?PRAYER_INTRO_SECONDS:0)])),shutter:SHUTTER_REACH_SECONDS});
const LONG_TYPES = new Set(['promise','judgment','tribute','allure']);
const LEGACY_TIMING = Object.freeze({
  promise:{at:4.3,end:7.6,focus:11.1},judgment:{at:6.5,end:9.5,focus:12},
  tribute:{at:5.2,end:8.2,focus:7.6},allure:{at:7.2,end:10.2,focus:10.4},
});

const timingCache=new Map();
export function getReachTiming(type='standard',duration) {
  type=Object.hasOwn(REACH_TIMES,type)?type:'standard';
  duration=Number.isFinite(duration)&&duration>0?duration:REACH_TIMES[type];
  const key=type+':'+duration;
  if(timingCache.has(key))return timingCache.get(key);
  const plan=buildReachTiming(type,duration);
  if(timingCache.size>=64)timingCache.delete(timingCache.keys().next().value);
  timingCache.set(key,plan);return plan;
}
function buildReachTiming(type='standard',duration) {
  type=Object.hasOwn(REACH_TIMES,type)?type:'standard';
  // A restored active reach keeps its saved duration. No retiming on resume.
  duration=Number.isFinite(duration)&&duration>0?duration:REACH_TIMES[type];
  // New shutters resolve shortly after the original 9.5-second reveal. Saved
  // 15/19-second scenes keep their original focus and final suspense clocks.
  if(type==='shutter'&&[SHUTTER_REACH_SECONDS,15,19].includes(duration))return Object.freeze({
    type,duration,long:false,forecastEnd:0,resolveDelay:duration===19?RESOLVE_DELAY_SECONDS:0,introDuration:0,
    resultFocusAt:duration===SHUTTER_REACH_SECONDS?9.5:12,pushWindows:Object.freeze([]),
  });
  // Active saves from the first ascension retain their original 36-second
  // duration and absolute input windows; only newly started scenes use 45.
  if(type==='allure'&&duration===ALLURE_DEVELOPMENT_SECONDS)return Object.freeze({
    type,duration,long:true,forecastEnd:10,resolveDelay:RESOLVE_DELAY_SECONDS,introDuration:0,
    resultFocusAt:37,pushWindows:Object.freeze([Object.freeze({id:1,at:15,end:18}),Object.freeze({id:2,at:30,end:33})]),
  });
  if(type==='tribute'&&duration===TRIBUTE_DEVELOPMENT_SECONDS)return Object.freeze({
    type,duration,long:true,forecastEnd:10,resolveDelay:RESOLVE_DELAY_SECONDS,introDuration:0,
    resultFocusAt:54,pushWindows:Object.freeze([Object.freeze({id:1,at:18,end:24,repeat:true}),Object.freeze({id:2,at:45,end:48})]),
  });
  if(type==='promise'&&(duration===PROMISE_RED_SECONDS||duration===60))return Object.freeze({
    type,duration,long:true,forecastEnd:10,resolveDelay:RESOLVE_DELAY_SECONDS,introDuration:0,
    resultFocusAt:duration===60?56:40,pushWindows:Object.freeze([Object.freeze({id:1,at:15,end:18}),Object.freeze({id:2,at:duration===60?52:30,end:duration===60?55:33})]),
  });
  if(type==='prayer'&&(duration===PRAYER_ASCENSION_SECONDS||duration===36))return Object.freeze({
    type,duration,long:true,forecastEnd:0,resolveDelay:RESOLVE_DELAY_SECONDS,introDuration:PRAYER_INTRO_SECONDS,
    resultFocusAt:duration===36?4:37,pushWindows:Object.freeze([Object.freeze({id:1,at:15,end:18}),Object.freeze({id:2,at:30,end:33})]),
  });
  // Only new scenes get the longer final suspense. Saved clocks keep their cues.
  const resolveDelay=duration===REACH_TIMES[type]||(type==='prayer'&&[9,12,15,19].includes(duration))?RESOLVE_DELAY_SECONDS:0;
  const introDuration=type==='prayer'?(duration===REACH_TIMES.prayer?PRAYER_INTRO_SECONDS:duration===19?10:duration===15?6:duration===12?3:0):0;
  const originalDuration=duration-resolveDelay-introDuration;
  const long=LONG_TYPES.has(type)&&duration>=30,forecastEnd=long?10:0;
  const legacy=!long?LEGACY_TIMING[type]:null;
  const starts=long?[15,30]:legacy?[legacy.at]:type==='standard'?[2.2]:type==='prayer'?[3.6]:[];
  const pushWindows=Object.freeze(starts.filter(at=>at<originalDuration).map((at,index)=>Object.freeze({id:index+1,at:at+introDuration,end:Math.min(legacy?.end??at+3,originalDuration)+introDuration,...(type==='tribute'&&long?{repeat:true}:{})})));
  const focus=legacy?.focus??(type==='standard'?3.9:originalDuration-3);
  return Object.freeze({type,duration,long,forecastEnd,resolveDelay,introDuration,resultFocusAt:Math.max(forecastEnd,Math.min(duration,focus+introDuration)),pushWindows});
}

export function activePushWindow(elapsed,plan) {
  if(!Number.isFinite(elapsed)||elapsed<0||!plan)return null;
  return plan.pushWindows.find(window=>elapsed>=window.at&&elapsed<window.end)??null;
}

export function reachStage(elapsed,plan) {
  if(!plan)throw new TypeError('A reach timing plan is required');
  const time=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
  if(time>=plan.duration)return 'complete';
  if(time<plan.forecastEnd)return 'forecast';
  if(time>=plan.resultFocusAt)return 'climax';
  return 'development';
}
