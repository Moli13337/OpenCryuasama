import {PachinkoEngine} from './engine.js';
import {RelicSystem} from './relic-system.js';
import {createCreditLedger,validateCreditLedger} from './credit-codes.js';

export const SESSION_VERSION=1;
export const SESSION_STORAGE_KEY='yua-pachinko-trial-v1';
// Keep bounded copies in this origin; these cannot recover an entire origin's
// storage being removed or a browser/embedded frame using a different origin.
export const SESSION_BACKUP_MAX_CHARS=128*1024;
export const sessionBackupKeys=(key=SESSION_STORAGE_KEY)=>[`${key}:backup:1`,`${key}:backup:2`];
const MAX=Number.MAX_SAFE_INTEGER;
const invalid=path=>{throw new Error(`invalid:${path}`);};
const number=(min=-MAX,max=MAX,integer=false)=>(value,path)=>{
  if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))invalid(path);
  return value;
};
const n=number(),positive=number(0),int=number(0,MAX,true),signedInt=number(-MAX,MAX,true),unit=number(0,1);
const bool=(v,p)=>typeof v==='boolean'?v:invalid(p);
const one=(...values)=>(v,p)=>values.includes(v)?v:invalid(p);
const nullable=rule=>(v,p)=>v===null?null:rule(v,p);
const optional=rule=>({optional:true,rule});
const array=(rule,max,min=0)=>(value,path)=>{
  if(!Array.isArray(value)||value.length<min||value.length>max||Object.keys(value).length!==value.length)invalid(path);
  return value.map((v,i)=>rule(v,`${path}[${i}]`));
};
function object(shape,value,path){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)invalid(path);
  for(const key of Reflect.ownKeys(value)){
    if(typeof key!=='string'||!Object.hasOwn(shape,key)||!Object.getOwnPropertyDescriptor(value,key)?.enumerable||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))invalid(`${path}.${String(key)}`);
  }
  const out={};
  for(const [key,spec] of Object.entries(shape)){
    if(!Object.hasOwn(value,key)){if(spec.optional)continue;invalid(`${path}.${key}`);}
    out[key]=(spec.rule||spec)(value[key],`${path}.${key}`);
  }
  return out;
}
const record=shape=>(value,path)=>object(shape,value,path);
const symbols=array(number(1,9,true),3,3);
const mode=one('normal','challenge','rush');
const kind=nullable(one('blessing','queen','awakening'));
const shutter=nullable(record({change:bool,before:symbols,after:symbols,confidence:unit}));
const hold=record({
  id:number(1,MAX,true),win:bool,reach:bool,reachType:one('standard','prayer','promise','judgment','tribute','shutter','allure'),
  rush:bool,mode,demo:bool,color:one('white','green','purple','red','gold'),kind,rounds:one(0,4,8,12,15),
  rewardTarget:int,reelValues:symbols,shutter:optional(shutter),resultDemo:optional(bool),prayerDevelops:optional(bool),prayerAscension:optional(bool),allureDevelops:optional(bool),allureHotVoice:optional(bool),tributeBranch:optional(one('green','red')),promiseRed:optional(bool),tributeHotVoice:optional(bool),
  drawOdds:unit,bonusMultiplier:number(1,MAX,true),baseRewardTarget:int,guaranteed:bool,plainReachDemo:optional(bool),
});
const through=record({id:number(1,MAX,true),win:bool});
const ballShape={
  id:number(1,MAX,true),x:n,y:n,vx:n,vy:n,r:number(1,100),age:positive,trail:array(record({x:n,y:n}),7),
  pegCooldown:n,inWarp:bool,warpProgress:nullable(unit),warped:bool,route:nullable(one('A','B','R')),
  inLaunch:bool,launchProgress:unit,launchPower:unit,releaseVX:n,releaseVY:n,launchDuration:number(.00001,60),
  warpEntryVX:optional(n),inStage:optional(bool),throughPassed:optional(bool),bypassedWarp:optional(bool),expiryReported:optional(bool),
  colorTier:one('silver','blue','gold','rainbow'),colorMultiplier:one(1,2,5,10),ballValueMultiplier:number(1),
};
const statNames='shots entries spins wins bonusEntries routeA routeB routeRight warpEntries warpA warpB warpMissB entriesA entriesB attackerEntries payout rewardPayout hesoPayout denchuEntries denchuPayout throughPasses throughDraws throughWins stageCenter stageSpill outBalls expiredBalls'.split(' ');
const statsShape=Object.fromEntries(statNames.map(key=>[key,int]));
statsShape.stockAdjustments=optional(signedInt);
for(const name of ['bonusPayout','relicSpent','rerollSpent'])statsShape[name]=int;
const attackerShape={open:bool,openness:unit,round:one(0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15),totalRounds:one(0,4,8,12,15),
  count:int,countLimit:int,award:int,elapsed:positive,timeLimit:number(.00001,86400),payout:int,rewardPayout:int,rewardTarget:int,
  bonusMultiplier:number(1,MAX,true),baseRewardTarget:int};
