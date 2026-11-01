// User-selected 1/99.9 normal probability. All draws are captured at entry.
import { createLayout, BOARD_WIDTH, BOARD_HEIGHT } from './layout.js';
import { RelicSystem } from './relic-system.js';
import { resultSymbols } from './result-symbols.js';
import { REACH_TIMES,PRAYER_FIZZLE_SECONDS,PRAYER_ASCENSION_SECONDS,ALLURE_DEVELOPMENT_SECONDS,TRIBUTE_DEVELOPMENT_SECONDS,PROMISE_RED_SECONDS } from './reach-timing.js';
export { REACH_TIMES } from './reach-timing.js';
export { RELIC_CATALOG } from './relic-system.js';
export const NORMAL_ODDS = 1 / 99.9;
export const SPECIAL_ODDS = 1 / 7.4;
export const SETTINGS_ODDS=Object.freeze(Object.fromEntries([149.9,124.9,99.9,89.9,74.9,59.9].map((normal,index)=>[index+1,Object.freeze({normalOdds:1/normal,specialOdds:1/[9.9,8.7,7.4,6.9,6.2,5.5][index]})])));
export const REWARD_RULES = Object.freeze({ awakening:3000, special:10000, specialChance:.01 });
export const SPIN_TIMING = Object.freeze({ duration:4.2, left:1.4, right:2.7, center:4.1 });
export const MISS_RESULT_TIMES = Object.freeze({ ordinary:0.7, reach:8.8 });
export const RESIDUAL_PHASE_TIMES = Object.freeze({spin:.45,reach:.35,lose:.2});
export const BONUS_RULES = Object.freeze(Object.fromEntries([
  ['blessing','祝福',4,3],['queen','女王',8,6],['awakening','覚醒',15,10],
].map(([kind,label,rounds,specialSpins])=>[kind,Object.freeze({kind,label,rounds,specialSpins,countLimit:5,award:10,maxAward:rounds*50})])));
export const SHOT_INTERVAL = 0.6;
export const BOARD = Object.freeze({
  width: BOARD_WIDTH, height: BOARD_HEIGHT, gravity: 1050,
  start: Object.freeze({ ...createLayout('wide').start }),
  layouts: Object.freeze({
    wide: Object.freeze({ ...createLayout('wide').screenBoundingBox }),
    large: Object.freeze({ ...createLayout('large').screenBoundingBox }),
  }),
});
const MAX_BALLS = 80;
const MAX_HOLDS = 4;
const PHASE_TIMES = { idle: 0, spin: SPIN_TIMING.duration, reach: REACH_TIMES.standard, win: 4, lose: MISS_RESULT_TIMES.ordinary };
export const ALLURE_RULES=Object.freeze({rate:.12,duration:REACH_TIMES.allure});
// A pure, seed-and-hold decoration hash. It consumes neither game nor color
// randomness, and also accounts for the high word of a saved hold sequence.
export function allureCue(initialSeed,holdId){
  let value=(initialSeed>>>0)^Math.imul(holdId>>>0,0x9e3779b1)^Math.imul(Math.floor(holdId/4294967296),0x85ebca6b);
  value=Math.imul(value^(value>>>16),0x85ebca6b);
  value=Math.imul(value^(value>>>13),0xc2b2ae35);
  return ((value^(value>>>16))>>>0)/4294967296<ALLURE_RULES.rate;
}
export const ALLURE_DEVELOPMENT_RULES=Object.freeze({hitRate:.35,missRate:.08,duration:ALLURE_DEVELOPMENT_SECONDS});
// This independent presentation hash does not consume a win, symbol or relic roll.
export function allureDevelopmentCue(initialSeed,holdId,win){
  let value=(initialSeed>>>0)^0xa117e5c3^Math.imul(holdId>>>0,0x693b21af)^Math.imul(Math.floor(holdId/4294967296),0x7e9f341d);
  value=Math.imul(value^(value>>>16),0x7feb352d);
  value=Math.imul(value^(value>>>15),0x846ca68b);
  return ((value^(value>>>16))>>>0)/4294967296<(win?ALLURE_DEVELOPMENT_RULES.hitRate:ALLURE_DEVELOPMENT_RULES.missRate);
}
export const ALLURE_VOICE_RULES=Object.freeze({hitRate:.5,missRate:.04});
// The red voice is a hotter forecast within allure, independent of its white
// development tier. It never changes the draw stream or the captured result.
export function allureHotVoiceCue(initialSeed,holdId,win){
  let value=(initialSeed>>>0)^0x7b8e39c1^Math.imul(holdId>>>0,0x2d73ab59)^Math.imul(Math.floor(holdId/4294967296),0x4f1bbcdc);
  value=Math.imul(value^(value>>>16),0x7feb352d);
  value=Math.imul(value^(value>>>15),0x846ca68b);
  return ((value^(value>>>16))>>>0)/4294967296<(win?ALLURE_VOICE_RULES.hitRate:ALLURE_VOICE_RULES.missRate);
}
export const TRIBUTE_BRANCH_RULES=Object.freeze({redHitRate:.35,redMissRate:.02,greenHitRate:.3,greenMissRate:.1,duration:TRIBUTE_DEVELOPMENT_SECONDS});
export const PROMISE_RED_RULES=Object.freeze({hitRate:.55,missRate:.04,duration:PROMISE_RED_SECONDS});
// Red is a hotter presentation of an already captured promise outcome.
export function promiseRedCue(initialSeed,holdId,win){
  let value=(initialSeed>>>0)^0x70a115e9^Math.imul(holdId>>>0,0x63d83595)^Math.imul(Math.floor(holdId/4294967296),0x51a7c3e9);
  value=Math.imul(value^(value>>>16),0x7feb352d);value=Math.imul(value^(value>>>15),0x846ca68b);
  return ((value^(value>>>16))>>>0)/4294967296<(win?PROMISE_RED_RULES.hitRate:PROMISE_RED_RULES.missRate);
}
export function tributeBranchCue(initialSeed,holdId,win){
  let value=(initialSeed>>>0)^0x5a1b72d9^Math.imul(holdId>>>0,0x4c87e1ab)^Math.imul(Math.floor(holdId/4294967296),0x2793b417);
  value=Math.imul(value^(value>>>16),0x7feb352d);
  value=Math.imul(value^(value>>>15),0x846ca68b);
  const roll=((value^(value>>>16))>>>0)/4294967296;
  if(roll<(win?TRIBUTE_BRANCH_RULES.redHitRate:TRIBUTE_BRANCH_RULES.redMissRate))return 'red';
  if(roll<(win?TRIBUTE_BRANCH_RULES.redHitRate+TRIBUTE_BRANCH_RULES.greenHitRate:TRIBUTE_BRANCH_RULES.redMissRate+TRIBUTE_BRANCH_RULES.greenMissRate))return 'green';
  return null;
}
export const PRAYER_ASCENSION_RULES=Object.freeze({hitRate:.6,developedMissRate:.02,duration:PRAYER_ASCENSION_SECONDS});
// A separate decoration hash, allocated after allure and prayer development.
// Its salt is independent of allure: no extra outcome/color roll, no reuse of
// the shutter or fizzle intervals inside outcomeRoll, and no change to odds.
export function prayerAscensionCue(initialSeed,holdId,win){
  let value=(initialSeed>>>0)^0x51a7c3e9^Math.imul(holdId>>>0,0x27d4eb2d)^Math.imul(Math.floor(holdId/4294967296),0x165667b1);
  value=Math.imul(value^(value>>>16),0x7feb352d);
  value=Math.imul(value^(value>>>15),0x846ca68b);
  const roll=((value^(value>>>16))>>>0)/4294967296;
  return roll<(win?PRAYER_ASCENSION_RULES.hitRate:PRAYER_ASCENSION_RULES.developedMissRate);
}
// This game's ordinary-mode reconstruction: confidence means P(hit | cue),
// not a second win draw or the original machine's symbol-change frequency.
export const SHUTTER_RULES = Object.freeze({
  duration:15, closeAt:1.2, closedAt:1.6, openAt:9.5, openEnd:10.3,
  same:Object.freeze({frequency:.012,confidence:.12}),
  change:Object.freeze({frequency:.004,confidence:.37}),
  // Preserve prayer and tribute. Remaining hit candidates: .5 * .96;
  // remaining miss candidates: reach .3 * (red .25 - tribute .04).
  eligibleHit:.5*.96, eligibleMiss:.3*(.25-.04),
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const launchBlend=(t,from,to,fromSlope,toSlope)=>
  (2*t**3-3*t*t+1)*from+(t**3-2*t*t+t)*.2*fromSlope+(-2*t**3+3*t*t)*to+(t**3-t*t)*.2*toSlope;

export class PachinkoEngine {
  constructor({ seed = 20260916, onEvent = () => {} } = {}) {
    this.initialSeed = Number(seed) >>> 0;
    this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
    this.layout = 'wide';
    this.machineSetting=3;
    // Debug-only probability overrides are never part of a saved session.
    this.debugOdds=null;
    this.power = 0.58;
    this.start = { ...BOARD.start };
    this.reset();
  }

  _random() {
    let value = this._rng += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }

  _emit(type, details = {}) { this.onEvent({ type, ...details }); }

  reset() {
    this._rng = this.initialSeed;
    this.relics=new RelicSystem({seed:this.initialSeed});
    this.balls = [];
    this.holds = [];
    this.specialHolds = [];
    this.throughHolds=[];
    this.currentThrough=null;
    this.throughElapsed=0;
    this.throughProgress=0;
    this.stock = 500;
    this.stats = { shots: 0, entries: 0, spins: 0, wins: 0, bonusEntries: 0, bonusPayout:0, relicSpent:0, rerollSpent:0, stockAdjustments:0, routeA: 0, routeB: 0, routeRight:0, warpEntries: 0, warpA: 0, warpB: 0, warpMissB: 0, entriesA: 0, entriesB: 0, attackerEntries:0, payout:0, rewardPayout:0, hesoPayout:0, denchuEntries:0, denchuPayout:0, throughPasses:0, throughDraws:0, throughWins:0, stageCenter:0, stageSpill:0, outBalls:0, expiredBalls:0 };
    this.firing = false;
    this._resultIntake = false;
    this.phase = 'idle';
    this.phaseElapsed = 0;
    this.phaseDuration = 0;
    this.spinProgress = 0;
    this.winRemaining = 0;
    this.rushRemaining = 0;
    this.mode='normal';
    this.bonusState=null;
    this.bonusElapsed=0;
    this.bonusKind=null;
    this.bonusSong=null;
    this.currentSpin = null;
    this.currentSpinResidual = false;
    this._shutterOpened = false;
    this.resultDemoPending = null;
    this._specialSession = null;
    this.reelValues = [3, 5, 7];
    this.finalReelValues=Object.freeze([3,5,7]);
    this.reelStopped=[true,true,true];
    this._shotClock = 0;
    this._holdSequence = 0;
    this._ballSequence = 0;
    this._reelTick = 0;
    this.attacker=null;
    this.denchu=null;
    this.setLayout(this.layout);
    this._emit('reset');
  }

  setFiring(value) { this.firing = Boolean(value); }

  setMachineSetting(value){
    if(!Number.isInteger(value)||!Object.hasOwn(SETTINGS_ODDS,value))return false;
    this.machineSetting=value;this._emit('machine-setting',{setting:value,summary:this.getRelicSummary()});return true;
  }

  setDebugOdds(value){
    if(value===null){this.debugOdds=null;this._emit('debug-odds',{odds:null});return true;}
    if(!value||!Number.isFinite(value.normalOdds)||!Number.isFinite(value.specialOdds)||
      value.normalOdds<=0||value.normalOdds>1||value.specialOdds<=0||value.specialOdds>1)return false;
    this.debugOdds=Object.freeze({normalOdds:value.normalOdds,specialOdds:value.specialOdds});
    this._emit('debug-odds',{odds:this.debugOdds});return true;
  }

  getRelicSummary(){return {...this.relics.summary(SETTINGS_ODDS[this.machineSetting]),...this.debugOdds,machineSetting:this.machineSetting};}
  getRelicShop(){return {...this.relics.getShop(this.stock,SETTINGS_ODDS[this.machineSetting]),summary:this.getRelicSummary()};}

  buyRelic(offerId){
    const result=this.relics.buy(offerId,this.stock);if(!result.ok)return result;
    this.stock=result.stock;this.stats.relicSpent+=result.cost;
    const response={...result,summary:this.getRelicSummary()};
    this._emit('relic-purchase',response);return response;
  }

  rerollRelics(){
    const result=this.relics.reroll(this.stock);if(!result.ok)return result;
    this.stock=result.stock;this.stats.rerollSpent+=result.cost;
    const response={...result,summary:this.getRelicSummary()};
    this._emit('relic-reroll',response);return response;
  }

  changeStock(delta,reason='adjustment'){
    if(!Number.isSafeInteger(delta)||!Number.isSafeInteger(this.stock)||!Number.isSafeInteger(this.stock+delta)||this.stock+delta<0)
      return {ok:false,reason:'invalid-stock-change',stock:this.stock};
    this.stock+=delta;this.stats.stockAdjustments+=delta;
    const result={ok:true,reason:typeof reason==='string'?reason:'adjustment',delta,stock:this.stock};
    this._emit('stock-change',result);return result;
  }

  _captureHold(details){
    const summary=this.getRelicSummary(),baseRewardTarget=details.rewardTarget??0;
    return Object.freeze({...details,drawOdds:details.rush?summary.specialOdds:summary.normalOdds,
      bonusMultiplier:summary.bonusMultiplier,baseRewardTarget,rewardTarget:baseRewardTarget*summary.bonusMultiplier,
      guaranteed:details.guaranteed??false});
  }

  _ballAward(base,ball){return Math.floor(base*(ball.colorMultiplier??1)*(ball.ballValueMultiplier??1)+1e-9);}


  setPower(value) {
    if (Number.isFinite(Number(value))) this.power = clamp(Number(value), 0, 1);
  }

  setLayout(layout) {
    if (!Object.hasOwn(BOARD.layouts, layout)) return false;
    this.layout = layout;
    this.layoutData = createLayout(layout);
    const previousAttacker=this.attacker;
    this.attacker=this.layoutData.attacker;
    Object.assign(this.attacker,{rewardPayout:0,rewardTarget:0,baseRewardTarget:0,bonusMultiplier:1});
    if(previousAttacker)for(const key of ['open','openness','round','totalRounds','count','elapsed','payout','rewardPayout','rewardTarget','baseRewardTarget','bonusMultiplier','award'])this.attacker[key]=previousAttacker[key];
    if(previousAttacker&&this.bonusSong?.active)for(const key of ['countLimit','timeLimit'])this.attacker[key]=previousAttacker[key];
    const previousDenchu=this.denchu;
    this.denchu=this.layoutData.denchu;
    if(previousDenchu)for(const key of ['open','openness','elapsed','openRemaining'])this.denchu[key]=previousDenchu[key];
    this.screen = this.layoutData.screenBoundingBox;
    this.screenPolygon = this.layoutData.screenPolygon;
    for (const key of ['pegs','rails','splitterSegments','routeGate','routeChannels','wheel','warp','stage','through','outlet','start','hesoGate','bonusPocket','launchPath','launch']) this[key] = this.layoutData[key];
    this.dividerSegments = this.layoutData.routeChannels.dividerSegments;
    this.outerWalls = this.layoutData.outerWalls;
    // Switching the frame cannot strand a ball inside the enlarged display.
    for (const ball of this.balls) if (!ball.inWarp && !ball.inLaunch) this._screenCollision(ball);
    this._emit('layout', { layout, screen: this.screen, layoutData: this.layoutData });
    return true;
  }

  triggerDemo(kind='queen',options={}) {
    if(!Object.hasOwn(BONUS_RULES,kind))return false;
    const queue=this.mode==='normal'?this.holds:this.specialHolds;
    if (queue.length >= MAX_HOLDS || this.resultDemoPending || this.currentSpin?.demo || [...this.holds,...this.specialHolds].some(hold => hold.demo)) return false;
    const rewardTarget=kind==='awakening'?(options?.rewardTarget===REWARD_RULES.special?REWARD_RULES.special:REWARD_RULES.awakening):0;
    const id=++this._holdSequence;
    const hold = this._captureHold({ id, win: true, reach: true, reachType:'standard', rush: this.mode!=='normal', mode:this.mode, demo: true, color: 'gold',kind,rounds:kind==='queen'&&options?.even===true?12:BONUS_RULES[kind].rounds,rewardTarget,reelValues:this._resultSymbols(true,true,kind,options?.even===true,id) });
    queue.push(hold);
    this._emit('demo', { hold });
    return true;
  }

  // Opt in while this awakening is still in its intro. A valid initial
  // duration belongs to this hold only; later metadata cannot rescale rewards.
  // Feed actual media.currentTime each frame, or null for silent virtual time.
  setBonusSongClock(time,duration){
    if(this.phase!=='win'||this.currentSpin?.kind!=='awakening'||this.currentSpin.rounds!==15)return false;
    if(time!==null&&(!Number.isFinite(time)||time<0))return false;
    let song=this.bonusSong;
    if(!song){
      if(this.bonusState!=='intro'||this.attacker.round!==0||!Number.isFinite(duration)||duration<=0)return false;
      song=this.bonusSong={active:true,holdId:this.currentSpin.id,duration,time:0,source:time===null?'virtual':'audio',
        round:0,roundStartedAt:0,roundEndsAt:duration/15,remainingToRound:duration/15,remaining:duration,
        progress:0,waitingForNextRound:false,countLimit:0,
        normalCountLimit:this.attacker.countLimit,normalTimeLimit:this.attacker.timeLimit,
        _pendingTime:0,_lastAudioTime:null,_stalledFor:0};
    }
    if(!song.active||song.holdId!==this.currentSpin.id)return false;
    if(time===null){song.source='virtual';return true;}
    const advanced=song._lastAudioTime===null||time>song._lastAudioTime+1e-7;
    if(advanced){song.source='audio';song._stalledFor=0;}
    song._lastAudioTime=time;
    song._pendingTime=Math.max(song._pendingTime,clamp(time,0,song.duration));
    return true;
  }

  triggerPrayerDemo(win=false,{develop=true,strong=false}={}){
    const queue=this.mode==='normal'?this.holds:this.specialHolds;
    if(queue.length>=MAX_HOLDS||this.resultDemoPending||this.currentSpin?.demo||[...this.holds,...this.specialHolds].some(hold=>hold.demo))return false;
    win=Boolean(win);
    const kind=win?'blessing':null;
    const id=++this._holdSequence;
    const prayerDevelops=win||develop!==false;
    const hold=this._captureHold({id,win,reach:true,reachType:'prayer',prayerDevelops,...(strong===true&&prayerDevelops?{prayerAscension:true}:{}),rush:this.mode!=='normal',mode:this.mode,demo:true,
      color:win?'gold':'green',kind,rounds:win?BONUS_RULES.blessing.rounds:0,rewardTarget:0,reelValues:this._resultSymbols(win,true,kind,false,id)});
    queue.push(hold);this._emit('demo',{hold});
    return true;
  }

  triggerReachDemo(type,win=false,{develop=false,hotVoice=false,tributeBranch=null,promiseRed=false}={}){
    if(type!=='standard'&&type!=='promise'&&type!=='judgment'&&type!=='tribute'&&type!=='allure')return false;
    if(tributeBranch!==null&&(type!=='tribute'||!['green','red'].includes(tributeBranch)))return false;
    const queue=this.mode==='normal'?this.holds:this.specialHolds;
    if(queue.length>=MAX_HOLDS||this.resultDemoPending||this.currentSpin?.demo||[...this.holds,...this.specialHolds].some(hold=>hold.demo))return false;
    win=Boolean(win);
    const kind=win?(type==='judgment'?'awakening':'queen'):null;
    const id=++this._holdSequence;
    const hold=this._captureHold({id,win,reach:true,reachType:type,...(type==='standard'?{plainReachDemo:true}:{}),...(type==='allure'&&develop?{allureDevelops:true}:{}),...(type==='allure'&&hotVoice?{allureHotVoice:true}:{}),...(tributeBranch?{tributeBranch}:{}),...(type==='promise'&&promiseRed?{promiseRed:true}:{}),rush:this.mode!=='normal',mode:this.mode,demo:true,
      color:win?'gold':'red',kind,rounds:kind?BONUS_RULES[kind].rounds:0,rewardTarget:kind==='awakening'?REWARD_RULES.awakening:0,reelValues:this._resultSymbols(win,true,kind,false,id)});
    queue.push(hold);this._emit('demo',{hold});
    return true;
  }

  triggerShutterDemo({win=false,change=false,kind='queen',even=false,rewardTarget=3000}={}){
    if(!Object.hasOwn(BONUS_RULES,kind))return false;
    const queue=this.mode==='normal'?this.holds:this.specialHolds;
    if(queue.length>=MAX_HOLDS||this.resultDemoPending||this.currentSpin?.demo||[...this.holds,...this.specialHolds].some(hold=>hold.demo))return false;
    win=Boolean(win);change=Boolean(change);kind=win?kind:null;
    const id=++this._holdSequence;
    const reels=this._resultSymbols(win,true,kind,even===true,id);
    const hold=this._captureHold({id,win,reach:true,reachType:'shutter',rush:this.mode!=='normal',mode:this.mode,demo:true,
      color:win?'gold':'red',kind,rounds:kind==='queen'&&even===true?12:kind?BONUS_RULES[kind].rounds:0,
      rewardTarget:kind==='awakening'?(rewardTarget===REWARD_RULES.special?REWARD_RULES.special:REWARD_RULES.awakening):0,
      reelValues:reels,shutter:this._shutterVisual(reels,change)});
    queue.push(hold);this._emit('demo',{hold});
    return true;
  }

  triggerResultDemo(win=false) {
    if(this.mode!=='normal'||this.phase==='win'||this.resultDemoPending||this.currentSpin?.demo||
      this.specialHolds.length||this.holds.some(hold=>hold.demo))return false;
    win=Boolean(win);
    const kind=win?'queen':null;
    const id=++this._holdSequence;
    const hold=this._captureHold({id,win,reach:true,reachType:'standard',rush:true,mode:'rush',demo:true,resultDemo:true,
      color:win?'gold':'red',kind,rounds:kind?BONUS_RULES[kind].rounds:0,rewardTarget:0,reelValues:this._resultSymbols(win,true,kind,false,id)});
    // Separate reservation: no active outcome or existing queue is replaced.
    this.resultDemoPending=hold;
    this._emit('demo',{hold,result:true});
    return true;
  }

  _drawHold({guaranteed=false,mode=this.mode}={}) {
    const rush = mode!=='normal';
    const summary=this.getRelicSummary();
    const odds=rush?summary.specialOdds:summary.normalOdds;
    const outcomeRoll=this._random();
    const win = guaranteed || outcomeRoll < odds;
    const kindDraw=win?this._random():null;
    const kind=win?(kindDraw<.5?'blessing':kindDraw<.85?'queen':'awakening'):null;
    const reach = win || this._random() < 0.3;
    const tease = this._random();
    const color = win ? (tease < 0.48 ? 'red' : 'purple') : reach ? (tease < 0.25 ? 'red' : 'green') : 'white';
    let reachType=!rush&&reach&&((!win&&color==='green')||(win&&kind==='blessing'))?'prayer':'standard';
    if(!rush&&reach&&reachType==='standard'){
      reachType=win?(kind==='queen'&&tease>=.48?'promise':'judgment'):(tease<.125?'promise':'judgment');
    }
    // Tribute is an independent ordinary reach. Prayer has already been
    // selected above and is never repurposed; the outcome uses no new roll.
    if(!rush&&reach&&reachType!=='prayer'&&tease>=.18&&tease<.22)reachType='tribute';
    const id=++this._holdSequence;
    const reelValues=this._resultSymbols(win,reach,kind,kind==='queen'&&tease<.25,id);
    let shutter=null;
    if(!rush&&reach&&reachType!=='prayer'&&reachType!=='tribute'){
      // Conditional position inside the hit/miss interval is uniform and
      // independent of kind/tease. Reusing it leaves all three RNG calls intact.
      const cueRoll=win?outcomeRoll/odds:(outcomeRoll-odds)/(1-odds);
      const eligible=win?SHUTTER_RULES.eligibleHit:SHUTTER_RULES.eligibleMiss;
      const conditional=rule=>rule.frequency*(win?rule.confidence:1-rule.confidence)/((win?odds:1-odds)*eligible);
      const same=conditional(SHUTTER_RULES.same),change=conditional(SHUTTER_RULES.change);
      if(cueRoll<same+change){
        reachType='shutter';shutter=this._shutterVisual(reelValues,cueRoll>=same);
      }
    }
    if (rush) this.rushRemaining--;
    const rewardTarget=kind==='awakening'?(tease<REWARD_RULES.specialChance?REWARD_RULES.special:REWARD_RULES.awakening):0;
    // Final presentation-only allocation includes ordinary prayer candidates;
    // shutter and all special-mode draws retain their existing presentation.
    if(!rush&&reach&&reachType!=='shutter'&&allureCue(this.initialSeed,id))reachType='allure';
    const allureBranch=reachType==='allure'&&allureDevelopmentCue(this.initialSeed,id,win)?{allureDevelops:true}:{};
    const allureVoiceBranch=reachType==='allure'&&allureHotVoiceCue(this.initialSeed,id,win)?{allureHotVoice:true}:{};
    const tributeBranch=reachType==='tribute'?tributeBranchCue(this.initialSeed,id,win):null;
    const promiseBranch=reachType==='promise'&&promiseRedCue(this.initialSeed,id,win)?{promiseRed:true}:{};
    const prayerBranch=reachType==='prayer'?{prayerDevelops:win||(outcomeRoll-odds)/(1-odds)>=.4}:{};
    if(prayerBranch.prayerDevelops&&prayerAscensionCue(this.initialSeed,id,win))prayerBranch.prayerAscension=true;
    return this._captureHold({ id, win, reach, reachType,...prayerBranch,...allureBranch,...allureVoiceBranch,...promiseBranch,...(tributeBranch?{tributeBranch}:{}), rush, mode, demo: false, color,kind,rounds:kind==='queen'&&tease<.25?12:kind?BONUS_RULES[kind].rounds:0,rewardTarget,reelValues,shutter,guaranteed });
  }

  _shutterVisual(reels,change){
    const symbol=reels[0],middle=symbol%9+1;
    const after=Object.freeze([symbol,middle,symbol]);
    const previous=(symbol+1)%9+1;
    const before=change?Object.freeze([previous,previous%9+1,previous]):after;
    return Object.freeze({change,before,after,confidence:SHUTTER_RULES[change?'change':'same'].confidence});
  }

  _resultSymbols(win,reach,kind,even,holdId){
    return resultSymbols({seed:this.initialSeed,holdId,win,reach,kind,even});
  }

  _entry(ball) {
    this.stats.entries++;
    if (ball.route === 'A') this.stats.entriesA++;
    if (ball.route === 'B') this.stats.entriesB++;
    const queue=this.holds;
    const accepted = (this._resultIntake||this.mode==='normal'&&this.phase!=='win')&&queue.length<MAX_HOLDS;
    const hold = accepted ? this._drawHold({mode:this._resultIntake?'normal':this.mode}) : null;
    if (hold) queue.push(hold);
    const award=this._ballAward(this.phase==='win'||this.mode!=='normal'?1:0,ball);
    if(award){this.stock+=award;this.stats.hesoPayout+=award;}
    this._emit('entry', { x: ball.x, y: ball.y, accepted, hold, id: ball.id, route: ball.route,award });
  }

  _denchuEntry(ball){
    if(!this.denchu.open||(!this._resultIntake&&(this.phase==='win'||this.mode==='normal')))return false;
    this.stats.denchuEntries++;
    const queue=this._resultIntake?this.holds:this.specialHolds;
    const accepted=(this._resultIntake||this.rushRemaining>0)&&queue.length<MAX_HOLDS;
    const guaranteed=accepted&&!this._resultIntake&&this.relics.consumeGuarantee();
    const hold=accepted?this._drawHold({guaranteed:Boolean(guaranteed),mode:this._resultIntake?'normal':this.mode}):null;
    if(hold)queue.push(hold);
    if(guaranteed)this._emit('guarantee-used',{hold,remaining:this.relics.guaranteedWins});
    const award=this._ballAward(this.denchu.award,ball);
    this.stock+=award;this.stats.denchuPayout+=award;
    this._emit('denchu-entry',{x:ball.x,y:ball.y,id:ball.id,accepted,hold,award});
    this._advanceDenchu(0);
    return true;
  }

  _advanceDenchu(dt){
    const eligible=this.mode!=='normal'&&this.phase!=='win'&&this.rushRemaining>0&&this.specialHolds.length<MAX_HOLDS;
    this.denchu.openRemaining=Math.max(0,this.denchu.openRemaining-dt);
    if(this.denchu.openRemaining>0)this.denchu.elapsed+=dt;
    // Keep the right receiver available while the result is covering the board.
    // These entries reserve ordinary draws; they never extend an exhausted ST.
    const open=this._resultIntake?this.holds.length<MAX_HOLDS:eligible&&this.denchu.openRemaining>0;
    const changed=this.denchu.open!==open;
    this.denchu.open=open;this.denchu.openness=open?1:0;
    if(changed)this._emit('denchu',{open,mode:this.mode});
  }

  _throughPass(ball){
    if(ball.throughPassed)return;
    ball.throughPassed=true;this.stats.throughPasses++;
    const accepted=this.mode!=='normal'&&this.phase!=='win'&&this.rushRemaining>0&&this.throughHolds.length<MAX_HOLDS;
    const hold=accepted?Object.freeze({id:ball.id,win:this._random()<this.through.odds}):null;
    if(hold)this.throughHolds.push(hold);
    this._emit('through',{id:ball.id,x:ball.x,y:ball.y,accepted,hold});
  }

  _advanceThrough(dt){
    if(this.mode==='normal'||this.phase==='win'||this.rushRemaining<=0){
      this.throughHolds=[];this.currentThrough=null;this.throughElapsed=0;this.throughProgress=0;
      this.denchu.openRemaining=0;
      return;
    }
    if(this.denchu.openRemaining>0||this.specialHolds.length>=MAX_HOLDS)return;
    if(!this.currentThrough){
      if(!this.throughHolds.length)return;
      this.currentThrough=this.throughHolds.shift();this.throughElapsed=0;this.throughProgress=0;
    }
    this.throughElapsed+=dt;
    this.throughProgress=clamp(this.throughElapsed/this.through.drawDuration,0,1);
    if(this.throughElapsed<this.through.drawDuration)return;
    const hold=this.currentThrough;this.currentThrough=null;this.stats.throughDraws++;
    if(hold.win){
      this.stats.throughWins++;this.denchu.openRemaining=this.through.openDuration;this.denchu.elapsed=0;
    }
    this._emit('through-result',{hold,win:hold.win,openDuration:hold.win?this.through.openDuration:0});
  }

  _shoot() {
    if (this.stock <= 0 || this.balls.length >= MAX_BALLS) return;
    // The ordinary range keeps the left branches. Above 80%, a continuous
    // launch curve supplies enough energy to cross over the LCD to the right.
    const topRange=Math.max(0,this.power-.8);
    const launchSpeed=this.power<=.4?145+this.power**3*260
      :this.power<=.6?launchBlend((this.power-.4)/.2,161.64,246,124.8,300)
      :this.power<=.8?launchBlend((this.power-.6)/.2,246,278.12,300,0)
      :278.12+51079*topRange*topRange-168910*topRange*topRange*topRange;
    const releaseVX=launchSpeed+(this._random()-.5)*55;
    const releaseVY=releaseVX*this.launch.exitDirection.y/this.launch.exitDirection.x;
    const ball = {
      id: ++this._ballSequence, x: this.launch.start.x, y: this.launch.start.y,
      vx: 0, vy: 0, r: 13, age: 0, trail: [], pegCooldown: 0, inWarp: false, warpProgress: null, warped: false, route: null,
      inLaunch: true, launchProgress: 0, launchPower: this.power,
      releaseVX,releaseVY,...this.relics.captureBall(),
      launchDuration:Math.min(this.launch.duration,this.launch.totalLength/(Math.hypot(releaseVX,releaseVY)*1.15)),
    };
    this.stock--;
    this.stats.shots++;
    this.balls.push(ball);
    this._emit('shot', { x: ball.x, y: ball.y, id: ball.id,colorTier:ball.colorTier,colorMultiplier:ball.colorMultiplier,ballValueMultiplier:ball.ballValueMultiplier });
  }

  _reflect(ball, nx, ny, restitution) {
    const inwardSpeed = ball.vx * nx + ball.vy * ny;
    if (inwardSpeed < 0) {
      ball.vx -= (1 + restitution) * inwardSpeed * nx;
      ball.vy -= (1 + restitution) * inwardSpeed * ny;
    }
  }

  _screenCollision(ball) {
    // A circle near a concave notch can overlap both adjoining edges.
    for(let pass=0;pass<12;pass++) if(!this._screenContact(ball)) break;
  }

  _screenContact(ball) {
    const bounds=this.screen, pad=ball.r+1;
    if(ball.x<bounds.x-pad||ball.x>bounds.x+bounds.width+pad||ball.y<bounds.y-pad||ball.y>bounds.y+bounds.height+pad)return false;
    const polygon = this.screenPolygon;
    let inside = false, nearest = null, minDistance = Infinity;
    for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const a = polygon[j], b = polygon[i];
      if ((a.y > ball.y) !== (b.y > ball.y) && ball.x < (b.x-a.x)*(ball.y-a.y)/(b.y-a.y)+a.x) inside = !inside;
      const dx = b.x-a.x, dy = b.y-a.y, lengthSquared = dx*dx+dy*dy;
      const along = clamp(((ball.x-a.x)*dx+(ball.y-a.y)*dy)/lengthSquared,0,1);
      const x = a.x+dx*along, y = a.y+dy*along, distance = Math.hypot(ball.x-x,ball.y-y);
      if (distance < minDistance) { minDistance = distance; nearest = {x,y,dx,dy,length:Math.sqrt(lengthSquared)}; }
    }
    if (!inside && minDistance >= ball.r) return false;
    const nx = inside || minDistance < .0001 ? nearest.dy/nearest.length : (ball.x-nearest.x)/minDistance;
    const ny = inside || minDistance < .0001 ? -nearest.dx/nearest.length : (ball.y-nearest.y)/minDistance;
    ball.x = nearest.x+nx*(ball.r+.02);
    ball.y = nearest.y+ny*(ball.r+.02);
    this._reflect(ball,nx,ny,.58);
    return true;
  }

  _railCollision(ball, rail, restitution=.34) {
    const sx = rail.x2 - rail.x1, sy = rail.y2 - rail.y1;
    const amount = clamp(((ball.x - rail.x1) * sx + (ball.y - rail.y1) * sy) / (sx * sx + sy * sy), 0, 1);
    const dx = ball.x - (rail.x1 + sx * amount), dy = ball.y - (rail.y1 + sy * amount);
    const radius = ball.r + (rail.radius ?? 4);
    // An axis distance already outside the contact circle cannot collide.
    // Keep the same projection and exact distance calculation near contact.
    if (Math.abs(dx) > radius || Math.abs(dy) > radius) return false;
    const distance = Math.hypot(dx, dy);
    if (distance >= radius || distance < 0.0001) return false;
    const nx = dx / distance, ny = dy / distance;
    ball.x += nx * (radius - distance + 0.01);
    ball.y += ny * (radius - distance + 0.01);
    this._reflect(ball, nx, ny, restitution);
    return true;
  }

  _wheelCollision(ball) {
    const wheel = this.wheel;
    const hubDX = ball.x-wheel.x, hubDY = ball.y-wheel.y, outerRadius = wheel.r + ball.r + 4;
    if (Math.abs(hubDX) > outerRadius || Math.abs(hubDY) > outerRadius) return;
    const hubDistance = Math.hypot(hubDX,hubDY);
    if (hubDistance > outerRadius) return;
    if (hubDistance < ball.r+wheel.hubRadius) {
      const nx = hubDistance > .0001 ? hubDX/hubDistance : 1, ny = hubDistance > .0001 ? hubDY/hubDistance : 0;
      ball.x = wheel.x+nx*(ball.r+wheel.hubRadius+.02);
      ball.y = wheel.y+ny*(ball.r+wheel.hubRadius+.02);
      this._reflect(ball,nx,ny,.55);
    }
    for (let blade = 0; blade < wheel.blades; blade++) {
      const angle = wheel.angle + blade * Math.PI * 2 / wheel.blades;
      const ux = Math.cos(angle), uy = Math.sin(angle);
      const radius = clamp((ball.x - wheel.x) * ux + (ball.y - wheel.y) * uy, 0, wheel.r);
      const px = wheel.x + ux * radius, py = wheel.y + uy * radius;
      const dx = ball.x - px, dy = ball.y - py, distance = Math.hypot(dx, dy);
      const touchRadius = ball.r + this.wheel.bladeRadius;
      if (distance >= touchRadius || distance < 0.0001) continue;
      const nx = dx / distance, ny = dy / distance;
      ball.x += nx * (touchRadius - distance + 0.02);
      ball.y += ny * (touchRadius - distance + 0.02);
      const rx = px - wheel.x, ry = py - wheel.y;
      const surfaceVX = -wheel.omega * ry, surfaceVY = wheel.omega * rx;
      const closing = (ball.vx - surfaceVX) * nx + (ball.vy - surfaceVY) * ny;
      if (closing >= 0) continue;
      const lever = rx * ny - ry * nx;
      const impulse = -1.45 * closing / (1 + lever * lever / 950);
      ball.vx += impulse * nx;
      ball.vy += impulse * ny;
      wheel.omega = clamp(wheel.omega - impulse * lever / 950, -18, 18);
      this._emit('wheel', { x: px, y: py, omega: wheel.omega, id: ball.id });
    }
  }

  _warpTravel(ball, h) {
    ball.warpProgress = Math.min(1, ball.warpProgress + h / this.warp.duration);
    const position = ball.warpProgress * (this.warp.path.length - 1);
    const segment = Math.min(Math.floor(position), this.warp.path.length - 2);
    const blend = position - segment;
    const from = this.warp.path[segment], to = this.warp.path[segment + 1];
    ball.x = from.x + (to.x - from.x) * blend;
    ball.y = from.y + (to.y - from.y) * blend;
    if (ball.warpProgress >= 1) {
      ball.inWarp = false;
      ball.warpProgress = null;
      ball.vx = clamp(85+Math.abs(ball.warpEntryVX??0)*.8,85,390);
      ball.vy = 30;
      ball.inStage=true;
      ball.trail = [];
      this._emit('warp-exit', { x: ball.x, y: ball.y, id: ball.id, route: ball.route });
    }
  }

  _launchTravel(ball,h) {
    const duration=ball.launchDuration??this.launch.duration;
    const remainingTime=(1-ball.launchProgress)*duration;
    const travelTime=Math.min(h,remainingTime);
    ball.launchProgress = remainingTime<=h+1e-10 ? 1 : ball.launchProgress+travelTime/duration;
    const lengths=this.launch.segmentLengths,total=this.launch.totalLength,u=ball.launchProgress;
    const releaseSpeed=Math.hypot(ball.releaseVX,ball.releaseVY);
    const endRatio=releaseSpeed*duration/total;
    // Position and its derivative agree with the outgoing physical velocity.
    // The upward channel gradually slows the ball instead of switching speed
    // from about 1000 px/s to about 200 px/s at a single exit frame.
    let distance=total*(u*(2-u)+endRatio*(u*u-u));
    const speed=total/duration*(2-2*u+endRatio*(2*u-1));
    let segment = 0;
    while (segment < lengths.length-1 && distance > lengths[segment]) distance -= lengths[segment++];
    const blend = clamp(distance/lengths[segment],0,1), from = this.launchPath[segment], to = this.launchPath[segment+1];
    ball.x = from.x+(to.x-from.x)*blend;
    ball.y = from.y+(to.y-from.y)*blend;
    ball.vx=(to.x-from.x)/lengths[segment]*speed;
    ball.vy=(to.y-from.y)/lengths[segment]*speed;
    if (ball.launchProgress >= 1) {
      ball.inLaunch = false;
      ball.x = this.launch.exit.x;
      ball.y = this.launch.exit.y;
      ball.vx = ball.releaseVX;
      ball.vy = ball.releaseVY;
      this._emit('launch-exit',{id:ball.id,x:ball.x,y:ball.y,power:ball.launchPower,vx:ball.vx,vy:ball.vy});
    }
    return Math.max(0,h-travelTime);
  }

  _physics(dt) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 180)));
    const stepH = dt / steps;
    for (let substep = 0; substep < steps; substep++) {
      this.wheel.angle += this.wheel.omega * stepH;
      this.wheel.omega *= Math.exp(-2.8 * stepH);
      if (Math.abs(this.wheel.omega) < 0.005) this.wheel.omega = 0;
      for (let index = this.balls.length - 1; index >= 0; index--) {
        const ball = this.balls[index];
        let h=stepH;
        ball.age += h;
        if (ball.inLaunch) {
          h=this._launchTravel(ball,h);
          if(ball.inLaunch||h<1e-10)continue;
        }
        if (ball.inWarp) { this._warpTravel(ball, h); continue; }
        const previousX = ball.x, previousY = ball.y;
        ball.pegCooldown -= h;
        ball.vy += BOARD.gravity * h;
        ball.vx *= Math.exp(-0.13 * h);
        ball.vx = clamp(ball.vx, -1000, 1000);
        ball.vy = clamp(ball.vy, -1000, 1250);
        ball.x += ball.vx * h;
        ball.y += ball.vy * h;
        for (const wall of this.outerWalls) this._railCollision(ball,wall);
        this._screenCollision(ball);
        for (const splitter of this.splitterSegments) this._railCollision(ball, splitter);
        for (const divider of this.dividerSegments) this._railCollision(ball, divider);
        if(!ball.route&&ball.x>this.screen.x+this.screen.width+ball.r&&ball.y>this.screen.y+60){
          ball.route='R';this.stats.routeRight++;
          this._emit('route',{id:ball.id,route:'R',x:ball.x,y:ball.y});
        }
        if (!ball.route && previousY < this.routeGate.y && ball.y >= this.routeGate.y && ball.vy > 0
          && ball.x > this.routeGate.x1 + ball.r && ball.x < this.routeGate.x2 - ball.r) {
          ball.route = ball.x < this.routeGate.splitX ? 'A' : 'B';
          this.stats[ball.route === 'A' ? 'routeA' : 'routeB']++;
          this._emit('route', { id: ball.id, route: ball.route, x: ball.x, y: ball.y });
        }
        if (!ball.warped && Math.hypot(ball.x - this.warp.entry.x, ball.y - this.warp.entry.y) < this.warp.entry.r - ball.r) {
          if(ball.bypassedWarp){this.stats.warpMissB--;ball.bypassedWarp=false;}
          ball.inWarp = true;
          ball.warped = true;
          ball.warpProgress = 0;
          ball.warpEntryVX=ball.vx;
          ball.trail = [];
          this.stats.warpEntries++;
          if (ball.route === 'A') this.stats.warpA++;
          if (ball.route === 'B') this.stats.warpB++;
          this._emit('warp-enter', { x: ball.x, y: ball.y, id: ball.id, route: ball.route });
          continue;
        }
        if(ball.route==='B'&&!ball.warped&&!ball.bypassedWarp&&previousY<this.routeChannels.endY&&ball.y>=this.routeChannels.endY){
          ball.bypassedWarp=true;
          this.stats.warpMissB++;
          this._emit('warp-miss',{id:ball.id,route:ball.route,x:ball.x,y:ball.y});
        }
        for (const peg of this.pegs) {
          const dx = ball.x - peg.x, dy = ball.y - peg.y;
          const radius = ball.r + peg.r;
          if (Math.abs(dx) > radius || Math.abs(dy) > radius) continue;
          const distance = Math.hypot(dx, dy);
          if (distance >= radius) continue;
          const nx = distance > 0.0001 ? dx / distance : 1;
          const ny = distance > 0.0001 ? dy / distance : 0;
          ball.x = peg.x + nx * (radius + 0.02);
          ball.y = peg.y + ny * (radius + 0.02);
          const speed = Math.hypot(ball.vx, ball.vy);
          this._reflect(ball, nx, ny, 0.67);
          if (ball.pegCooldown <= 0 && speed > 60) {
            this._emit('peg', { x: peg.x, y: peg.y, speed, pegType: peg.type, id:ball.id });
            ball.pegCooldown = 0.075;
          }
        }
        this._wheelCollision(ball);
        for (const rail of this.rails) this._railCollision(ball, rail);
        let stageContact=false;
        for(const floor of this.stage.floorSegments)stageContact=this._railCollision(ball,floor,.08)||stageContact;
        if(stageContact){ball.inStage=true;ball.vx*=Math.exp(-this.stage.friction*h);}
        if(ball.inStage&&(ball.y>1050||ball.x<this.stage.bounds.x||ball.x>this.stage.bounds.x+this.stage.bounds.width)){
          const center=ball.y>1050&&ball.x>this.stage.gap.x1&&ball.x<this.stage.gap.x2;
          this.stats[center?'stageCenter':'stageSpill']++;
          this._emit('stage-exit',{id:ball.id,x:ball.x,y:ball.y,exit:center?'center':'spill'});
          ball.inStage=false;
        }
        const through=this.through.gate;
        if(!ball.throughPassed&&previousY<through.y&&ball.y>=through.y&&ball.vy>0){
          const x=previousX+(ball.x-previousX)*(through.y-previousY)/(ball.y-previousY);
          if(x>through.x1+ball.r&&x<through.x2-ball.r)this._throughPass(ball);
        }
        if(this.denchu.open){
          const mouth=this.denchu.gate;
          const crossing=previousY<mouth.y&&ball.y>=mouth.y&&ball.vy>0;
          const mouthX=crossing?previousX+(ball.x-previousX)*(mouth.y-previousY)/(ball.y-previousY):NaN;
          if(crossing&&mouthX>mouth.x1+ball.r&&mouthX<mouth.x2-ball.r){
            this._denchuEntry(ball);this.balls.splice(index,1);continue;
          }
          for(const wing of this.denchu.wings)this._railCollision(ball,wing);
        }
        if(this.attacker.open){
          const mouth=this.attacker.gate;
          const crossing=previousY<mouth.y&&ball.y>=mouth.y&&ball.vy>0;
          const mouthX=crossing?previousX+(ball.x-previousX)*(mouth.y-previousY)/(ball.y-previousY):NaN;
          if(crossing&&mouthX>mouth.x1+ball.r&&mouthX<mouth.x2-ball.r){
            this._attackerEntry(ball);this.balls.splice(index,1);continue;
          }
          for(const wing of this.attacker.wings)this._railCollision(ball,wing);
        }
        // With the receiver folded shut, balls pass over its recessed front
        // and continue to out. A flat closed rail would become a storage shelf.
        // Only an above-to-below crossing between the two physical heso pins
        // counts. A ball touching the opening from the side cannot enter.
        const gate = this.hesoGate;
        const crossedGate = previousY < gate.y && ball.y >= gate.y && ball.vy > 0;
        const crossingX = crossedGate ? previousX + (ball.x - previousX) * (gate.y - previousY) / (ball.y - previousY) : NaN;
        if (crossedGate && crossingX > gate.x1 + ball.r && crossingX < gate.x2 - ball.r) {
          this._entry(ball);
          this.balls.splice(index, 1);
        } else if (previousY < this.bonusPocket.gateY && ball.y >= this.bonusPocket.gateY && ball.vy > 0
          && Math.abs(ball.x - this.bonusPocket.x) < this.bonusPocket.r - ball.r) {
          this._bonusEntry(ball);
          this.balls.splice(index, 1);
        } else if (previousY<this.outlet.gate.y&&ball.y>=this.outlet.gate.y&&ball.vy>0
          &&ball.x>this.outlet.gate.x1+ball.r&&ball.x<this.outlet.gate.x2-ball.r) {
          this.stats.outBalls++;
          this._emit('out',{id:ball.id,x:ball.x,y:ball.y,age:ball.age,reason:'drain'});
          this.balls.splice(index,1);
        } else if (!Number.isFinite(ball.x + ball.y + ball.vx + ball.vy)) {
          this._emit('out',{id:ball.id,x:ball.x,y:ball.y,age:ball.age,reason:'invalid'});
          this.balls.splice(index, 1);
        } else if(ball.age>22&&!ball.expiryReported){
          // A diagnostic never removes a stuck ball. Only real pockets and
          // the shared collection gate retire ordinary, finite balls.
          ball.expiryReported=true;this.stats.expiredBalls++;
          this._emit('stalled',{id:ball.id,x:ball.x,y:ball.y,age:ball.age});
        }
      }
    }
    for (const ball of this.balls) {
      // Reuse the oldest purely visual sample; collision state and its clock
      // are unchanged, without allocating a new point for every flying ball.
      const point=ball.trail.length>=7?ball.trail.pop():{};
      point.x=ball.x;point.y=ball.y;ball.trail.unshift(point);
    }
  }

  _bonusEntry(ball){
    const award=this._ballAward(this.bonusPocket.award,ball);
    this.stats.bonusEntries++;this.stats.bonusPayout+=award;this.stock+=award;
    const hold=this._resultIntake&&this.holds.length<MAX_HOLDS?this._drawHold({mode:'normal'}):null;
    if(hold)this.holds.push(hold);
    this._emit('bonus-entry',{x:ball.x,y:ball.y,award,id:ball.id,accepted:Boolean(hold),hold});
  }

  _setPhase(phase) {
    const previous = this.phase;
    // Only newly started residual holds use the compact result-panel clock.
    // The prior duration identifies this clock after restoration as well, so
    // an old save mid-spin/reach retains its existing time without a new field.
    const shortResidual=this.currentSpinResidual&&(phase==='spin'||this.phaseDuration===RESIDUAL_PHASE_TIMES[previous]);
    this.phase = phase;
    this.phaseElapsed = 0;
    const prayerFizzle=this.currentSpin?.reachType==='prayer'&&this.currentSpin.prayerDevelops===false;
    const prayerAscension=this.currentSpin?.reachType==='prayer'&&this.currentSpin.prayerDevelops===true&&this.currentSpin.prayerAscension===true;
    const allureDevelopment=this.currentSpin?.reachType==='allure'&&this.currentSpin.allureDevelops===true;
    const tributeDevelopment=this.currentSpin?.reachType==='tribute'&&Boolean(this.currentSpin.tributeBranch);
    const promiseRed=this.currentSpin?.reachType==='promise'&&this.currentSpin.promiseRed===true;
    this.phaseDuration = phase==='reach'?(prayerFizzle?PRAYER_FIZZLE_SECONDS:prayerAscension?PRAYER_ASCENSION_SECONDS:allureDevelopment?ALLURE_DEVELOPMENT_SECONDS:tributeDevelopment?TRIBUTE_DEVELOPMENT_SECONDS:promiseRed?PROMISE_RED_SECONDS:REACH_TIMES[this.currentSpin?.reachType]??PHASE_TIMES.reach)
      :phase==='lose'&&this.currentSpin?.reach&&!prayerFizzle?MISS_RESULT_TIMES.reach:PHASE_TIMES[phase];
    if(shortResidual&&RESIDUAL_PHASE_TIMES[phase]!==undefined)this.phaseDuration=RESIDUAL_PHASE_TIMES[phase];
    this.spinProgress = 0;
    this.winRemaining = phase === 'win' ? PHASE_TIMES.win : 0;
    this.reelStopped=phase==='spin'?[false,false,false]:phase==='reach'?[true,false,true]:[true,true,true];
    this._emit('phase', { phase, previous });
    this._advanceThrough(0);
    this._advanceDenchu(0);
  }

  _startSpin() {
    if(this.mode!=='normal'&&this.rushRemaining===0&&!this.specialHolds.length){
      if(this.relics.guaranteedWins>0){
        // A remaining charge buys one real right-entry opportunity, not an
        // automatic hold or a rewrite of the residual queue.
        this.rushRemaining=1;
        this._emit('guarantee-extension',{remaining:1,guaranteedWins:this.relics.guaranteedWins,mode:this.mode});
      }else{
        this._setMode('normal',0);
        // Let the result presentation pause before a saved normal hold starts.
        return;
      }
    }
    if(this.mode==='normal'&&this.resultDemoPending){
      const hold=this.resultDemoPending;
      this.resultDemoPending=null;
      this._setMode('rush',0);
      this._specialSession.demo=true;
      this.specialHolds.push(hold);
    }
    const demoQueue=[this.holds,this.specialHolds].find(queue=>queue.some(hold=>hold.demo));
    const queue=demoQueue||(this.mode==='normal'?this.holds:this.specialHolds);
    if (!queue.length) return;
    this.currentSpin = demoQueue?queue.splice(queue.findIndex(hold=>hold.demo),1)[0]:queue.shift();
    this._shutterOpened=false;
    this.currentSpinResidual=queue===this.specialHolds&&this.currentSpin.rush&&this.rushRemaining===0;
    if(this.currentSpinResidual&&this._specialSession)this._specialSession.residualSpins++;
    this.finalReelValues=this.currentSpin.reelValues;
    this.stats.spins++;
    this._setPhase('spin');
    this._emit('spin', { hold: this.currentSpin, demo: this.currentSpin.demo, residual:this.currentSpinResidual });
  }

  _settle() {
    const hold = this.currentSpin;
    if (hold.win) {
      this.reelValues = [...hold.reelValues];
      this.stats.wins++;
      this._setPhase('win');
      this.bonusState='intro';this.bonusElapsed=0;this.bonusKind=hold.kind;
      this.bonusSong=null;
      Object.assign(this.attacker,{open:false,openness:0,round:0,totalRounds:hold.rounds,count:0,elapsed:0,payout:0,rewardPayout:0,rewardTarget:hold.rewardTarget,baseRewardTarget:hold.baseRewardTarget??hold.rewardTarget,bonusMultiplier:hold.bonusMultiplier??1,award:BONUS_RULES[hold.kind].award*(hold.bonusMultiplier??1)});
      const physicalMaxAward=hold.rounds*BONUS_RULES[hold.kind].countLimit*this.attacker.award;
      const rules=Object.freeze({...BONUS_RULES[hold.kind],rounds:hold.rounds,award:this.attacker.award,physicalMaxAward,bonusMultiplier:this.attacker.bonusMultiplier,baseRewardTarget:this.attacker.baseRewardTarget,rewardTarget:hold.rewardTarget,maxAward:physicalMaxAward+hold.rewardTarget});
      this._emit('win', { hold, demo: hold.demo, residual:this.currentSpinResidual, award:0,kind:hold.kind,rules,rewardTarget:hold.rewardTarget,maxAward:rules.maxAward });
      this._emit('bonus-start',{kind:hold.kind,rules,rewardTarget:hold.rewardTarget,demo:hold.demo});
    } else {
      this.reelValues = [...hold.reelValues];
      this._setPhase('lose');
      this._emit('lose', { hold, demo: hold.demo, residual:this.currentSpinResidual });
    }
  }

  _advancePhase(dt) {
    if (this.phase === 'idle') { this._startSpin(); return; }
    if(this.phase==='win'){this._advanceBonus(dt);return;}
    this.phaseElapsed += dt;
    this.spinProgress = clamp(this.phaseElapsed / this.phaseDuration, 0, 1);
    this.winRemaining = this.phase === 'win' ? Math.max(0, this.phaseDuration - this.phaseElapsed) : 0;
    const tick = Math.floor(this.phaseElapsed * (this.phase === 'reach' ? 12 : 19));
    if ((this.phase === 'spin' || this.phase === 'reach') && tick !== this._reelTick) {
      this._reelTick = tick;
      const symbol=this.currentSpin.reelValues[0];
      this.reelValues = this.phase === 'reach' ? [symbol, 1 + tick % 9, symbol] : [1 + tick % 9, 1 + (tick * 3) % 9, 1 + (tick * 5) % 9];
    }
    if(this.phase==='spin')this.reelStopped=[this.phaseElapsed>=SPIN_TIMING.left,this.phaseElapsed>=SPIN_TIMING.center&&!this.currentSpin.reach,this.phaseElapsed>=SPIN_TIMING.right];
    if(this.phase==='spin'||this.phase==='reach'){
      const shutter=this.currentSpin.shutter;
      const opened=this.phase==='reach'&&this.phaseElapsed>=SHUTTER_RULES.openAt;
      const visible=shutter?(opened?shutter.after:shutter.before):this.finalReelValues;
      this.reelValues=this.reelValues.map((value,index)=>this.reelStopped[index]?visible[index]:value);
      if(shutter){
        if(this.phase==='reach'){
          this.reelValues=[...visible];
          if(opened)this.reelValues[1]=1+tick%9;
        }
        // No provisional cue, including a moving-center frame, may show a win.
        if(this.reelValues.every(value=>value===this.reelValues[0]))this.reelValues[1]=this.reelValues[0]%9+1;
        if(opened&&!this._shutterOpened){
          this._shutterOpened=true;
          this._emit('shutter-open',{hold:this.currentSpin,change:shutter.change,before:shutter.before,after:shutter.after,residual:this.currentSpinResidual});
        }
      }
      if(!this.reelStopped.every(Boolean)&&this.reelValues.every(value=>value===this.reelValues[0]))
        this.reelValues[1]=this.reelValues[0]%9+1;
    }
    if (this.phaseElapsed + 1e-8 < this.phaseDuration) return;
    if (this.phase === 'spin' && this.currentSpin.reach) {
      this._setPhase('reach');
      const symbol=this.currentSpin.reelValues[0];
      this.reelValues = this.currentSpin.shutter?[...this.currentSpin.shutter.before]:[symbol,symbol%9+1,symbol];
      this._emit('reach', { hold: this.currentSpin, demo: this.currentSpin.demo, residual:this.currentSpinResidual });
    } else if (this.phase === 'spin' || this.phase === 'reach') {
      this._settle();
    } else {
      this.currentSpin = null;
      this.currentSpinResidual = false;
      this._setPhase('idle');
    }
  }

  _setMode(mode,remaining){
    const previous=this.mode;
    const result=mode==='normal'&&previous!=='normal'?{
      mode:previous,remaining:0,residualSpins:this._specialSession?.residualSpins??0,demo:this._specialSession?.demo??false,
    }:null;
    if(previous==='normal'&&mode!=='normal')this._specialSession={residualSpins:0,demo:false};
    if(mode==='normal')this._specialSession=null;
    this.mode=mode;this.rushRemaining=remaining;
    this.denchu.elapsed=0;
    this._advanceThrough(0);
    this._advanceDenchu(0);
    this._emit('mode',{mode,remaining});
    if(result)this._emit('special-result',result);
  }

  _startRound(){
    this.bonusState='open';this.bonusElapsed=0;
    Object.assign(this.attacker,{open:true,openness:1,round:this.attacker.round+1,count:0,elapsed:0});
    const song=this.bonusSong,a=this.attacker;
    if(song?.active){
      // Pocket capacity is independent of the guaranteed grant and prior awards.
      const roundBudget=Math.floor(a.rewardTarget*a.round/a.totalRounds)-Math.floor(a.rewardTarget*(a.round-1)/a.totalRounds);
      a.countLimit=Math.max(0,Math.floor(roundBudget/a.award));
      a.timeLimit=song.duration/a.totalRounds;
      Object.assign(song,{round:a.round,roundStartedAt:song.duration*(a.round-1)/a.totalRounds,
        roundEndsAt:song.duration*a.round/a.totalRounds,countLimit:a.countLimit,waitingForNextRound:a.countLimit===0});
      if(a.countLimit===0){a.open=false;a.openness=0;}
    }
    this._emit('round-start',{kind:this.bonusKind,round:a.round,totalRounds:a.totalRounds,timeLimit:a.timeLimit,
      countLimit:a.countLimit,songScheduled:!!song?.active,scheduledEndAt:song?.active?song.roundEndsAt:null});
  }

  _attackerEntry(ball){
    if(!this.attacker.open||this.bonusState!=='open')return;
    const award=this._ballAward(this.attacker.award,ball);
    this.attacker.count++;this.attacker.payout+=award;
    this.stats.attackerEntries++;this.stats.payout+=award;this.stock+=award;
    this._emit('attacker-entry',{id:ball.id,x:ball.x,y:ball.y,award,count:this.attacker.count,round:this.attacker.round,kind:this.bonusKind,payout:this.attacker.payout});
    if(this.attacker.count>=this.attacker.countLimit){
      if(this.bonusSong?.active){
        this.attacker.open=false;this.attacker.openness=0;this.bonusSong.waitingForNextRound=true;
        this._emit('round-capacity',{kind:this.bonusKind,round:this.attacker.round,count:this.attacker.count,
          scheduledEndAt:this.bonusSong.roundEndsAt});
      }else this._endRound('count');
    }
  }

  _endRound(reason){
    const song=this.bonusSong;
    if(this.bonusState!=='open'||(!this.attacker.open&&!song?.active))return;
    if(song?.active&&(reason!=='song-time'||song.time+1e-8<song.roundEndsAt))return;
    this.attacker.open=false;this.attacker.openness=0;
    this.bonusState='between';this.bonusElapsed=0;
    // Grant the guarantee in full, separately from every actual pocket award.
    // Only prior guaranteed grants are deducted, so repeated closes cannot pay twice.
    const a=this.attacker;
    const guaranteed=Math.floor(a.rewardTarget*a.round/a.totalRounds);
    const amount=Math.max(0,guaranteed-a.rewardPayout);
    if(amount>0){
      a.rewardPayout+=amount;this.stats.rewardPayout+=amount;this.stock+=amount;
      this._emit('reward-award',{kind:this.bonusKind,amount,total:a.payout+a.rewardPayout,target:a.rewardTarget,
        round:a.round,totalRounds:a.totalRounds,physicalPayout:a.payout,rewardPayout:a.rewardPayout,baseRewardTarget:a.baseRewardTarget,bonusMultiplier:a.bonusMultiplier});
    }
    this._emit('round-end',{kind:this.bonusKind,round:a.round,count:a.count,reason,payout:a.payout+a.rewardPayout,
      physicalPayout:a.payout,rewardPayout:a.rewardPayout,rewardTarget:a.rewardTarget,baseRewardTarget:a.baseRewardTarget,bonusMultiplier:a.bonusMultiplier,
      songScheduled:!!song?.active,scheduledEndAt:song?.active?song.roundEndsAt:null});
  }

  _advanceBonus(dt){
    if(this.bonusSong?.active){this._advanceSongBonus(dt);return;}
    this.phaseElapsed+=dt;this.bonusElapsed+=dt;
    const duration=this.bonusState==='intro'?2:this.bonusState==='open'?this.attacker.timeLimit:.6;
    this.spinProgress=clamp(this.bonusElapsed/duration,0,1);
    this.winRemaining=Math.max(0,duration-this.bonusElapsed);
    if(this.bonusState==='open')this.attacker.elapsed=this.bonusElapsed;
    if(this.bonusElapsed+1e-8<duration)return;
    if(this.bonusState==='intro')this._startRound();
    else if(this.bonusState==='open')this._endRound('timeout');
    else if(this.attacker.round<this.attacker.totalRounds)this._startRound();
    else this._finishBonus();
  }

  _advanceSongBonus(dt){
    const song=this.bonusSong,a=this.attacker;
    this.phaseElapsed+=dt;
    if(song.source==='audio'){
      song._stalledFor+=dt;
      // A blocked/rejected playback cannot leave a physical bonus open forever.
      if(song._stalledFor>=2)song.source='virtual';
    }
    song.time=clamp(Math.max(song.time,song._pendingTime)+(song.source==='virtual'?dt:0),0,song.duration);
    if(this.bonusState==='intro')this._startRound();
    // A seek or delayed media sample may cross many boundaries. Award and emit
    // every completed round in order, exactly once, before ending the bonus.
    while(this.bonusState==='open'&&song.time+1e-8>=song.roundEndsAt){
      this._endRound('song-time');
      if(a.round<a.totalRounds)this._startRound();
      else{this._updateSongProgress();this._finishBonus();return;}
    }
    this.bonusElapsed=Math.max(0,song.time-song.roundStartedAt);
    a.elapsed=this.bonusElapsed;
    this._updateSongProgress();
    this.spinProgress=clamp(this.bonusElapsed/a.timeLimit,0,1);
    this.winRemaining=song.remainingToRound;
  }

  _updateSongProgress(){
    const song=this.bonusSong;
    song.remaining=Math.max(0,song.duration-song.time);
    song.remainingToRound=Math.max(0,song.roundEndsAt-song.time);
    song.progress=clamp(song.time/song.duration,0,1);
  }

  _finishBonus(){
    const kind=this.bonusKind;
    const rush=this.currentSpin.mode==='rush'||kind!=='blessing';
    const remaining=kind==='blessing'&&rush?6:BONUS_RULES[kind].specialSpins;
    const song=this.bonusSong;
    if(song?.active){
      song.active=false;song.waitingForNextRound=false;
      this.attacker.countLimit=song.normalCountLimit;this.attacker.timeLimit=song.normalTimeLimit;
    }
    this.bonusState=null;this.bonusKind=null;this.currentSpin=null;this.currentSpinResidual=false;
    this._setMode(rush?'rush':'challenge',remaining);
    this._emit('bonus-end',{kind,payout:this.attacker.payout+this.attacker.rewardPayout,
      physicalPayout:this.attacker.payout,rewardPayout:this.attacker.rewardPayout,rewardTarget:this.attacker.rewardTarget,baseRewardTarget:this.attacker.baseRewardTarget,bonusMultiplier:this.attacker.bonusMultiplier,mode:this.mode,remaining,
      songScheduled:!!song,songTime:song?.time??null,songDuration:song?.duration??null});
    this.relics.nextEpoch();this._emit('relic-shop',this.getRelicShop());
    this._setPhase('idle');
  }

  step(dtSeconds, { pauseSpin = false, resultIntake = false } = {}) {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    // Long tab suspensions never fire a backlog of balls or skip an entire reveal.
    this._resultIntake=Boolean(resultIntake);
    const dt = Math.min(dtSeconds, 0.05);
    if (this.firing && this.stock > 0) {
      this._shotClock -= dt;
      if (this._shotClock <= 0) { this._shoot(); this._shotClock += SHOT_INTERVAL; }
    } else this._shotClock = 0;
    this._advanceThrough(dt);
    this._advanceDenchu(dt);
    this._physics(dt);
    if(!pauseSpin)this._advancePhase(dt);
  }
}