const denchuShape={open:bool,openness:unit,elapsed:positive,openRemaining:positive};
const song=nullable(record({
  active:bool,holdId:number(1,MAX,true),duration:number(.00001,86400),time:positive,source:one('audio','virtual'),
  round:one(0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15),roundStartedAt:positive,roundEndsAt:positive,
  remainingToRound:positive,remaining:positive,progress:unit,waitingForNextRound:bool,countLimit:int,
  normalCountLimit:int,normalTimeLimit:number(.00001,86400),_pendingTime:positive,_lastAudioTime:nullable(positive),_stalledFor:positive,
}));
const relicIds=['fortune','bonus_double','ball_value','blue_rate','gold_rate','rainbow_rate','chain_one','chain_three'];
const relicState=record({
  version:one(1),purchases:record(Object.fromEntries(relicIds.map(id=>[id,int]))),guaranteedWins:int,epoch:int,rerollCount:int,
  offers:array(record({offerId:(v,p)=>typeof v==='string'&&/^\d+:\d+:[012]$/.test(v)?v:invalid(p),id:one(...relicIds),price:int,sold:bool}),3,3),
  shopRng:number(0,0xffffffff,true),colorRng:number(0,0xffffffff,true),
});
const engineShape={
  initialSeed:number(0,0xffffffff,true),_rng:int,layout:one('wide','large'),power:unit,stock:int,
  machineSetting:one(1,2,3,4,5,6),relics:relicState,stats:record(statsShape),balls:array(record(ballShape),80),
  holds:array(hold,4),specialHolds:array(hold,4),throughHolds:array(through,4),currentThrough:nullable(through),
  throughElapsed:positive,throughProgress:unit,phase:one('idle','spin','reach','win','lose'),phaseElapsed:positive,
  phaseDuration:positive,spinProgress:unit,winRemaining:positive,rushRemaining:int,mode,bonusState:nullable(one('intro','open','between')),
  bonusElapsed:positive,bonusKind:kind,bonusSong:song,currentSpin:nullable(hold),currentSpinResidual:bool,_shutterOpened:bool,
  resultDemoPending:nullable(hold),_specialSession:nullable(record({residualSpins:int,demo:bool})),
  reelValues:symbols,finalReelValues:symbols,reelStopped:array(bool,3,3),_shotClock:n,_holdSequence:int,_ballSequence:int,_reelTick:int,
  attacker:record(attackerShape),denchu:record(denchuShape),wheel:record({angle:n,omega:n}),
};
const rewardIds=['heart-v01','closer-v01','live-v01'];
const rewardState=record({version:one(1),unlockedIds:array(one(...rewardIds),3),completedIds:array(one(...rewardIds),3),
  positions:record(Object.fromEntries(rewardIds.map(id=>[id,optional(number(0,2,true))]))),activeId:nullable(one(...rewardIds)),imageOnly:bool});
export function createSessionRewardState(){return {version:1,unlockedIds:[],completedIds:[],positions:{},activeId:null,imageOnly:false};}

function select(source,shape){
  const out={};
  for(const key of Object.keys(shape))if(Object.hasOwn(source,key))out[key]=source[key];
  return out;
}
function uniqueIds(values,path){if(new Set(values).size!==values.length)invalid(path);}
function freezeHold(value){
  if(!value)return value;
  Object.freeze(value.reelValues);
  if(value.shutter){Object.freeze(value.shutter.before);Object.freeze(value.shutter.after);Object.freeze(value.shutter);}
  return Object.freeze(value);
}

// An exact, versioned whitelist: callbacks, assets, layout geometry and arbitrary
// properties are never taken from disk. Frozen hold decisions remain frozen.
export function validateSession(payload){
  try{
    if(payload?.version!==SESSION_VERSION)return {ok:false,reason:'version-mismatch'};
    const decoded=object({version:one(SESSION_VERSION),engine:record(engineShape),credits:(v,p)=>{
      if(!validateCreditLedger(v))invalid(p);return {version:1,used:[...v.used]};
    },rewards:rewardState},payload,'session');
    const e=decoded.engine,a=e.attacker,s=e.bonusSong,r=decoded.rewards;
    if(!new RelicSystem({seed:e.initialSeed}).importState(e.relics))invalid('relic-state');
    const allHolds=[...e.holds,...e.specialHolds,...(e.currentSpin?[e.currentSpin]:[]),...(e.resultDemoPending?[e.resultDemoPending]:[])];
    uniqueIds(allHolds.map(h=>h.id),'hold-ids');
    uniqueIds(e.balls.map(b=>b.id),'ball-ids');
    for(const h of allHolds){
      if(h.id>e._holdSequence||h.win!==(h.kind!==null)||h.win!==(h.rounds>0)||h.win&&!h.reach)invalid('hold-outcome');
      if(h.win&&!h.reelValues.every(v=>v===h.reelValues[0]))invalid('hold-symbols');
      if(!h.win&&h.reelValues.every(v=>v===h.reelValues[0]))invalid('miss-symbols');
      if(h.reachType==='shutter'&&!h.shutter)invalid('shutter-decision');
      if(h.prayerDevelops===false&&(h.reachType!=='prayer'||h.win))invalid('prayer-development');
      if(h.prayerAscension===true&&(h.reachType!=='prayer'||!h.reach||h.prayerDevelops!==true))invalid('prayer-ascension');
      if(h.allureDevelops===true&&(h.reachType!=='allure'||!h.reach))invalid('allure-development');
      if(h.allureHotVoice===true&&(h.reachType!=='allure'||!h.reach))invalid('allure-voice');
      if(h.tributeBranch&&(h.reachType!=='tribute'||!h.reach))invalid('tribute-branch');
      if(h.promiseRed===true&&(h.reachType!=='promise'||!h.reach))invalid('promise-red');
      // v24 briefly misattributed this voice to tribute. Accept those local
      // saves, but discard the obsolete presentation flag on the next save.
      if(h.tributeHotVoice===true&&(h.reachType!=='tribute'||!h.reach))invalid('legacy-tribute-voice');
      delete h.tributeHotVoice;
      if(h.kind!=='awakening'&&h.rewardTarget!==0)invalid('reward-kind');
      if(h.baseRewardTarget*h.bonusMultiplier!==h.rewardTarget||h.guaranteed&&!h.win)invalid('hold-guarantee');
    }
    for(const b of e.balls){if(b.id>e._ballSequence||(b.inWarp&&b.warpProgress===null)||(b.inWarp&&b.inLaunch))invalid('ball-state');}
    if(e.phase==='idle'&&e.currentSpin!==null||e.phase!=='idle'&&e.currentSpin===null)invalid('phase-hold');
    if(e.phase==='win'){
      if(!e.currentSpin.win||!e.bonusState||e.bonusKind!==e.currentSpin.kind||a.totalRounds!==e.currentSpin.rounds||a.rewardTarget!==e.currentSpin.rewardTarget)invalid('bonus-state');
      if(e.bonusState==='intro'&&(a.round!==0||a.open)||e.bonusState!=='intro'&&a.round===0)invalid('bonus-round');
      if(a.open&&e.bonusState!=='open')invalid('attacker-open');
    }else if(e.bonusState!==null||e.bonusKind!==null||a.open)invalid('inactive-bonus');
    // At song end the engine restores the ordinary capacity (5), while the
    // completed round's historical count may still be as high as 66.
    if(a.round>a.totalRounds||(e.phase==='win'&&a.count>a.countLimit)||!Number.isSafeInteger(a.payout+a.rewardPayout))invalid('attacker-ledger');
    if(s){
      if(s.time>s.duration+1e-6||s._pendingTime>s.duration+1e-6||s.roundEndsAt>s.duration+1e-6||s.roundStartedAt>s.roundEndsAt)invalid('song-time');
      if(s.active&&(e.phase!=='win'||e.currentSpin.kind!=='awakening'||s.holdId!==e.currentSpin.id||a.totalRounds!==15||s.round!==a.round))invalid('song-bonus');
    }
    uniqueIds(r.unlockedIds,'reward-unlocked');uniqueIds(r.completedIds,'reward-completed');
    if(r.completedIds.some(id=>!r.unlockedIds.includes(id))||r.activeId&&!r.unlockedIds.includes(r.activeId)||Object.keys(r.positions).some(id=>!r.unlockedIds.includes(id)))invalid('reward-access');
    return {ok:true,payload:decoded};
  }catch(error){return {ok:false,reason:error.message?.startsWith('invalid:')?error.message:'invalid-state'};}
}

export function captureSession(engine,{credits=createCreditLedger(),rewards=createSessionRewardState()}={}){
  const state=select(engine,engineShape);
  state.relics=engine.relics.exportState();
  state.attacker=select(engine.attacker,attackerShape);state.denchu=select(engine.denchu,denchuShape);
  state.wheel=select(engine.wheel,{angle:0,omega:0});
  const result=validateSession({version:SESSION_VERSION,engine:state,credits,rewards});
  if(!result.ok)throw new Error(result.reason);
  return result.payload;
}

function applyEngine(engine,state){
  const listener=engine.onEvent;
  try{
    engine.onEvent=()=>{};
    engine.balls=[];engine.attacker=null;engine.denchu=null;engine.bonusSong=null;
    engine.setLayout(state.layout);
    for(const key of Object.keys(engineShape)){
      if(['relics','attacker','denchu','wheel','layout','holds','specialHolds','currentSpin','resultDemoPending','throughHolds','currentThrough','finalReelValues'].includes(key))continue;
      engine[key]=state[key];
    }
    engine.holds=state.holds.map(freezeHold);engine.specialHolds=state.specialHolds.map(freezeHold);
    engine.currentSpin=freezeHold(state.currentSpin);engine.resultDemoPending=freezeHold(state.resultDemoPending);
    engine.throughHolds=state.throughHolds.map(Object.freeze);engine.currentThrough=state.currentThrough?Object.freeze(state.currentThrough):null;
    engine.finalReelValues=Object.freeze(state.finalReelValues);
    Object.assign(engine.attacker,state.attacker);Object.assign(engine.denchu,state.denchu);Object.assign(engine.wheel,state.wheel);
    engine.firing=false;
  }finally{engine.onEvent=listener;}
}

export function restoreSession(engine,payload){
  const checked=validateSession(payload);
  if(!checked.ok)return checked;
  const {engine:state,credits,rewards}=checked.payload;
  // Relic validation also checks price growth and offer identities. Validate on
  // a disposable engine before touching the live account or its static board.
  const candidate=new PachinkoEngine({seed:state.initialSeed});
  if(!candidate.relics?.importState(state.relics))return {ok:false,reason:'invalid-relic-state'};
  if(!engine.relics?.importState(state.relics))return {ok:false,reason:'invalid-relic-state'};
  applyEngine(engine,state);
  return {ok:true,credits,rewards,bonusSongResume:state.bonusSong?.active?{time:state.bonusSong.time,duration:state.bonusSong.duration}:null};
}

// A single localStorage record commits money, sold offers, unlocks and code use
// together. Revision checks detect stale tabs, but localStorage cannot provide
// cross-tab compare-and-swap. A conflict must pause play and require reloading;
// the caller must never continue making purchases on the stale engine.
export function createSessionStore(storage,{key=SESSION_STORAGE_KEY}={}){
  let baseRaw,lastValidRaw=null,recoveryRaws=null,revision=0,blocked=false,lastReason=null,backupReason=null,recovered=false;
  const backupKeys=sessionBackupKeys(key);
  const writer=globalThis.crypto?.randomUUID?.()||`trial-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function fail(reason){lastReason=reason;return {ok:false,reason,revision};}
  function read(readKey=key){
    try{return {ok:true,raw:storage.getItem(readKey)};}catch{return {ok:false,reason:'storage-read-failed'};}
  }
  function decode(raw){
    if(typeof raw!=='string'||raw.length>2_000_000)return {ok:false,reason:'invalid-record'};
    try{
      const value=JSON.parse(raw);
      if(value?.schema!==SESSION_VERSION)return {ok:false,reason:'version-mismatch'};
      const envelope=object({schema:one(SESSION_VERSION),revision:number(1,MAX,true),writer:(v,p)=>typeof v==='string'&&v.length>0&&v.length<150?v:invalid(p),savedAt:int,
        payload:(v,p)=>v},value,'record');
      const valid=validateSession(envelope.payload);
      return valid.ok?{ok:true,...envelope,payload:valid.payload}:valid;
    }catch{return {ok:false,reason:'corrupt-record'};}
  }
  function loadBackup(){
    let latest=null,found=false;const raws=[];
    for(const backupKey of backupKeys){
      const result=read(backupKey);
      if(!result.ok)return result;
      raws.push(result.raw);
      if(result.raw===null)continue;
      found=true;
      const decoded=decode(result.raw);
      // An unsupported newer record must not be silently rolled back.
      if(decoded.reason==='version-mismatch')return decoded;
      if(decoded.ok&&(!latest||decoded.revision>latest.revision))latest={...decoded,raw:result.raw};
    }
    return latest?{...latest,backupRaws:raws}:{ok:!found,reason:found?'backup-unreadable':'empty',payload:null};
  }
  function load(){
    const result=read();
    if(!result.ok){blocked=true;return fail(result.reason);}
    baseRaw=result.raw;
    recovered=false;recoveryRaws=null;
    // Read backups only when the primary is absent. A corrupt primary is kept
    // untouched and still blocks automatic saves, just as in older versions.
    const decoded=baseRaw===null?loadBackup():decode(baseRaw);
    if(!decoded.ok){blocked=true;return fail(decoded.reason);}
    if(!decoded.payload){revision=0;lastValidRaw=null;blocked=false;lastReason=null;return {ok:true,reason:'empty',payload:null,revision};}
    revision=decoded.revision;blocked=false;lastReason=null;
    lastValidRaw=baseRaw===null?decoded.raw:baseRaw;recovered=baseRaw===null;
    if(recovered)recoveryRaws=decoded.backupRaws;
    return {ok:true,payload:decoded.payload,revision,savedAt:decoded.savedAt,...(recovered?{recovered:true}:{})};
  }
  function keepBackups(raw,previous){
    backupReason=null;
    // Do not fill the origin's quota with two multi-megabyte snapshots. The
    // primary remains authoritative and a failed backup never undoes a commit.
    if(raw.length>SESSION_BACKUP_MAX_CHARS){backupReason='backup-too-large';return;}
    for(const [backupKey,value] of [[backupKeys[1],previous],[backupKeys[0],raw]]){
      if(!value||value.length>SESSION_BACKUP_MAX_CHARS)continue;
      try{storage.setItem(backupKey,value);}
      catch{backupReason='backup-write-failed';}
    }
  }
  function checkRevision(){
    if(blocked)return fail(lastReason||'reload-required');
    const current=read();if(!current.ok)return fail(current.reason);
    if(baseRaw===undefined){
      if(current.raw!==null){blocked=true;return fail('load-required');}
      const backup=loadBackup();
      if(!backup.ok||backup.payload){blocked=true;return fail(backup.ok?'load-required':backup.reason);}
      baseRaw=null;
    }
    if(current.raw!==baseRaw){blocked=true;return fail('revision-conflict');}
    // While waiting for the recovered-save continuation button, another tab
    // may replace or clear the backups even though the primary is still null.
    if(recoveryRaws)for(let i=0;i<backupKeys.length;i++){
      const backup=read(backupKeys[i]);if(!backup.ok)return fail(backup.reason);
      if(backup.raw!==recoveryRaws[i]){blocked=true;return fail('revision-conflict');}
    }
    return {ok:true,revision};
  }
  function save(payload){
    const valid=validateSession(payload);if(!valid.ok)return fail(valid.reason);
    const checked=checkRevision();if(!checked.ok)return checked;
    if(revision===MAX)return fail('revision-limit');
    let raw;
    try{raw=JSON.stringify({schema:SESSION_VERSION,revision:revision+1,writer,savedAt:Date.now(),payload:valid.payload});}
    catch{return fail('serialization-failed');}
    if(raw.length>2_000_000)return fail('record-too-large');
    try{storage.setItem(key,raw);}catch{return fail('storage-write-failed');}
    const verified=read();
    if(!verified.ok||verified.raw!==raw){blocked=true;return fail(verified.ok?'revision-conflict':'write-unverified');}
    const previous=lastValidRaw;
    baseRaw=raw;lastValidRaw=raw;recoveryRaws=null;revision++;lastReason=null;recovered=false;
    keepBackups(raw,previous);
    return {ok:true,revision};
  }
  return {load,save,checkRevision,get status(){return {revision,blocked,reason:lastReason,key,recovered,backupReason};}};
}
