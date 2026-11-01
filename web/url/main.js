import {attachRuntimeDiagnostics,BUILD_ID} from './runtime-diagnostics.js';
import {createGameAudioContext} from './game-audio-context.js';
import {selectAsset} from './asset-variants-v47.js';
import {addSaveEnvironmentGuide} from './save-environment.js';
import {createSurfaceHealth} from './surface-health.js';
import {resumeAudioIfNeeded} from './audio-resume.js';
import {createScopedLightingHost} from './lighting-scope.js';
import {setupSessionTransfer} from './session-transfer.js';
import {setupRenderQualitySettings,getRenderQualityProfile} from './render-quality.js';
import {watchCanvasRecovery} from './canvas-recovery.js';
import {createCanvasTextCache} from './canvas-text.js';
import {reelsAreVisible} from './render-visibility.js';
import {createRewardedAd} from './rewarded-ad.js';
import {renderMusicCredits} from './music-credits.js';
import {createAudioSettings,audioScale} from './audio-settings.js';
import {protectGameMedia} from './player-interactions.js';
import {PLAYER_DISTRIBUTION} from './runtime-config.js';
import {selectMachineSetting} from './player-settings.js';
import { PachinkoEngine, BOARD, BONUS_RULES, SETTINGS_ODDS } from './engine.js';
import { LightingRig, renderCabinet, positionLCD } from './parts.js';
import { loadCabinetSkin } from './cabinet-skin.js';
import { createReels } from './reel-symbols.js';
import { SoundEffects, SOUND_COUNT, SFX_CACHE_BYTES } from './sound-effects.js';
import { createRenderProfile } from './render-profile.js';
import { PrayerReach, prayerForecastState } from './prayer-reach.js';
import {ascensionFlash,ascensionState} from './prayer-ascension.js';
import { LayeredReach, SCENES } from './layered-reach.js';
import { ImpactTitles } from './impact-titles.js';
import { MusicBed } from './music-bed.js';
import { sceneLighting, pvLighting, lowLoadCabinetLighting } from './scene-lighting.js';
import { JackpotPV,pvPlaybackClock,premiumPVProgress } from './jackpot-pv.js';
import { BonusPresentation,queenBonusLight } from './bonus-presentation.js';
import { AwakeningCutin, DiagonalCutin, awakeningVariant } from './awakening-cutin.js';
import { ResultPresentation } from './result-presentation.js';
import { musicState } from './music-state.js';
import { DrawPresentation } from './draw-presentation.js';
import { connectSession } from './session-ui.js';
import {JudgmentConfirmation} from './judgment-confirmation.js';
import {bindHandle} from './handle-control.js';
import {advancePlayback} from './playback-clock.js';
import {getReachTiming,activePushWindow,PRAYER_FIZZLE_SECONDS,PRAYER_ASCENSION_SECONDS,PROMISE_RED_SECONDS} from './reach-timing.js';
import {reachArtTime} from './reach-development.js';
import {ReelTransition} from './reel-transition.js';
import {NumberFocusCutin} from './number-focus-cutin.js';
import {screenFlash,judgmentPushFlash} from './scene-flash.js';
import {HotStageEffects} from './hot-stage-effects.js';
import {MissPresentation} from './miss-presentation.js';
import {ReelHeartbeat} from './reel-heartbeat.js';
import {WinConfirmation,winMonitorState} from './win-presentation.js';
import {connectOperatorStock} from './operator-stock.js';

protectGameMedia();
const $ = id => document.getElementById(id);
const canvas = $('board'), ctx = canvas.getContext('2d');
const boardText=createCanvasTextCache();
const boardHealth=createSurfaceHealth();
const mobileRendering=document.documentElement.dataset.renderQuality==='mobile';
const managedImages=Object.fromEntries([
 ['standard','#standard-reach-title'],['judgment','#judgment-confirmation img'],
 ['st','#st-counter img'],['guarantee','#bonus-guarantee .guarantee-confirmed'],
 ['threeThousand','#bonus-guarantee [data-bonus-3000]'],['aim','#right-aim img']
].map(([key,selector])=>[key,document.querySelector(selector)]));
function keepSceneImage(key,needed){
  const image=managedImages[key];
  if(needed){if(!image.getAttribute('src')){image.loading='eager';image.src=selectAsset(image.dataset.managedSrc);}}
  else if(image.getAttribute('src'))image.removeAttribute('src');
}
function syncSceneImages(){
  const hold=engine.currentSpin,preparing=['spin','reach'].includes(engine.phase)&&!resultScene.active;
  keepSceneImage('standard',Boolean(hold?.reach&&hold.reachType==='standard'&&(preparing||!$('standard-reach-title').hidden)));
  keepSceneImage('judgment',Boolean(hold?.win&&hold.reachType==='judgment'&&(preparing||judgmentConfirm.portal)));
  keepSceneImage('st',!$('st-counter').hidden&&!managedImages.st.hidden);
  keepSceneImage('guarantee',!$('bonus-guarantee').hidden);
  keepSceneImage('threeThousand',!$('bonus-guarantee').hidden&&!managedImages.threeThousand.hidden);
  keepSceneImage('aim',!$('right-aim').hidden);
}

const setText=(node,value)=>{value=String(value);if(node.textContent!==value)node.textContent=value;};
const setData=(node,key,value)=>{value=String(value);if(node.dataset[key]!==value)node.dataset[key]=value;};
const setHidden=(node,value)=>{value=Boolean(value);if(node.hidden!==value)node.hidden=value;};
const setDisabled=(node,value)=>{value=Boolean(value);if(node.disabled!==value)node.disabled=value;};
const setAttribute=(node,name,value)=>{value=String(value);if(node.getAttribute(name)!==value)node.setAttribute(name,value);};
const styleValues=new WeakMap();
function setStyle(node,key,value){
  value=String(value);let cache=styleValues.get(node);if(!cache){cache=new Map();styleValues.set(node,cache);}
  if(cache.get(key)!==value){node.style.setProperty(key,value);cache.set(key,value);}
}
const {boardScale,lowLoad}=getRenderQualityProfile();
canvas.width=Math.round(BOARD.width*boardScale);canvas.height=Math.round(BOARD.height*boardScale);ctx.setTransform(boardScale,0,0,boardScale,0,0);
const pinLayer=document.createElement('canvas');pinLayer.width=canvas.width;pinLayer.height=canvas.height;
const pinContext=pinLayer.getContext('2d'),ballSprites=new Map(),gateGradients=new Map(),queenGradients=new Map();
pinContext.setTransform(boardScale,0,0,boardScale,0,0);
let cachedPegs=null,cachedBoardSkin=null,cachedAttackerOpen=null,cachedDenchuOpen=null,cachedMode=null,cachedGateBake=null,lastThroughLight=null,lightStamp=0,lightClock=0,pushedAt=null,cabinetPushAt=-Infinity;
function rebuildBoardArtwork({resetSurface=false}={}){
  queenGradients.clear();
  // Reset only after an invalid drawing surface, never for ordinary firing.
  // This releases its old clip/state and preserves the selected pixel budget.
  if(resetSurface){canvas.width=Math.round(BOARD.width*boardScale);canvas.height=Math.round(BOARD.height*boardScale);pinLayer.width=canvas.width;pinLayer.height=canvas.height;}
  ctx.setTransform(boardScale,0,0,boardScale,0,0);
  pinContext.setTransform(boardScale,0,0,boardScale,0,0);
  cachedPegs=null;cachedBoardSkin=null;boardText.clear();
  for(const {sprite} of ballSprites.values())sprite.width=sprite.height=1;
  ballSprites.clear();gateGradients.clear();
}
const boardRecovery=watchCanvasRecovery({targets:[{canvas,context:ctx},{canvas:pinLayer,context:pinContext}],rebuild:rebuildBoardArtwork});
const profileRender=createRenderProfile(!PLAYER_DISTRIBUTION&&new URLSearchParams(location.search).get('profile')==='1');
const screen = $('screen'), machine = $('machine');
const updateReels = createReels(document.querySelector('.reels'));
const flashOverlay=document.createElement('i');flashOverlay.className='scene-flash';flashOverlay.setAttribute('aria-hidden','true');screen.append(flashOverlay);
let lastFlashKey=null,flashWasActive=false;
const shell=document.querySelector('.game-shell');
const holdDots = [...document.querySelectorAll('#holds i')];
const settings = $('settings'), help = $('help'), bonusMenu = $('bonus-menu'),supportDialog=$('support-dialog'),volumeDialog=$('audio-settings-dialog');
const BONUS_COLORS = { blessing:'#91f5c4', queen:'#d58bff', awakening:'#ffda70' };
let cueKind = null;
let engine, lighting, firing = false, lastTime = 0, soundOn = false, audio = null, audioMix=null, lastPegAudio = 0;
let effects=null, numberVoiceSource=null, numberVoiceGain=null, pushSoundShown=false;
const pushedWindows=new Set();let lastPushWindow=null;
let throughFlash=0,developmentSoundKey=null;
const activeTones=new Set();
let clearBalls = true, showNames = false, hitEffects = [], seenPhase = '', pushed = false;
let boardWasCovered=false,boardDrawRetryAt=0,boardDrawFailures=0;
let uiStamp = 0, lastMessage = '', baseCue = '';
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const prayer = new PrayerReach($('prayer-scene'), { reducedMotion: prefersReduced,onPrelude:()=>effect('prayer-sparkle',{lane:'prayer',gain:.5}),onPreludeStop:()=>effects?.stop('prayer'),onIntro:()=>effect('text-arrival',{lane:'impact',gain:.5,duration:.7}),onFizzle:()=>{effects?.stop('prayer');effect('miss-bite',{lane:'scene',gain:.38});},onAscensionBeat:beat=>{effect(beat.sound,{lane:'prayer',gain:beat.id==='faith'?.7:beat.id==='seal'?.55:.42,duration:beat.id==='charge'?2:undefined});} });
const music = new MusicBed($('music-bed'),$('music-credit'));
const jackpotPV = new JackpotPV($('jackpot-pv'));
const bonusPresentation = new BonusPresentation($('bonus-presentation'));
const judgmentConfirm=new JudgmentConfirmation($('judgment-confirmation'),{reducedMotion:prefersReduced,onBeat:beat=>{if(beat.id==='break'&&beat.lateness<.2){effect('crack',{lane:'impact',gain:.85});jolt();}}});
const hotStage=new HotStageEffects(document.body,{reducedMotion:prefersReduced});
const numberFocus=new NumberFocusCutin(screen,{reducedMotion:prefersReduced});
const heartbeat=new ReelHeartbeat({reducedMotion:prefersReduced,onCycle:e=>Boolean(effect('heartbeat',{lane:'heartbeat',gain:.46,offset:e.offset,duration:e.duration})),onStop:()=>effects?.stop('heartbeat')});
const missPresentation=new MissPresentation(screen,{reducedMotion:prefersReduced,onBreak:()=>{effect('miss-shatter',{lane:'result',gain:.65});jolt();}});
const reelTransition=new ReelTransition(document.querySelector('.reels'),{reducedMotion:prefersReduced,onEnlarge:()=>{if(engine?.phase==='reach'&&engine.currentSpin?.reachType!=='prayer'&&!scenePreview&&!modeSplash){effect('text-arrival',{lane:'impact',gain:.32,duration:.7});}}});
// The saved player mix sets the music level below.
$('normal-track').addEventListener('change',event=>{music.normalChoice=event.target.value;});
$('rush-track').addEventListener('change',event=>{music.rushChoice=event.target.value;});
$('music-volume').addEventListener('input',event=>{audioSettings.set('music',Number(event.target.value)/100);});
let scenePreview = null, previewSequence = 0, modeSplash = null, pvOutro=null;
const winConfirmation=new WinConfirmation();
let deferredWin=null, chainWins=0, chainPayout=0, chainEnded=true;
let rewardShown=0,rewardBump=0;
let bonusAudioWait=0,forcedKissHold=null;
let session=null,songResume=null,rewardedAd=null;
const motionGaps=[],motionEvents=[];
let motionStamp=0,lastPauseReason='';
setData(machine,'build',BUILD_ID);
let flightRecorder=null;
function traceMotion(type,detail={}){
  flightRecorder?.record(type);
  motionEvents.push({type,...detail,at:Math.round(performance.now()),phase:engine?.phase,round:engine?.attacker?.round,firing:engine?.firing,shots:engine?.stats.shots});
  if(motionEvents.length>40)motionEvents.shift();
}
const pauseReason=()=>document.documentElement.dataset.startup&&document.documentElement.dataset.startup!=='ready'?'startup':document.hidden?'hidden':rewardedAd?.open?'rewarded-ad':volumeDialog?.open?'volume':settings.open?'settings':help.open?'help':supportDialog.open?'support':bonusMenu.open?'menu':session?.paused?'session':'';
const isPaused=()=>Boolean(pauseReason());
const drawPresentation=new DrawPresentation($('draw-shutter'),document.querySelector('.reels'),{reducedMotion:prefersReduced,onBeat:(beat,detail)=>effect(beat==='pressure'?'energy':beat==='close'?'crack':beat==='open'?(detail?.final?'thunder':'reflect'):'frame-prepare',{lane:'impact',gain:beat==='pressure'?.42:detail?.final?.62:beat==='close'?.48:.32,duration:beat==='pressure'?.6:undefined})});
const awakeningCutin=new AwakeningCutin($('awakening-cutin'),{reducedMotion:prefersReduced,onBeat:beat=>{if(beat.id==='kiss')effect('reflect',{lane:'impact',gain:.55});if(beat.id.startsWith('fever-')){effect(beat.final?'thunder':'reflect',{lane:'accent',gain:beat.final?.62:.2});jolt();}}});
const diagonalCutin=new DiagonalCutin($('diagonal-cutin'),{reducedMotion:prefersReduced,onBeat:at=>effect(at===.32?'sword-arrival':at===.72?'confirmed-success':'reflect',{lane:'impact',gain:.45})});
const resultScene=new ResultPresentation($('result-scene'),{reducedMotion:prefersReduced,onBeat:beat=>{
  if(beat.id==='star')effect('reflect',{lane:'scene',gain:.5});
  if(beat.id==='yua')effect('aura',{lane:'impact',gain:.55});
  if(beat.id==='continue-hit'||beat.id==='continue-seal'){effect(beat.id==='continue-hit'?'sword-heavy':'thunder',{lane:'impact',gain:.65});jolt();}
}});
function showResult(mode,residual=false){resultScene.showResult({wins:chainWins,payout:chainPayout,mode,residual});} 
function beginRushMode(){
  music.stop();jackpotPV.stop();screen.classList.remove('pv-active');pvOutro=null;$('pv-continue').hidden=true;
  effects?.stop('scene');
  message('狂信者モードへ。女王の降臨を見届けましょう。');
  modeSplash={elapsed:0};showLayered('mode',`rush-${++previewSequence}`);
}
const layered = new LayeredReach($('layered-scene'), { reducedMotion: prefersReduced,onGlassMotion:()=>{effects?.stop('allure');effect('poison-magic',{lane:'allure',gain:.4,playbackRate:1.15});}, onBeat: beat => {
  if ((beat.lateness ?? 0) > .2) return;
  if(String(beat.index).startsWith('mode-film-')){effect(beat.sound,{lane:'scene',gain:beat.index==='mode-film-impact'?.68:.5,duration:beat.index==='mode-film-entry'?2.8:1.8});return;}
  if(String(beat.index).startsWith('promise-sword-')){effect(beat.sound,{lane:'scene',gain:.43});return;}
  if(beat.text==='発展'){effect(beat.at>=20?'versus-upgrade':'inspiration',{lane:'impact',gain:.58});return;}
  if(String(beat.index).startsWith('promise-red-')){
    const sound=beat.sound??(beat.at===15?'foreboding':beat.at===27.8?'sword-arrival':beat.text==='beam'?'sword-heavy':beat.text==='resolve'?'slow-motion':'text-arrival');
    effect(sound,{lane:'impact',gain:beat.text==='beam' ? .72 : beat.at===27.8 ? .64 : .48});return;
  }
  if (beat.kind==='judgment'&&beat.text==='蛇眼') return;
  if(beat.kind==='judgment'&&beat.text==='追撃'&&engine.currentSpin?.win){effect('confirmed-success',{lane:'impact',gain:.65});return;}
  const sound=beat.kind==='promise'?'reflect':beat.text==='審判'?'sword-heavy':beat.text==='追撃'?'thunder':beat.text==='溜め'?'frame-prepare':beat.text==='決着前'?'slow-motion':'energy';
  effect(sound,{lane:'impact',gain:beat.kind==='promise'?.16:beat.text==='溜め'?.4:.6});
} });
const winTitles = new ImpactTitles($('win-reward').querySelector('[data-reward-title]'), { reducedMotion: prefersReduced, onBeat: beat => {
  if (beat.lateness < .2) effect(beat.text==='確変'?'thunder':'energy',{lane:'impact',gain:.7});
} });
function showLayered(kind,key) {
  effects?.prepareScene(kind,engine?.currentSpin||{});
  const hold=engine?.currentSpin;
  const intense=kind==='tribute'&&hold?.id===key&&(hold.win?hold.id%4!==0:hold.id%16===0);
  const duration=hold?.id!==key?undefined:engine?.phase==='reach'?engine.phaseDuration:engine?.phase==='lose'&&kind==='promise'&&hold.promiseRed?PROMISE_RED_SECONDS:undefined;
  const allureDevelops=kind==='allure'&&hold?.id===key&&hold.allureDevelops===true;
  const allureVoiceHot=kind==='allure'&&hold?.id===key&&hold.allureHotVoice===true;
  const tributeBranch=kind==='tribute'&&hold?.id===key?hold.tributeBranch??null:null;
  const promiseRed=kind==='promise'&&hold?.id===key&&hold.promiseRed===true;
  if (!layered.start(kind,key,{intense,duration,allureDevelops,allureVoiceHot,tributeBranch,promiseRed,win:hold?.win===true})) return false;
  screen.classList.add('layered-active'); setData(screen,'scene',kind);
  setData(screen,'reels',kind==='mode'?'hidden':'small');
  return true;
}
function stopLayered(options={}) {
  effects?.stop('allure');
  layered.stop(options);screen.classList.remove('layered-active');delete screen.dataset.scene;delete screen.dataset.reels;
}
function clearMiss(){missPresentation.reset();developmentSoundKey=null;heartbeat.reset();}
function beginMiss(hold,{restored=false}={}){
  if(!hold?.reach||engine.currentSpinResidual||hold.prayerDevelops===false)return false;
  effects?.stop('allure');
  if(restored){
    onEvent({type:'reach',hold});
    const end=getReachTiming(hold.reachType,hold.promiseRed?PROMISE_RED_SECONDS:hold.prayerAscension?PRAYER_ASCENSION_SECONDS:undefined).duration-.04;
    if(layered.key!==null)layered.update(end,{soundOn:false});
    if(prayer.key!==null)prayer.update(end,{soundOn:false});
    setData(screen,'reels',layered.key!==null?layered.root.dataset.reels:'normal');
    setData(screen,'reelFocus','center');
  }
  const fancy=layered.key!==null||prayer.key!==null;
  missPresentation.start({key:hold.id,duration:engine.phaseDuration,initialElapsed:engine.phaseElapsed,shatter:hold.prayerAscension===true||!['standard','prayer'].includes(hold.reachType),
    immediateShatter:false,impactText:'',restored,
    scene:layered.key!==null?layered.kind:hold.reachType,
    reels:screen.dataset.reels||'normal',focus:screen.dataset.reelFocus||'normal',
    clock:layered.key!==null?layered.lastElapsed:getReachTiming(hold.reachType,hold.prayerAscension?PRAYER_ASCENSION_SECONDS:undefined).duration,
    lightCue:lighting.cue?{...lighting.cue,colors:lighting.cue.colors?{...lighting.cue.colors}:undefined}:null});
  baseCue='';prayer.pause();layered.pause();numberFocus.stop();effects?.stop('heartbeat');
  if(fancy&&!restored)effect('miss-bite',{lane:'result',gain:.72});
  return true;
}
function stopWinReward(){winTitles.stop();$('win-reward').hidden=true;const art=$('win-reward').querySelector('.promotion-art');art.removeAttribute('src');delete art.dataset.stage;machine.style.removeProperty('transform');}
let joltAnimation=null;
function jolt(){
  if(prefersReduced)return;
  joltAnimation?.cancel();
  joltAnimation=machine.animate([{translate:'0 0'},{translate:'2px 0'},{translate:'-2px 0'},{translate:'1px 0'},{translate:'0 0'}],{duration:260});
}

function tone(freq, length = .06, gain = .035, delay = 0, type = 'sine') {
  if (!soundOn || !audio || audio.state !== 'running') return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator(), amp = audio.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(.0001, start); amp.gain.exponentialRampToValueAtTime(gain, start + .007);
  amp.gain.exponentialRampToValueAtTime(.0001, start + length);
  osc.connect(amp); amp.connect(audioMix.effects);
  activeTones.add(osc);osc.onended=()=>{activeTones.delete(osc);osc.disconnect();amp.disconnect();};
  osc.start(start); osc.stop(start + length + .02);
}
function unlockAudio() {
  if (!soundOn) return;
  audio ||= createGameAudioContext({lowLoad});
  if(!audioMix){
    audioMix={effects:audio.createGain(),voice:audio.createGain()};
    for(const gain of Object.values(audioMix))gain.connect(audio.destination);
    prayer.voiceDestination=audioMix.voice;layered.voiceDestination=audioMix.voice;
    music.connectAudio(audio);
    numberVoiceSource=audio.createMediaElementSource(numberFocus.voice);
    numberVoiceGain=audio.createGain();numberVoiceGain.gain.value=.75;
    numberVoiceSource.connect(numberVoiceGain);numberVoiceGain.connect(audioMix.voice);
    numberFocus.voice.volume=1;
    applyAudioLevels(audioSettings.levels);
  }
  if(!effects){
    // Repeated low-load reaches reuse their bounded 24 kHz PCM cache. Evicting
    // it at every return to normal made native decoders allocate it again.
    effects=new SoundEffects(audio,{destination:audioMix.effects,idleDecodedBytes:lowLoad?SFX_CACHE_BYTES:8*1024*1024});
    effects.load({selective:mobileRendering}).then(count=>{$('sound').dataset.loadedSounds=String(count);$('sound').title=`効果音 ${count} / ${SOUND_COUNT} 読み込み済み`;});
  }
  effects.setEnabled(soundOn);
  effects.prepareScene(scenePreview?.kind||(modeSplash?'mode':(engine.phase==='win'?'bonus':engine.currentSpin?.reach?engine.currentSpin.reachType:'normal')),engine.currentSpin||{});
  prayer.loadVoice(audio);
  layered.loadVoice(audio);
  layered.loadJudgmentVoice(audio);
  layered.loadAllureVoices(audio);
  resumeAudioIfNeeded(audio);
}
function effect(id,options={}) {
  const played=effects?.play(id,options);
  if(played){$('sound').dataset.lastEffect=id;if(options.lane==='scene')$('sound').dataset.lastScene=id;}
  return played;
}
function silence(){heartbeat.stopAudio('silence');prayer.pause();layered.pause();numberFocus.pause();music.pause();effects?.stop();for(const osc of activeTones)osc.stop();activeTones.clear();}
function message(text) { if (lastMessage !== text) { $('message').textContent = text; lastMessage = text; } }
function flash(x, y, color = '#c4f8d7', life = .4) {
  hitEffects.push({ x, y, color, age: 0, life });
  if (hitEffects.length > 45) hitEffects.shift();
}
function onEvent(event) {
  if(['spin','reach','win','lose','round-start','round-end','bonus-end','mode','special-result'].includes(event.type))traceMotion(event.type);
  if (event.type === 'peg') {
    flash(event.x, event.y, '#f6dc9b', .2);
    const now = performance.now();
    if (now - lastPegAudio > 80) { tone(1200 + event.y * .9, .033, .013); lastPegAudio = now; }
  } else if (event.type === 'shot') {
    tone(210, .025, .012, 0, 'triangle');
  } else if (event.type === 'entry') {
    flash(engine.start.x, engine.start.y, lighting.color('frame'), .6);
    tone(880, .1, .035); tone(1320, .14, .03, .07);
    if(event.accepted&&['red','gold'].includes(engine.holds.at(-1)?.color))effect('hot-hold',{gain:.4,cooldown:3});
    message(event.accepted ? '入賞！ 保留がたまりました。' : event.award > 0 ? `へそ賞球 +${event.award}玉。${engine.phase==='win'?'右の大入賞口':'抽選は右のRUSH入口'}へ。` : engine.mode !== 'normal' && engine.rushRemaining === 0 ? '残りの保留を消化中です。' : '入賞。保留は4つまでです。');
  } else if(event.type==='denchu-entry') {
    flash(event.x,event.y,'#d8b4ff',.6);
    tone(988,.09,.028);tone(1480,.12,.022,.07);
    message(event.accepted?(event.hold?.rush?'RUSH入口に入賞！ 次の当たりを抽選します。':'入賞！ 通常保留に追加しました。'):`電チュー賞球 +${event.award??1}玉。保留を消化中です。`);
  } else if(event.type==='through') {
    throughFlash=.45;flash(event.x??engine.through?.x,event.y??engine.through?.y,lighting.color('accent'),.35);
    if(engine.mode!=='normal'&&engine.phase!=='win')tone(740,.05,.018);
  } else if(event.type==='through-result'&&event.win) {
    throughFlash=.8;
    tone(880,.08,.016);tone(1174,.09,.013,.08);
  } else if (event.type === 'bonus-entry') {
    flash(event.x, event.y, '#ffd391', .5);
    effect('reward',{gain:.32,lane:'pocket',cooldown:.9}); message(`おまけ入賞 +${event.award ?? 3}玉${event.accepted?' ／ 通常保留に追加':''}`);
  } else if (event.type === 'warp-enter') {
    flash(event.x ?? engine.warp?.entry.x, event.y ?? engine.warp?.entry.y, lighting.color('warp'), .6);
    effect('reflect',{gain:.45,cooldown:.5}); message('ワープ通過 → ステージへ');
  } else if (event.type === 'warp-exit') {
    const exit = engine.warp?.exit;
    if (exit) flash(exit.x, exit.y, lighting.color('warp'), .5);
  } else if (event.type === 'spin') {
    effects?.prepareScene(event.hold.reach?event.hold.reachType:'normal',event.hold);
    clearMiss();
    prayer.stop();screen.classList.remove('prayer-active');
    if(event.residual)showResult(event.hold.mode,true);else resultScene.reset();
    stopWinReward();
    if(!modeSplash)stopLayered();
    if(['promise','judgment','allure'].includes(event.hold.reachType))layered.prepare(event.hold.reachType);
    baseCue = '';
    cueKind = null;
    effects?.stop('scene');effects?.stop('prompt');pushSoundShown=false;
    pushed = false; pushedAt=null;pushedWindows.clear();lastPushWindow=null; screen.classList.remove('pushed');
    message(event.demo ? '確認用の演出を再生中。' : '図柄変動中。');
    tone(440, .09, .025);
  } else if (event.type === 'reach') {
    clearMiss();
    modeSplash=null;stopLayered({preservePrepared:event.hold.reachType});
    if(event.residual){baseCue='';return;}
    if(event.hold.reachType==='shutter'){
      baseCue='';effect('slow-motion',{lane:'scene',gain:.3});message('扉の向こうで、図柄が揺れる。');return;
    }
    if(event.hold.reachType==='prayer'){
      baseCue='';numberFocus.stop();screen.classList.add('prayer-active');prayer.start(event.hold.id,engine.phaseElapsed,{introDuration:event.hold.prayerDevelops===false?engine.phaseDuration:reachPlan().introDuration,develops:event.hold.prayerDevelops!==false,strong:event.hold.prayerAscension===true,strongDuration:reachPlan().duration});
      message('ゆあ様へ祈りを。');return;
    }
    if(['promise','judgment','tribute','allure'].includes(event.hold.reachType)){
      baseCue=SCENES[event.hold.reachType].label;showLayered(event.hold.reachType,event.hold.id);
      effect(event.hold.reachType==='judgment'?'sword-arrival':'spotlight',{lane:'scene',gain:.4});
      message(event.hold.reachType==='allure'?'誘惑リーチ。図柄の決着を見届けましょう。':event.hold.reachType==='promise'?'ゆあ様との約束を。':event.hold.reachType==='tribute'?'お貢ぎリーチ。女王へ、その想いを。':'蛇眼が、運命を見定める。');return;
    }
    if(!event.hold.plainReachDemo&&event.hold.id%5===0){showLayered('spam',event.hold.id);effect('spam-alert',{lane:'scene',gain:.42});baseCue='';message('スパム襲来！');return;}
    if(!event.hold.plainReachDemo&&(event.hold.rush || event.hold.demo))showLayered('temptation',event.hold.id);
    baseCue = 'リーチ';
    if(!effect(['red','gold'].includes(event.hold.color)?'versus-2':'question',{lane:'scene',gain:.75}))
      [392, 523.25, 783.99].forEach((f, i) => tone(f, .25, .045, i * .13, 'triangle'));
    message(engine.mode==='rush'?'図柄の決着を見届けましょう。':'PUSHで演出に参加。');
  } else if (event.type === 'win') {
    if(chainEnded){chainWins=0;chainPayout=0;chainEnded=false;}
    if(event.residual){
      prayer.stop();stopLayered();stopWinReward();effects?.stop();
      showResult(event.hold.mode,true);resultScene.revive();deferredWin=event;
    }else{resultScene.reset();queueWin(event);}
  } else if (event.type === 'round-start') {
    message(`${event.round} / ${event.totalRounds} R：右打ちで大入賞口へ！`);
    if(event.round===1)effect('round-call',{gain:.22,lane:'round'});else effect('round-call',{gain:.16,lane:'round',cooldown:10});
  } else if(event.type==='reward-award'){
    rewardBump=.65;
    if(event.total>=event.target)rewardShown=event.total;
    effect('reward',{lane:'pocket',gain:.45,cooldown:.6});
    message(`SPECIAL FEVER +${event.amount}玉！ 保証 ${event.rewardPayout.toLocaleString()} / ${event.target.toLocaleString()}玉 ＋ 入賞 ${event.physicalPayout.toLocaleString()}玉`);
  } else if (event.type === 'attacker-entry') {
    flash(event.x,event.y,BONUS_COLORS[event.kind],.5);
    if(!effect('reward',{gain:.4,lane:'pocket',cooldown:.7}))tone(1046 + event.count*90,.08,.018);
    message(`大入賞 +${event.award}玉 ／ 今回の賞球 ${event.payout}玉`);
  } else if (event.type === 'bonus-end') {
    cueKind=null;chainPayout+=event.payout;
    rewardShown=event.payout;
    if(event.mode==='rush'){
      if(event.kind==='awakening'&&soundOn&&!music.ended&&!music.blocked&&music.media.currentTime<music.media.duration-.06){pvOutro={elapsed:0,skipping:false,payout:event.payout,rewardTarget:event.rewardTarget,baseRewardTarget:engine.currentSpin?.baseRewardTarget||engine.attacker.baseRewardTarget};$('pv-continue').hidden=false;} 
      else beginRushMode();
    }else effect('aura',{lane:'scene',gain:.8});
    if(pvOutro)message(`賞球 ${event.payout}玉！ 曲が終わるまでPVをお楽しみください。`);
    else if(event.mode!=='rush')message(`賞球 ${event.payout}玉！ ${event.mode==='challenge'?'RUSH挑戦':'女王RUSH'} ${event.remaining}回。右のスルーを通してRUSH入口を開けましょう。`);
  } else if(event.type==='special-result'){
    effects?.prepareScene('mode');
    showResult(event.mode);resultScene.finish();chainEnded=true;
    message('今回の結果です。');
  } else if (event.type === 'mode' && event.mode === 'normal') {
    message('通常へ戻りました。左打ちに戻して、へそを狙いましょう。');
  } else if (event.type === 'lose') {
    modeSplash=null;effects?.stop('scene');effects?.stop('prompt');
    if(!beginMiss(event.hold)){prayer.stop();screen.classList.remove('prayer-active');stopLayered();}
    baseCue = '';
    message(event.hold.reach?'図柄の結果を確認中。':'次の一回転へ。');
  }
}

function queueWin(event){
    effects?.prepareScene('bonus',event.hold);
    clearMiss();prayer.pause();layered.pause();numberFocus.stop();reelTransition.reset();
    effects?.stop('scene');effects?.stop('prompt');baseCue='';
    winConfirmation.start(event,{reels:screen.dataset.reels||'normal',focus:screen.dataset.reelFocus||'normal'});
    message('図柄が揃いました！');
}
function celebrateWin(event){
    winConfirmation.reset();
    clearMiss();
    chainWins++;
    rewardShown=0;rewardBump=0;
    bonusAudioWait=0;
    music.stop();
    prayer.stop();screen.classList.remove('prayer-active');
    stopLayered();modeSplash=null;
    if(['blessing','queen'].includes(event.kind))bonusPresentation.prepare(event.kind);
    cueKind = event.kind;
    baseCue = `${event.rules.label}降臨`;
    effects?.stop();
    if(!effect({blessing:'spotlight',queen:'dark-magic',awakening:'thunder'}[event.kind],{lane:'scene',gain:.9}))
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, .38, .05, i * .1, 'triangle'));
    jolt();
    const even=event.hold.reelValues[0]%2===0;
    const promoted=even&&(event.kind!=='blessing'||event.hold.mode==='rush');
    if(event.kind!=='awakening')winTitles.start(promoted?'promotion':event.kind==='awakening'?'awakening':event.kind==='queen'?'queen':'jackpot',event.hold.id);
    if(event.kind==='awakening'){const premium=(event.hold.baseRewardTarget||event.hold.rewardTarget)===10000;music.stop();awakeningCutin.start({variant:premium?'premium':event.hold.id===forcedKissHold?'kiss':awakeningVariant(engine.initialSeed,event.hold.id)});forcedKissHold=null;$('awakening-cutin').querySelector('[data-fever-number]').hidden=!premium;$('awakening-cutin').querySelector('[data-fever-3000]').hidden=premium;effect('apex-face',{lane:'scene',gain:.62});}
    else{diagonalCutin.start(event.kind);if(promoted||event.kind==='queen')effect('confirmed-success',{lane:'scene',gain:.48});}
    $('win-reward').hidden=event.kind==='awakening';$('win-reward').dataset.kind=event.kind;
    $('win-reward').dataset.promotion=String(promoted);
    message(`${event.rules.label}ボーナス！ 右打ちに切り替え、右下の大入賞口を狙ってください。`);
}

function applyAudioLevels(levels){
  music.level=audioScale(levels,'music');
  if(!music.level)music.setOutputVolume(0);
  numberFocus.voice.volume=numberVoiceSource?1:.75*audioScale(levels,'voice');
  if(audioMix)for(const channel of ['effects','voice'])audioMix[channel].gain.setTargetAtTime(audioScale(levels,channel),audio.currentTime,.025);
  $('music-volume').value=String(Math.round(levels.music*100));
}
const audioSettings=createAudioSettings({root:volumeDialog,openButton:$('volume-open'),onChange:applyAudioLevels,
  onOpen(){handleControl.release('volume');setFiring(false,'volume');silence();},
  onClose(){lastTime=performance.now();}
});

const newRunSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
engine = new PachinkoEngine({ seed: newRunSeed(), onEvent });
engine.machineSetting=selectMachineSetting(newRunSeed()/4294967296);
engine.setLayout('large');
engine.setPower(.5);
lighting = new LightingRig(createScopedLightingHost(machine));
let cabinetSkin = null;
function syncParts() {
  if (!engine.layoutData) return;
  renderCabinet($('cabinet-parts'),engine.layoutData,cabinetSkin);
  positionLCD(screen,engine.layoutData);
}
syncParts();
export const cabinetReady=loadCabinetSkin().then(async skin=>{
  cabinetSkin=skin;syncParts();
  // Decode the generated base pieces and light masks before revealing the frame.
  const urls=new Set(skin.pieces.flatMap(piece=>[piece.base,...Object.values(piece.masks)]));
  await Promise.all([...urls].map(src=>{const image=new Image();image.src=selectAsset(src);return image.decode();}));
  machine.classList.add('rich-material');setData(machine,'skin','ready');
}).catch(error=>{setData(machine,'skin','failed');console.error('筐体素材を読み込めませんでした',error);throw error;});
// Direct scene-preview pages can import main without the startup coordinator.
cabinetReady.catch(()=>{});
const pachinkoDiagnostics = () => ({ phase: engine.phase, stats: { ...engine.stats }, stock: engine.stock, holds: engine.holds.length, balls: engine.balls.length, layout: engine.layout, firing: engine.firing, paused: isPaused(),pauseReason:pauseReason(),recentFrameGaps:[...motionGaps],events:[...motionEvents] });
if(!PLAYER_DISTRIBUTION){window.pachinkoLights=lighting;window.pachinko=engine;window.pachinkoDiagnostics=pachinkoDiagnostics;}
if(PLAYER_DISTRIBUTION){document.body.dataset.distribution='true';for(const node of document.querySelectorAll('#settings,#bonus-menu')){node.inert=true;node.hidden=true;for(const control of node.querySelectorAll('button,input,select'))control.disabled=true;}}

function setFiring(value,reason='button') {
  const previous=firing;
  firing = Boolean(value) && engine.stock > 0 && !isPaused();
  engine.setFiring(firing);
  if(previous!==firing)traceMotion('firing',{reason});
  setData(machine,'firing',String(firing));
  $('fire').classList.toggle('active', firing);
  $('fire').setAttribute('aria-pressed', String(firing));
  $('fire-label').textContent = firing ? '打ち止め' : '打ち出す';
  $('handle').classList.toggle('held', firing);
  if (firing) { $('intro').classList.add('dismissed'); message('打ち出し中。強さを変えてみてください。'); }
}
$('fire').addEventListener('click', () => { if(!firing)unlockAudio(); setFiring(!firing); });
function setPower(value){
  const v=Math.max(0,Math.min(100,Math.round(Number(value))));engine.setPower(v/100);$('power').value=String(v);
  $('handle-power').textContent=String(v);$('handle').style.setProperty('--handle-turn',`${-60+v*1.2}deg`);
  $('power-value').textContent=`${v}・${v<35?'弱':v<60?'中':v<90?'強':'右打ち'}`;
}
$('power').addEventListener('input',event=>setPower(event.target.value));
function needsRight(){return engine.phase==='win'||engine.mode!=='normal';}
function waitingForHolds(){return Boolean(deferredWin||resultScene.active||pvOutro||modeSplash)||(engine.phase!=='win'&&engine.mode!=='normal'&&engine.rushRemaining===0);}
$('aim-switch').addEventListener('click',()=>{
  const right=needsRight();setPower(right?100:50);
  message(right?'右打ちの強さに切り替えました。右の光る入口を狙いましょう。':'左打ちの強さに戻しました。中央のへそを狙いましょう。');
});
const handleControl=bindHandle($('handle'),{
  getPower:()=>engine.power*100,setPower,setFiring,unlock:unlockAudio,
  canStart:()=>engine.stock>0&&!isPaused(),travel:()=>Math.max(140,machine.clientHeight*.32),onCaptureLost:()=>traceMotion('handle-capture-lost')
});
let cachedPlan,cachedPlanType,cachedPlanDuration;
function reachPlan(){
  const type=engine.currentSpin?.reachType,duration=engine.phase==='reach'?engine.phaseDuration:engine.currentSpin?.promiseRed?PROMISE_RED_SECONDS:engine.currentSpin?.prayerAscension?PRAYER_ASCENSION_SECONDS:undefined;
  if(!cachedPlan||type!==cachedPlanType||duration!==cachedPlanDuration){cachedPlan=getReachTiming(type,duration);cachedPlanType=type;cachedPlanDuration=duration;}
  return cachedPlan;
}
function currentPush(){return engine.phase==='reach'&&engine.currentSpin?.prayerDevelops!==false?activePushWindow(engine.phaseElapsed,reachPlan()):null;}
function refreshPushWindow(){
  const window=currentPush();
  if(window&&lastPushWindow!==window.id){lastPushWindow=window.id;pushed=pushedWindows.has(window.id);pushSoundShown=false;screen.classList.toggle('pushed',pushed);}
}
function glassPushTime(){
  if(isPaused()||modeSplash||pvOutro||resultScene.active||winConfirmation.active||missPresentation.active||awakeningCutin.active||diagonalCutin.active)return null;
  if(layered.key===null||layered.kind!=='allure'||layered.root.hidden)return null;
  const time=scenePreview
    ?scenePreview.kind==='allure'?scenePreview.elapsed:null
    :engine.phase==='reach'&&engine.currentSpin?.reachType==='allure'&&engine.currentSpin.id===layered.key?engine.phaseElapsed:null;
  return Number.isFinite(time)&&time>=0&&time<layered.scene.duration?time:null;
}
function push() {
  if(isPaused())return false;
  unlockAudio();
  // Mechanical button feedback is independent of the outcome/PUSH window.
  // Repeated presses remain cosmetic and cannot reapply a success.
  effect('faith-metal-hit',{lane:'push',gain:.72,cooldown:.09});
  if(lowLoad){cabinetPushAt=lightClock;lightStamp=0;}
  // Touching the glass is a repeatable picture reaction, independent of the
  // once-per-window PUSH success below. It never changes a captured outcome.
  const glassTime=glassPushTime();
  const glassMoved=glassTime!==null&&layered.push(glassTime);
  const window=currentPush();
  if (scenePreview || modeSplash || resultScene.active || !window || (!window.repeat&&pushedWindows.has(window.id))) return glassMoved;
  pushedWindows.add(window.id);
  pushed = true; pushedAt=engine.phaseElapsed; screen.classList.add('pushed');
  if(window.repeat)layered.tributeDevelopment.push(engine.phaseElapsed);
  const faithHit=engine.currentSpin?.prayerAscension&&prayer.ascension?.push(engine.phaseElapsed+(prayer.strongOffset||0));
  judgmentConfirm.push({phase:engine.phase,hold:engine.currentSpin,elapsed:reachArtTime(engine.currentSpin?.reachType,engine.phaseElapsed,engine.phaseDuration),realElapsed:engine.phaseElapsed});
  effects?.stop('prompt');
  // Glass motion retains its own poison effect; the button strike is shared.
  jolt();
  return true;
}
$('physical-push').addEventListener('click', push); $('lcd-push').addEventListener('click', push);
document.addEventListener('keydown',event=>{
  if((event.code!=='Space'&&event.key!==' ')||event.repeat||event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey)return;
  // Focused controls keep their native Space action (including PUSH click), so
  // keyboard handle firing, text entry and button activation never fire twice.
  if(event.target?.isContentEditable||event.target?.closest?.('button,input,select,textarea,a[href],[role="button"],[contenteditable="true"]'))return;
  if(glassPushTime()===null)return;
  event.preventDefault();push();
});
function scenePreviewBusy(){return engine.phase==='reach'||Boolean(scenePreview||modeSplash||pvOutro||winConfirmation.active||awakeningCutin.active||diagonalCutin.active||missPresentation.active||resultScene.active);}
if(!PLAYER_DISTRIBUTION){
$('demo').addEventListener('click', () => openDialog(bonusMenu));
for (const button of document.querySelectorAll('[data-bonus]')) button.addEventListener('click', () => {
  unlockAudio();
  const accepted=engine.triggerDemo(button.dataset.bonus,{rewardTarget:Number(button.dataset.rewardTarget)||3000});
  bonusMenu.close();
  if(accepted&&button.dataset.cutin==='kiss')forcedKissHold=(engine.mode==='normal'?engine.holds:engine.specialHolds).at(-1)?.id;
  if(accepted){$('intro').classList.add('dismissed');setFiring(true);}
  message(accepted ? `${BONUS_RULES[button.dataset.bonus].label}の当たりを予約しました。` : '今の当たり体験が終わるまでお待ちください。');
});
for(const button of document.querySelectorAll('[data-prayer]'))button.addEventListener('click',()=>{
  unlockAudio();const accepted=engine.triggerPrayerDemo(button.dataset.prayer==='win',{develop:button.dataset.prayer!=='fizzle',strong:button.dataset.strong==='true'});bonusMenu.close();
  if(accepted){$('intro').classList.add('dismissed');setFiring(true);}
  message(accepted?'お祈りリーチを予約しました。':'今の演出体験が終わるまでお待ちください。');
});
for(const button of document.querySelectorAll('[data-reach]'))button.addEventListener('click',()=>{
  unlockAudio();const accepted=engine.triggerReachDemo(button.dataset.reach,button.dataset.result==='win',{develop:button.dataset.allureDevelopment==='true',hotVoice:button.dataset.allureHotVoice==='true',tributeBranch:button.dataset.tributeBranch??null,promiseRed:button.dataset.promiseRed==='true'});bonusMenu.close();
  if(accepted){$('intro').classList.add('dismissed');setFiring(true);}
  message(accepted?`${SCENES[button.dataset.reach]?.label||'標準リーチ'}を予約しました。`:'今の演出体験が終わるまでお待ちください。');
});
for(const button of document.querySelectorAll('[data-shutter]'))button.addEventListener('click',()=>{
  unlockAudio();const accepted=engine.triggerShutterDemo({win:button.dataset.result==='win',change:button.dataset.shutter==='change'});bonusMenu.close();
  if(accepted){$('intro').classList.add('dismissed');setFiring(true);}
  message(accepted?'シャッター演出を予約しました。':'今の演出体験が終わるまでお待ちください。');
});
for(const button of document.querySelectorAll('[data-scene-demo]'))button.addEventListener('click',()=>{
  if(scenePreviewBusy())return;
  unlockAudio();prayer.pause();stopWinReward();modeSplash=null;
  scenePreview={kind:button.dataset.sceneDemo,elapsed:0};bonusMenu.close();
  $('intro').classList.add('dismissed');showLayered(scenePreview.kind,`preview-${++previewSequence}`);
  if(scenePreview.kind==='spam')effect('spam-alert',{lane:'scene',gain:.42});
  message(`${SCENES[scenePreview.kind].label}を確認中。`);
});
document.querySelector('[data-even-rush]').addEventListener('click',()=>{
  unlockAudio();const accepted=engine.triggerDemo('queen',{even:true});bonusMenu.close();
  if(accepted){$('intro').classList.add('dismissed');setFiring(true);}
  message(accepted?'偶数揃いからRUSHへ進む当たりを予約しました。':'今の演出体験が終わるまでお待ちください。');
});
for(const button of document.querySelectorAll('[data-result-demo]'))button.addEventListener('click',()=>{
  unlockAudio();const accepted=engine.triggerResultDemo(button.dataset.resultDemo==='win');bonusMenu.close();
  if(accepted){$('intro').classList.add('dismissed');setFiring(false);}
  message(accepted?'残保留のリザルト演出を予約しました。':'通常時に確認できます。');
});
}
$('pv-continue').addEventListener('click',()=>{if(pvOutro){pvOutro.skipping=true;pvOutro.elapsed=0;$('pv-continue').hidden=true;}});
$('sound').addEventListener('click', () => {
  soundOn = !soundOn; $('sound').textContent = soundOn ? '音 ON' : '音 OFF';
  $('sound').setAttribute('aria-pressed', String(soundOn));
  if (soundOn) { unlockAudio(); tone(660, .09, .028); } else if (audio) {silence();effects?.setEnabled(false);audio.suspend().catch(() => {});}
});
function openDialog(dialog) { if(PLAYER_DISTRIBUTION&&dialog!==help&&dialog!==supportDialog)return;handleControl.release('dialog');setFiring(false,'dialog');silence(); if(dialog===supportDialog)for(const image of dialog.querySelectorAll("[data-managed-src]")){image.loading="eager";image.src=selectAsset(image.dataset.managedSrc);} dialog.showModal(); }
$('settings-open').addEventListener('click', () => openDialog(settings));
$('help-open').addEventListener('click', () => openDialog(help));
$('support-open').addEventListener('click',()=>openDialog(supportDialog));
for (const dialog of [settings, help, bonusMenu,supportDialog]) dialog.addEventListener('close', () => { if(dialog===supportDialog)for(const image of dialog.querySelectorAll('[data-managed-src]'))image.removeAttribute('src'); lastTime = performance.now(); });
function layout(mode) {
  engine.setLayout(mode); screen.classList.toggle('large', mode === 'large');
  syncParts();
  for (const value of ['wide', 'large']) {
    $(`layout-${value}`).classList.toggle('selected', value === mode);
    $(`layout-${value}`).setAttribute('aria-pressed', String(value === mode));
  }
}
$('layout-wide').addEventListener('click', () => layout('wide'));
$('layout-large').addEventListener('click', () => layout('large'));
$('clear-balls').addEventListener('change', event => { clearBalls = event.target.checked; });
$('phone-width').addEventListener('change', event => document.querySelector('.game-shell').classList.toggle('phone', event.target.checked));
$('pin-names')?.addEventListener('change', event => { showNames = event.target.checked; });
for (const zone of Object.keys(lighting.zones)) {
  $(`color-${zone}`).addEventListener('input',event=>lighting.setColor(zone,event.target.value));
}
$('brightness').addEventListener('input',event=>{lighting.resetZoneEffects();lighting.setBrightness(Number(event.target.value)/100);});
$('light-mode').addEventListener('change',event=>{lighting.resetZoneEffects();lighting.setMode(event.target.value);});
$('all-red').addEventListener('click',()=>{
  lighting.resetZoneEffects();lighting.setBrightness(.9);$('brightness').value=90;
  lighting.setMode('steady'); $('light-mode').value='steady';
  for (const zone of Object.keys(lighting.zones)) {lighting.setColor(zone,'#ff304b'); $(`color-${zone}`).value='#ff304b';}
});
$('push-only').addEventListener('click',()=>{
  lighting.resetZoneEffects();lighting.setMode('steady');lighting.setBrightness(1);
  $('brightness').value=100;$('light-mode').value='steady';
  for(const zone of Object.keys(lighting.zones)) lighting.setBrightness(zone==='push'?1:0,zone);
  lighting.setMode('pulse','push');settings.close();message('PUSHだけが点滅中。「光り方」の変更で全体点灯へ戻せます。');
});
$('reset').addEventListener('click', () => {
  if(session&&!session.canAct())return;
  winConfirmation.reset();clearMiss();silence();prayer.stop();screen.classList.remove('prayer-active');pushSoundShown=false;
  scenePreview=null;modeSplash=null;pvOutro=null;jackpotPV.reset();bonusPresentation.reset();screen.classList.remove('pv-active','bonus-active');stopLayered();stopWinReward();
  music.stop();$('pv-continue').hidden=true;pushedAt=null;cabinetPushAt=-Infinity;lightClock=0;resultScene.reset();judgmentConfirm.reset();numberFocus.stop();reelTransition.reset();awakeningCutin.reset();diagonalCutin.reset();deferredWin=null;chainWins=0;chainPayout=0;chainEnded=true;rewardShown=0;rewardBump=0;
  setFiring(false); engine.initialSeed=newRunSeed();engine.reset();engine.machineSetting=selectMachineSetting(newRunSeed()/4294967296); hitEffects = []; throughFlash=0; pushed = false; cueKind = null; lighting.setCue(); baseCue = ''; seenPhase = '';
  songResume=null;if(session&&!session.reset())return;
  setPower(50);
  syncParts();
  message('持ち玉を500に戻しました。'); settings.close(); $('intro').classList.remove('dismissed');
});
layout('large');
$('light-mode').value='pulse';
document.querySelector('.game-shell').classList.add('phone');
session=connectSession(engine,{
  stop:()=>{handleControl.release('session');setFiring(false,'session');silence();},onResume:()=>{lastTime=performance.now();},
  onRestore:state=>{
    seenPhase='';setPower(engine.power*100);syncParts();$('intro').classList.add('dismissed');
    songResume=state.bonusSongResume;
    if(engine.phase==='reach')onEvent({type:'reach',hold:engine.currentSpin,residual:engine.currentSpinResidual});
    if(engine.phase==='lose')beginMiss(engine.currentSpin,{restored:true});
    if(engine.phase==='win'){cueKind=engine.bonusKind;baseCue='';chainWins=1;chainEnded=false;rewardShown=engine.attacker.payout+engine.attacker.rewardPayout;}
    message('前回の続きから再開しました。「打ち出す」で発射できます。');
  }
});
setupSessionTransfer({session,root:$('help')});
flightRecorder=attachRuntimeDiagnostics({root:$('help'),sample:()=>({
 phase:engine.phase,scene:engine.currentSpin?.reachType||engine.bonusKind||'',mode:engine.mode,
 quality:document.documentElement.dataset.qualityPreset,audio:audio?`${audio.state}/${audio.sampleRate}Hz`:'off',pause:pauseReason(),
 elapsed:engine.phaseElapsed,balls:engine.balls.length,holds:engine.holds.length+engine.specialHolds.length,
 rushRemaining:engine.rushRemaining,specialHolds:engine.specialHolds.length,saveRevision:session?.status.revision??0,
 gap:motionGaps.length?Math.max(...motionGaps.map(g=>g.ms)):0,
 media:[...document.querySelectorAll('video[src]')].map(v=>(v.getAttribute('src')||'').split('/').at(-1)).join(',')
})});
setupRenderQualitySettings({root:volumeDialog,checkpoint:()=>session.checkpoint()});
if(session.debug){
  document.body.dataset.debug='true';
  const normal=$('debug-normal-denominator'),special=$('debug-special-denominator'),status=$('debug-odds-status');
  const currentSetting=()=>SETTINGS_ODDS[engine.machineSetting];
  const showCurrent=()=>{
    const odds=engine.debugOdds||engine.getRelicSummary();
    normal.value=String(Number((1/odds.normalOdds).toFixed(3)));
    special.value=String(Number((1/odds.specialOdds).toFixed(3)));
  };
  showCurrent();
  $('debug-odds-apply').addEventListener('click',()=>{
    const n=Number(normal.value),s=Number(special.value);
    if(!Number.isFinite(n)||!Number.isFinite(s)||n<1||s<1||n>9999||s>9999||!engine.setDebugOdds({normalOdds:1/n,specialOdds:1/s})){
      status.textContent='1〜9999の数を両方に入力してください。';return;
    }
    status.textContent=`適用中：通常 1/${n}、挑戦・RUSH 1/${s}。新しい保留から有効です。`;
  });
  $('debug-odds-reset').addEventListener('click',()=>{
    engine.setDebugOdds(null);showCurrent();
    const base=currentSetting();
    status.textContent=`設定${engine.machineSetting}へ戻しました（基本値 通常 1/${Number((1/base.normalOdds).toFixed(1))}、挑戦・RUSH 1/${Number((1/base.specialOdds).toFixed(1))}）。`;
  });
}
connectOperatorStock(engine,session,{root:$('operator-stock'),openButton:$('settings-open'),dialog:settings,stockDisplay:$('stock')});
function canReceiveAdReward(){
  return engine.stock===0&&engine.phase==='idle'&&engine.balls.length===0&&
    !engine.holds.length&&!engine.specialHolds.length&&!engine.throughHolds.length&&!engine.currentThrough;
}
rewardedAd=$('rewarded-ad')?createRewardedAd({
  onOpen(){handleControl.release('rewarded-ad');setFiring(false,'rewarded-ad');silence();},
  onClose(){lastTime=performance.now();},
  onReward(){
    if(!canReceiveAdReward()||!session.canAct())return false;
    const result=engine.changeStock(500,'rewarded-ad');if(!result.ok)return false;
    session.changed();const saved=session.checkpoint();
    message('500玉を補充しました。もう一度、ゆあ様に挑戦しましょう。');
    return saved.ok;
  }
}):null;
renderMusicCredits(help);
addSaveEnvironmentGuide(help);
setPower(engine.power*100);syncParts();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { handleControl.release('hidden');session?.checkpoint();silence(); if (audio) audio.suspend().catch(() => {}); }
  else { lastTime = performance.now(); rebuildBoardArtwork(); if (soundOn && audio) resumeAudioIfNeeded(audio); }
});
addEventListener('pageshow',()=>{lastTime=performance.now();rebuildBoardArtwork();});
// Media focus changes are not a pointer release. pointerup/pointercancel,
// mouse movement with no buttons, and actual tab hiding release the handle.

function circle(x, y, r, fill, context=ctx) { context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fillStyle = fill; context.fill(); }
function drawPin(peg, context=ctx) {
  const special = peg.type === 'heso' || peg.type === 'jump';
  const r = peg.r;
  circle(peg.x + 2, peg.y + 3, r + 1, '#000b',context);
  const g = context.createRadialGradient(peg.x - r * .35, peg.y - r * .5, .4, peg.x, peg.y, r);
  g.addColorStop(0, '#fff2cb'); g.addColorStop(.28, special ? '#f6d27f' : '#e1bf79'); g.addColorStop(.75, '#8b5c2d'); g.addColorStop(1, '#3c2416');
  circle(peg.x, peg.y, r, g,context);
}
// Reuse the existing pin surface for closed gates outside bonuses. Keep
// the original compositing order over translucent bonus lighting.
function drawPins(){
  // RUSH gates pulse frequently: keep them independent of the static peg canvas.
  const bakeClosedGates=engine.mode==='normal'&&engine.phase!=='win';
  if(cachedPegs!==engine.pegs||cachedBoardSkin!==cabinetSkin||cachedGateBake!==bakeClosedGates||(bakeClosedGates&&(cachedAttackerOpen!==engine.attacker?.open||cachedDenchuOpen!==engine.denchu?.open||cachedMode!==engine.mode))){
    pinContext.clearRect(0,0,BOARD.width,BOARD.height);pinContext.lineCap='round';
    const data=engine.layoutData;
    for(const wall of data?.outerWalls||[]){if(cabinetSkin&&wall.y1<270&&wall.y2<270)continue;drawRail(wall,pinContext);}
    for(const rail of data?.colliders.rails||engine.rails)drawRail(rail,pinContext);
    for(const rail of data?.stage?.floorSegments||[])drawRail(rail,pinContext);
    if(engine.bonusPocket){
      const b=engine.bonusPocket;circle(b.x,b.y,b.r+5,'#06080c',pinContext);
      pinContext.beginPath();pinContext.arc(b.x,b.y,b.r+3,0,Math.PI*2);pinContext.strokeStyle='#d6a866';pinContext.lineWidth=4;pinContext.stroke();
      pinContext.fillStyle='#000';pinContext.fillRect(b.x-b.r*.7,b.y-13,b.r*1.4,25);label('+3',b.x,b.y+b.r+25,pinContext);
    }
    engine.pegs.forEach(peg=>drawPin(peg,pinContext));
    if(bakeClosedGates&&!engine.attacker?.open)drawAttacker(pinContext);
    if(bakeClosedGates&&!engine.denchu?.open)drawDenchu(pinContext);
    cachedPegs=engine.pegs;cachedBoardSkin=cabinetSkin;cachedAttackerOpen=engine.attacker?.open;cachedDenchuOpen=engine.denchu?.open;cachedMode=engine.mode;cachedGateBake=bakeClosedGates;
  }
  ctx.drawImage(pinLayer,0,0,BOARD.width,BOARD.height);
}
function drawBall(ball){
  const tier=ball.colorTier||'silver',r=ball.r,key=`${r}:${clearBalls}:${tier}`;
  if(!ballSprites.has(key)){
    const sprite=document.createElement('canvas'),center=r+6;
    sprite.width=sprite.height=Math.ceil(center*2);
    const c=sprite.getContext('2d');
    circle(center+2,center+3,r+2.5,'#04060be6',c);
    const g=c.createRadialGradient(center-r*.37,center-r*.4,r*.1,center,center,r);
    const colors={silver:['#f1f7ff','#acbbcf','#536679','#c0d6df','#e5f8ff'],blue:['#d4fcff','#46c9ff','#1754c4','#71e0ff','#e4feff'],gold:['#fff8bc','#ffc629','#b56216','#ffe65b','#fff6ca'],rainbow:['#ffbaf8','#e66afa','#3e57e1','#75ffc5','#fff3fc']}[tier];
    g.addColorStop(0,clearBalls?'#fff':'#d5dfe8');[.25,.5,.73,.9,1].forEach((at,i)=>g.addColorStop(at,colors[i]));
    circle(center,center,r,g,c);ballSprites.set(key,{sprite,center});
  }
  const {sprite,center}=ballSprites.get(key);ctx.drawImage(sprite,ball.x-center,ball.y-center);
}
function drawWheel(w) {
  if (!w) return;
  ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.angle || 0);
  // The hub and radial capsules have exactly the physics dimensions.
  for (let i = 0; i < (w.blades || 3); i++) {
    ctx.save(); ctx.rotate(i * Math.PI * 2 / (w.blades || 3));
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w.r,0);
    ctx.strokeStyle='#a9b9c9';ctx.lineWidth=w.bladeRadius*2;ctx.stroke();
    ctx.strokeStyle='#f7f0dc';ctx.lineWidth=1.4;ctx.stroke();ctx.restore();
  }
  circle(0, 0, w.hubRadius, '#d3c39d'); circle(-2, -2, 2.3, '#fff5d8'); ctx.restore();
}
function drawRail(rail,context=ctx) {
  context.beginPath(); context.moveTo(rail.x1,rail.y1);context.lineTo(rail.x2,rail.y2);
  const splitter=rail.type==='splitter';
  context.strokeStyle=splitter?'#79878c':'#8996a5';
  context.lineWidth=(rail.radius??4)*2;context.stroke();
  context.strokeStyle=splitter?'#fbefd3':'#e8edf4';context.lineWidth=splitter?2:1.5;context.stroke();
}
function label(text, x, y,context=ctx) {
  boardText.draw(context,text,x,y,{font:'20px sans-serif',fill:'#e9ddbf',stroke:'#06080cec',lineWidth:6});
}
function drawBoard(dt) {
  if(!boardRecovery.canDraw())return;
  ctx.setTransform(boardScale,0,0,boardScale,0,0);ctx.globalAlpha=1;
  ctx.clearRect(0, 0, BOARD.width, BOARD.height);
  if(engine.phase==='win'&&engine.bonusKind==='queen'&&!bonusPresentation.root.hidden){
    const light=queenBonusLight(engine.phaseElapsed,prefersReduced);
    ctx.save();ctx.beginPath();ctx.ellipse(512,770,407,635,0,0,Math.PI*2);ctx.clip();
    let wash=queenGradients.get(light.color);
    if(!wash){
      wash=ctx.createRadialGradient(512,760,90,512,760,650);
      wash.addColorStop(0,'transparent');wash.addColorStop(.6,light.color);wash.addColorStop(1,'transparent');
      // Four palette colors share the unchanged drawing transform. Reuse them
      // across frames; context recovery explicitly discards this small cache.
      if(queenGradients.size>=4)queenGradients.delete(queenGradients.keys().next().value);
      queenGradients.set(light.color,wash);
    }
    ctx.globalAlpha=light.field;ctx.fillStyle=wash;ctx.fillRect(0,0,BOARD.width,BOARD.height);ctx.restore();
  }
  ctx.lineCap = 'round';
  // Render the collision geometry directly, including the B-only collector.
  const data = engine.layoutData;
  // Static pins, rails and the pocket share one cached layer; only moving
  // balls, gates and light accents are painted on each animation frame.
  drawPins();
  if(data?.through){
    throughFlash=Math.max(0,throughFlash-dt);
    const value=String(.35+Math.min(1,throughFlash*4)*.65);
    if(value!==lastThroughLight){lastThroughLight=value;machine.style.setProperty('--through-light',value);}
  }
  if (engine.warp) {
    const { entry, exit } = engine.warp;
    if (entry) {
      const r = entry.r;
      circle(entry.x,entry.y,r+5,'#090d14');
      ctx.beginPath();ctx.arc(entry.x,entry.y,r+2,0,Math.PI*2);
      ctx.strokeStyle='#8994a4';ctx.lineWidth=4;ctx.stroke();
      ctx.save();ctx.globalAlpha=lighting.intensity('warp');
      ctx.strokeStyle=lighting.color('warp');ctx.shadowColor=lighting.color('warp');ctx.shadowBlur=lowLoad?0:10;ctx.lineWidth=3;ctx.stroke();ctx.restore();
      // A dark opening remains visible with its light switched off.
      ctx.fillStyle='#020509';ctx.fillRect(entry.x-r*.55,entry.y-9,r*1.1,18);
    }
    if (exit) {
      ctx.fillStyle='#090d14';ctx.fillRect(exit.x-27,exit.y-7,54,12);
      ctx.strokeStyle='#8994a4';ctx.lineWidth=2;ctx.strokeRect(exit.x-27,exit.y-7,54,12);
      ctx.save();ctx.globalAlpha=lighting.intensity('warp');ctx.strokeStyle=lighting.color('warp');
      ctx.beginPath();ctx.moveTo(exit.x-22,exit.y+5);ctx.lineTo(exit.x+22,exit.y+5);ctx.stroke();ctx.restore();
    }
  }
  if(engine.mode!=='normal'||engine.phase==='win'||engine.attacker?.open)drawAttacker();if(engine.mode!=='normal'||engine.phase==='win'||engine.denchu?.open)drawDenchu();
  drawWheel(engine.wheel);
  if (showNames) {
    const types = [['hakama', 'ハカマ', -24], ['branch', '分岐釘', -27], ['michi', '道釘', 34], ['jump', 'ジャンプ釘', 33], ['heso', 'へそ釘', -22]];
    for (const [type, title, offset] of types) { const pin = engine.pegs.find(p => p.type === type); if (pin) label(title, Math.max(80, Math.min(930, pin.x)), pin.y + offset); }
    if (engine.wheel) label('風車', engine.wheel.x, engine.wheel.y + (engine.wheel.r || 25) + 30);
    if (engine.warp) label('ワープ', engine.warp.entry.x, engine.warp.entry.y - 32);
    if (engine.bonusPocket) label('おまけ入賞',engine.bonusPocket.x,engine.bonusPocket.y+66);
    if (engine.denchu) label('電チュー',engine.denchu.x,engine.denchu.y-48);
    if (engine.attacker) label('大入賞口',engine.attacker.x,engine.attacker.y+60);
    if(data?.stage)label('ステージ',data.stage.x,data.stage.y+52);
    if(data?.outlet)label('アウト',data.outlet.x,data.outlet.y-37);
  }
  for (const ball of engine.balls) {
    if (ball.inWarp || ball.warp) continue;
    const r = ball.r;
    if (clearBalls && !prefersReduced && ball.trail?.length > 1) {
      ctx.beginPath(); ctx.moveTo(ball.x, ball.y); for(let i=0;i<Math.min(4,ball.trail.length);i++){const p=ball.trail[i];ctx.lineTo(p.x,p.y);}
      ctx.strokeStyle = '#d9edff32'; ctx.lineWidth = r * 1.25; ctx.stroke();
    }
    drawBall(ball);
  }
  for (const effect of hitEffects) {
    effect.age += dt;
    const p = effect.age / effect.life;
    ctx.globalAlpha = Math.max(0, 1 - p); ctx.beginPath(); ctx.arc(effect.x, effect.y, 8 + p * 34, 0, Math.PI * 2);
    ctx.strokeStyle = effect.color; ctx.lineWidth = 2.8 * (1 - p); ctx.stroke();
  }
  ctx.globalAlpha = 1; let retained=0; for(const effect of hitEffects)if(effect.age<effect.life)hitEffects[retained++]=effect; hitEffects.length=retained;
}
function gateGradient(kind,y,depth){
  const key=kind+':'+y+':'+depth;if(gateGradients.has(key))return gateGradients.get(key);
  const g=kind==='flap'?ctx.createLinearGradient(0,y+depth-8,0,y+depth+4):ctx.createLinearGradient(0,y,0,y+depth);
  const stops=kind==='denchu'?[[0,'#ede8d3'],[.4,'#647d88'],[.6,'#c6d4d3'],[1,'#405363']]:kind==='inner'?[[0,'#071016'],[.8,'#132c32'],[1,'#6d8690']]:kind==='flap'?[[0,'#e9e8cf'],[.5,'#778887'],[1,'#223640']]:[[0,'#faf3da'],[.2,'#95aaab'],[.48,'#e3e0ca'],[.55,'#76898f'],[1,'#253f4c']];
  for(const [offset,color] of stops)g.addColorStop(offset,color);
  gateGradients.set(key,g);return g;
}
function drawAttacker(context=ctx){
  const a=engine.attacker;if(!a)return;
  const {x1,x2,y}=a.gate,width=x2-x1,depth=width*.15;
  const light=BONUS_COLORS[engine.bonusKind]||lighting.color('frame');
  // The artwork surrounds this exact physical mouth. Only a short local flap
  // moves; its matching receiver collision segments come from layout.js.
  context.fillStyle='#050d13';context.fillRect(x1,y,width,depth);
  if(a.open){
    a.wings.forEach(wing=>{
      context.beginPath();context.moveTo(wing.x1,wing.y1);context.lineTo(wing.x2,wing.y2);
      context.lineWidth=wing.radius*2;context.strokeStyle='#acbabd';context.stroke();
      context.lineWidth=1.7;context.strokeStyle='#ffefd0';context.stroke();
    });
    const inner=gateGradient('inner',y,depth);
    context.fillStyle=inner;context.fillRect(x1,y,width,depth);
    const flap=gateGradient('flap',y,depth);
    context.fillStyle=flap;context.fillRect(x1,y+depth-7,width,10);
    context.save();context.strokeStyle=light;context.shadowColor=light;context.shadowBlur=lowLoad?0:8;
    context.lineWidth=2.5;context.beginPath();context.moveTo(x1+6,y+depth+2);context.lineTo(x2-6,y+depth+2);context.stroke();context.restore();
    boardText.draw(context,`${a.count} / ${a.countLimit}`,a.x,y+15,{font:'bold 13px sans-serif',fill:'#fbf0cf'});
  }else{
    const metal=gateGradient('metal',y,depth);
    context.fillStyle=metal;context.fillRect(x1,y,width,depth);
    context.strokeStyle='#253d49';context.lineWidth=1.5;context.strokeRect(x1+3,y+3,width-6,depth-6);
    boardText.draw(context,'大入賞口',a.x,y+15,{font:'bold 13px serif',fill:'#203743'});
    context.strokeStyle='#dde5d5';context.lineWidth=1;context.beginPath();context.moveTo(x1+8,y+depth-5);context.lineTo(x2-8,y+depth-5);context.stroke();
  }
}

function drawDenchu(context=ctx){
  const d=engine.denchu;if(!d)return;
  const {x1,x2,y}=d.gate,width=x2-x1,depth=width*.15;
  if(d.open){
    for(const wing of d.wings||[])drawRail(wing,context);
    context.fillStyle='#091421';context.fillRect(x1,y,width,depth);
    context.save();context.strokeStyle=lighting.color('accent');context.shadowColor=lighting.color('accent');context.shadowBlur=lowLoad?0:8;
    context.lineWidth=2.5;context.beginPath();context.moveTo(x1+3,y+depth);context.lineTo(x2-3,y+depth);context.stroke();context.restore();
  }else{
    const metal=gateGradient('denchu',y,depth);
    context.fillStyle=metal;context.fillRect(x1,y,width,depth);
  }
  boardText.draw(context,'RUSH',d.x,y+48,{font:'bold 15px sans-serif',fill:engine.mode!=='normal'?'#f3d6ff':'#d2ded7',stroke:'#20333b',lineWidth:4});
}

function renderUI(now) {
  const phase = deferredWin?'lose':engine.phase;
  const phaseChanged = phase !== seenPhase;
  if (phaseChanged) {
    for (const p of ['idle', 'spin', 'reach', 'win', 'lose']) screen.classList.toggle(`phase-${p}`, p === phase);
    seenPhase = phase;
    if(phase==='idle'&&!scenePreview&&!modeSplash&&!pvOutro&&!resultScene.active)effects?.prepareScene('normal');
  }
  const displayMode=pvOutro?'normal':engine.mode;
  setData(screen,'setting',String(engine.machineSetting));
  if(screen.dataset.playMode!==displayMode){
    setData(screen,'playMode',displayMode);
    screen.querySelector(':scope > .portrait').src=selectAsset(displayMode==='rush'?'assets/reaches/layered-v01/temptation-heart-v01.webp':'assets/yua.png');
  }
  const plan=reachPlan();
  // Prepare the large prayer layout beneath the three-second announcement.
  // Its size-change fade finishes while the title still masks the digits.
  const focusAt=engine.currentSpin?.reachType==='prayer'?Math.max(0,plan.introDuration-3):plan.resultFocusAt;
  const prayerFocus=engine.currentSpin?.prayerAscension?ascensionState(engine.phaseElapsed+(plan.duration===36?9:0)).reelFocus:'center';
  setData(screen,'longReach',String(phase==='reach'&&plan.long));
  setData(screen,'reachDuration',String(plan.duration));
  if(phaseChanged||now-uiStamp>=80)setData(screen,'reachElapsed',engine.phaseElapsed.toFixed(2));
  setData(screen,'reachKind',engine.currentSpin?.reachType||'');
  setData(screen,'promiseBeam',String(phase==='reach'&&engine.currentSpin?.promiseRed===true&&engine.phaseElapsed>=engine.phaseDuration-8&&engine.phaseElapsed<engine.phaseDuration-4&&!scenePreview&&!resultScene.active));
  setData(screen,'reelFocus',winConfirmation.active?winConfirmation.snapshot.focus:missPresentation.active&&missPresentation.state?.scenery?missPresentation.snapshot.focus:phase==='reach'&&engine.currentSpin?.prayerDevelops!==false&&!scenePreview&&!resultScene.active&&focusAt!==undefined&&engine.phaseElapsed>=focusAt?prayerFocus:'normal');
  const window=currentPush();
  setHidden($('lcd-push'),Boolean(scenePreview||modeSplash||resultScene.active) || (engine.mode==='rush'&&!plan.long) || !window || (!window.repeat&&pushedWindows.has(window.id)));
  setHidden($('standard-reach-title'),phase!=='reach'||engine.currentSpin?.reachType!=='standard'||Boolean(scenePreview||modeSplash||resultScene.active));
  setData($('lcd-push'),'window',window?String(window.id):'');
  setData($('lcd-push'),'repeat',String(Boolean(window?.repeat)));
  setText($('lcd-push'),window?.repeat?'お貢ぎPUSH':'PUSH');
  if(!$('lcd-push').hidden&&!pushSoundShown){pushSoundShown=true;if(engine.currentSpin?.reachType!=='prayer')effect('slow-motion',{lane:'prompt',gain:.45});}
  const prayerForecast=phase==='reach'&&engine.currentSpin?.prayerDevelops===false?prayerForecastState(engine.phaseElapsed,engine.phaseDuration):null;
  setStyle(screen,'--prayer-fizzle-digit-opacity',String(prayerForecast?.digitOpacity??0));
  updateReels(prayerForecast?.settled?engine.currentSpin.reelValues:engine.reelValues,prayerForecast?.settled?[true,true,true]:engine.reelStopped,{time:lightClock,paused:isPaused(),phase:engine.phase,visible:reelsAreVisible({bonus:screen.classList.contains('bonus-active'),prayerIntro:prayer.root.dataset.intro==='true',fizzleDigits:prayer.root.dataset.fizzleDigits==='true',promiseIntro:layered.root.dataset.promiseAnnouncement==='true',shatter:screen.dataset.missResult==='shatter',layered:screen.classList.contains('layered-active'),reels:screen.dataset.reels,focus:screen.dataset.reelFocus,beam:screen.dataset.promiseBeam==='true'})});
  if (!phaseChanged && now - uiStamp < 80) return;
  uiStamp = now;
  const right=needsRight(),waiting=Boolean(deferredWin)||waitingForHolds(),wrong=right?engine.power<.9:engine.power>=.9;
  setData($('play-guide'),'direction',right?'right':'left');setData($('play-guide'),'wrong',String(wrong&&!waiting));
  setText($('aim-direction'),waiting?'保留消化中':right?'右打ち →':'← 左打ち');
  setText($('aim-target'),waiting?'打ち止めで見守ってOK':engine.phase==='win'?'右下の大入賞口で賞球':right?(engine.denchu.open?'RUSH入口 開放中':engine.currentThrough?'スルー抽選中':'スルーを通して入口を開く'):'へそを狙って抽選');
  setText($('aim-switch'),right?(wrong?'右打ちにする':'右打ち中'):(wrong?'左打ちに戻す':'左打ちにする'));
  setDisabled($('aim-switch'),false);
  setStyle(machine,'--denchu-light',engine.denchu?.open?'1':'.15');
  setText($('stock'), engine.stock); setText($('spins'), engine.stats.spins); setText($('wins'), engine.stats.wins-(deferredWin?1:0));
  setText($('route-stats'), `外側 A ${engine.stats.routeA || 0}球 ／ 内側 B ${engine.stats.routeB || 0}球 ／ 右 ${engine.stats.routeRight || 0}球 ／ Bワープ ${engine.stats.warpB || 0}球・こぼれ ${engine.stats.warpMissB || 0}球 ／ 電チュー ${engine.stats.denchuEntries||0}球 ／ 大入賞 ${engine.stats.attackerEntries||0}球`);
  setText($('path-stats'),`ステージ 中央 ${engine.stats.stageCenter||0}球・端 ${engine.stats.stageSpill||0}球 ／ おまけ ${engine.stats.bonusEntries||0}球 ／ アウト ${engine.stats.outBalls||0}球 ／ スルー ${engine.stats.throughPasses||0}球・開放 ${engine.stats.throughWins||0}回`);
  const mode=engine.mode, special=mode!=='normal';
  const modeName=mode==='challenge'?'挑戦':mode==='rush'?'RUSH':'通常';
  setText($('mode'),pvOutro?'余韻':modeSplash?'突入演出':phase==='win'?'大当り':modeName);
  setText($('rush-count'),pvOutro||modeSplash?'—':phase==='win'?`${engine.attacker.round||1}/${engine.attacker.totalRounds}R`:waiting?'保留消化':special?engine.rushRemaining:'—');
  document.querySelector('.mode-meter').classList.toggle('active',special||phase==='win');
  setText($('screen-mode'),pvOutro?'覚醒 BONUS FINISH':phase==='win'?`${BONUS_RULES[engine.bonusKind]?.label ?? ''} BONUS`:waiting?`${modeName} 保留消化中`:special?(mode==='rush'?'狂信者 RUSH':'挑戦'):'通常');
  setHidden($('demo-tag'),!session?.operator||!engine.currentSpin?.demo);
  setText($('cue'),phase==='idle'?'':baseCue);
  const a=engine.attacker;
  setData(screen,'bonus',phase==='win'?(engine.bonusKind||''):'');
  setStyle(screen,'--bonus-color',BONUS_COLORS[engine.bonusKind]||'#f2dab0');
  const bonusTotal=pvOutro?.payout??(a.payout+(a.rewardPayout||0)),rewardTarget=pvOutro?.rewardTarget||engine.currentSpin?.rewardTarget||0;
  setHidden($('bonus-guarantee'),(phase!=='win'&&!pvOutro)||!rewardTarget||awakeningCutin.active||Boolean(deferredWin));
  const baseReward=pvOutro?.baseRewardTarget||engine.currentSpin?.baseRewardTarget||rewardTarget;
  setHidden($('bonus-guarantee').querySelector('[data-bonus-3000]'),baseReward===10000);
  setHidden($('bonus-guarantee').querySelector('[data-bonus-10000]'),baseReward!==10000);
  setData($('bonus-guarantee'),'multiplier',rewardTarget>baseReward?`×${rewardTarget/baseReward}`:'');
  if((phase==='win'||pvOutro)&&rewardTarget){setText($('screen-mode'),'');setText($('cue'),'');}
  setText($('outcome'),phase==='win'&&!rewardTarget?`賞球 ${bonusTotal} 玉`:phase==='lose'?'NEXT':'');
  setHidden($('reward-meter'),(phase!=='win'&&!pvOutro)||!rewardTarget||awakeningCutin.active||Boolean(deferredWin));
  setText($('reward-meter').querySelector('b'),Math.min(bonusTotal,Math.round(rewardShown)).toLocaleString());
  setText($('reward-meter').querySelector('small'),`${rewardTarget.toLocaleString()}玉保証 ＋ 入賞分`);
  setData($('reward-meter'),'bump',String(rewardBump>0));
  setHidden($('st-counter'),mode==='normal'||phase==='win'||Boolean(modeSplash||pvOutro||resultScene.active));
  setText($('st-counter').querySelector('strong'),engine.rushRemaining);
  setHidden($('st-counter').querySelector('img'),mode!=='rush');
  setText($('st-counter').querySelector('small'),mode==='rush'?'ST 残り':'挑戦 残り');
  setText($('st-counter').querySelector('small:last-child'),`回 ＋ 保留${engine.specialHolds.length}`);
  setData($('st-counter'),'last',String(engine.rushRemaining<=1));
  setHidden($('right-aim'),!needsRight()||waiting||Boolean(scenePreview||modeSplash||pvOutro||awakeningCutin.active||diagonalCutin.active||resultScene.active));
  setData($('right-aim'),'target',phase==='win'?'attacker':'denchu');
  setHidden($('round-status'),phase!=='win');
  setText($('round-status'),engine.bonusSong?.active?`${a.round} / ${a.totalRounds} R · ${a.count} / ${a.countLimit} 入賞 · ${Math.ceil(engine.bonusSong.remainingToRound)}秒`:engine.bonusState==='intro'?`${a.totalRounds} R 開始`:engine.bonusState==='open'?`${a.round} / ${a.totalRounds} R · ${a.count} / ${a.countLimit} 入賞 · ${Math.ceil(a.timeLimit-a.elapsed)}秒`:`${a.round} R 終了`);
  const queue=special&&!resultScene.active?engine.specialHolds:engine.holds;
  holdDots.forEach((dot,i)=>{const hold=queue[i];setData(dot,'color',hold?.color||'');dot.classList.toggle('full',Boolean(hold));dot.classList.toggle('hot',Boolean(hold&&['gold','red'].includes(hold.color)));});
  setAttribute($('holds'),'aria-label',`${resultScene.active?'通常':modeName}保留${queue.length}個`);
  setDisabled($('demo'),Boolean(scenePreview||modeSplash||pvOutro||resultScene.active||awakeningCutin.active||diagonalCutin.active||engine.resultDemoPending||engine.currentSpin?.demo||engine.holds.some(h=>h.demo)||engine.specialHolds.some(h=>h.demo)));
  if(!PLAYER_DISTRIBUTION)for(const button of document.querySelectorAll('[data-scene-demo]'))setDisabled(button,scenePreviewBusy());
  setText($('fire-label'),firing?'打ち止め':phase==='win'?'打って賞球獲得':'打ち出す');
  if (engine.stock <= 0 && firing) { setFiring(false,'empty'); message('持ち玉がなくなりました。「玉を補充」からコードを入力できます。'); }
}
function frame(now) {
  const workStart=profileRender?performance.now():0;
  if(lastTime&&!isPaused()&&now-lastTime>80){motionGaps.push({ms:Math.round(now-lastTime),phase:engine.phase,round:engine.attacker.round,firing:engine.firing});if(motionGaps.length>12)motionGaps.shift();}
  const dt = lastTime ? Math.min((now - lastTime) / 1000, .25) : 0;
  lastTime = now;
  rewardedAd?.tick({eligible:canReceiveAdReward(),dt,
    blocked:document.hidden||document.documentElement.dataset.startup==='loading'||document.documentElement.dataset.startup==='error'||
      settings.open||help.open||supportDialog.open||volumeDialog?.open||bonusMenu.open||session?.paused||scenePreviewBusy()
  });
  const reason=pauseReason(),paused=Boolean(reason);
  if(reason!==lastPauseReason){traceMotion('pause',{reason});lastPauseReason=reason;}
  setData(machine,'paused',String(paused));
  if(!paused)lightClock+=dt;
  const resultStatus=resultScene.update(dt,{paused});
  screen.classList.toggle('result-active',resultScene.active);
  if(resultStatus.completed&&deferredWin){const event=deferredWin;deferredWin=null;queueWin(event);}
  awakeningCutin.update(dt,{paused:paused||resultScene.blocking});
  diagonalCutin.update(dt,{paused:paused||resultScene.blocking});
  const confirmedWin=winConfirmation.update(dt,{paused:paused||resultScene.blocking});
  if(confirmedWin)celebrateWin(confirmedWin);
  screen.classList.toggle('win-confirming',winConfirmation.active);
  if(pvOutro&&!paused){if(pvOutro.skipping)pvOutro.elapsed+=dt;if(music.ended||music.blocked||!soundOn||(pvOutro.skipping&&pvOutro.elapsed>=1.8))beginRushMode();}
  const awakeningWin=engine.phase==='win'&&engine.bonusKind==='awakening';
  const bgm=musicState({phase:missPresentation.active&&missPresentation.state?.scenery?'reach':engine.phase,reachType:engine.currentSpin?.reachType,mode:engine.mode,awakening:awakeningWin,intro:awakeningCutin.active||winConfirmation.active,outro:pvOutro?(pvOutro.skipping?pvOutro.elapsed:0):null,modeSplash:Boolean(modeSplash),result:resultScene.active});
  const judgmentVoice=engine.phase==='reach'&&engine.currentSpin?.reachType==='judgment'&&engine.phaseElapsed>=2.2&&engine.phaseElapsed<4.8;
  const songReward=pvOutro?.baseRewardTarget||engine.currentSpin?.baseRewardTarget||0;
  const allureVoice=layered.key!==null&&((layered.kind==='allure'&&layered.root.dataset.voiceState==='playing')||(layered.kind==='promise'&&Boolean(layered.voice)));
  if(effects&&effects.ducking!==allureVoice){effects.ducking=allureVoice;effects.master.gain.setTargetAtTime(allureVoice?.12:.7,audio.currentTime,.06);}
  music.update({...bgm,rewardTarget:songReward,duck:bgm.duck||judgmentVoice||allureVoice,enabled:soundOn,paused:paused||bgm.paused},dt);
  let waitingForSong=false;
  if(awakeningWin&&!winConfirmation.active&&!awakeningCutin.active&&!deferredWin){
    const duration=music.media.duration;
    const selectedSongReady=Boolean(music.track&&music.media.currentSrc.endsWith(music.track.src)&&music.media.readyState>=1);
    if(songResume&&soundOn&&selectedSongReady&&Number.isFinite(duration)&&duration>15){music.media.currentTime=Math.min(engine.bonusSong?.time??songResume.time,duration-.01);songResume=null;}
    if(soundOn&&!music.blocked&&selectedSongReady&&Number.isFinite(duration)&&duration>15){engine.setBonusSongClock(music.media.currentTime,duration);}
    else if(engine.bonusSong?.active){engine.setBonusSongClock(null,engine.bonusSong.duration);}
    else if(soundOn&&!music.blocked&&engine.attacker.round===0){if(!paused)bonusAudioWait+=dt;waitingForSong=bonusAudioWait<5;}
  }
  if (!paused) advancePlayback(engine,dt,()=>({resultIntake:resultScene.active,pauseSpin:Boolean(scenePreview||waitingForSong||modeSplash||pvOutro||winConfirmation.active||awakeningCutin.active||diagonalCutin.active||resultScene.blocking)}));
  // The engine and synchronous callbacks are now consistent. Persist critical
  // RUSH/bonus boundaries before uploading the next scene's artwork.
  session?.tick(now,!paused);
  screen.classList.toggle('win-confirming',winConfirmation.active);
  if(missPresentation.active&&engine.phase!=='lose')clearMiss();
  const missState=missPresentation.update(engine.phaseElapsed,{paused});
  if(missState?.stage==='normal'&&!missPresentation.cleared){
    missPresentation.cleared=true;prayer.stop();screen.classList.remove('prayer-active');stopLayered();message('次の一回転へ。');
  }
  refreshPushWindow();
  drawPresentation.update({phase:engine.phase,elapsed:engine.phaseElapsed,hold:engine.currentSpin,paused,blocked:Boolean(scenePreview||modeSplash||pvOutro||resultScene.active||engine.currentSpin?.reachType==='prayer')});
  if(!paused){rewardBump=Math.max(0,rewardBump-dt);const total=engine.attacker.payout+(engine.attacker.rewardPayout||0);rewardShown=total-rewardShown<1?total:Math.min(total,rewardShown+(total-rewardShown)*Math.min(1,dt*8));}
  const pvEligible=(engine.phase==='win'&&engine.bonusKind==='awakening'&&!winConfirmation.active&&!awakeningCutin.active&&!deferredWin)||Boolean(pvOutro);
  const pvClock=pvPlaybackClock({song:engine.bonusSong,audioTime:music.media.currentTime,audioPlaying:soundOn&&!music.blocked&&(!music.media.paused||music.ended),phaseElapsed:engine.phaseElapsed});
  const pvVisible=jackpotPV.update(pvClock,{active:pvEligible,paused,reducedMotion:prefersReduced,premium:songReward===10000});
  screen.classList.toggle('pv-active',Boolean(pvVisible));
  const a=engine.attacker;
  const winMonitor=winMonitorState({phase:engine.phase,elapsed:engine.phaseElapsed,blocked:Boolean(winConfirmation.active||awakeningCutin.active||diagonalCutin.active||resultScene.active||deferredWin)});
  const ordinaryBonusVisible=bonusPresentation.update({
    active:engine.phase==='win'&&['blessing','queen'].includes(engine.bonusKind)&&!deferredWin&&!diagonalCutin.active&&!awakeningCutin.active&&winMonitor.bonusReady,
    kind:engine.bonusKind,round:a.round,totalRounds:a.totalRounds,roundElapsed:a.elapsed,roundDuration:a.timeLimit,
    phaseElapsed:engine.phaseElapsed,paused,reducedMotion:prefersReduced,payout:a.payout,
    nextMode:engine.bonusKind==='queen'||engine.currentSpin?.mode==='rush'?'rush':'challenge'
  });
  screen.classList.toggle('bonus-active',ordinaryBonusVisible);
  if(!missState?.scenery&&!winConfirmation.active)prayer.update(engine.phaseElapsed,{paused:paused||Boolean(scenePreview),soundOn,pushed});
  if(scenePreview){
    if(!paused)scenePreview.elapsed+=dt;
    layered.update(scenePreview.elapsed,{paused,soundOn,pushed:false});
    if(scenePreview.elapsed>=SCENES[scenePreview.kind].duration){
      scenePreview=null;stopLayered();effects?.stop('scene');message('演出の確認が終わりました。');
      if(engine.phase==='reach'&&['promise','judgment'].includes(engine.currentSpin?.reachType))showLayered(engine.currentSpin.reachType,engine.currentSpin.id);
    }
  }else if(modeSplash){
    if(!paused)modeSplash.elapsed+=dt;
    layered.update(modeSplash.elapsed,{paused,soundOn,pushed:false});
    if(modeSplash.elapsed>=SCENES.mode.duration){modeSplash=null;stopLayered();rebuildBoardArtwork();}
  }else if(!missState?.scenery&&!winConfirmation.active)layered.update(engine.phaseElapsed,{paused,soundOn,pushed});
  const development=layered.development;
  const stormKey=development.stage==='storm'?`${layered.key}:${development.overlay.dataset.level}`:null;
  if(stormKey!==developmentSoundKey){developmentSoundKey=stormKey;effects?.stop('storm');if(stormKey&&!paused&&!missPresentation.active)effect('foreboding',{lane:'storm',gain:.35,duration:3.2});}
  if(layered.key!==null && screen.dataset.reels!==$('layered-scene').dataset.reels)setData(screen,'reels',$('layered-scene').dataset.reels);
  if(missState?.scenery)setData(screen,'reels',missPresentation.snapshot.reels);
  if(winConfirmation.active)setData(screen,'reels',winConfirmation.snapshot.reels);
  if(engine.phase==='win'&&!scenePreview&&!winConfirmation.active){
    const t=engine.phaseElapsed;
    winTitles.update(Math.min(t,$('win-reward').dataset.promotion==='true'?2.8:1.4),{paused,pushed});
    if(!paused){
      const amplitude=prefersReduced?0:(engine.bonusKind==='awakening'?7:engine.bonusKind==='queen'?5:3)*Math.exp(-t*3);
      machine.style.transform=`translate(${(Math.sin(t*75)*amplitude).toFixed(2)}px,${(Math.cos(t*89)*amplitude*.6).toFixed(2)}px)`;
      $('win-reward').style.setProperty('--reward-progress',String(Math.min(1,t/1.7)));
      const promotion=$('win-reward').dataset.promotion==='true';
      $('win-reward').hidden=Boolean(deferredWin)||engine.bonusKind==='awakening'||!winMonitor.wide;
      if(promotion){
        const art=$('win-reward').querySelector('.promotion-art'),stage=t<1.55?'charge':'strike';
        if($('win-reward').hidden){
          if(art.hasAttribute('src'))art.removeAttribute('src');
          delete art.dataset.stage;
        }else{
          if(art.dataset.stage!==stage||!art.getAttribute('src')){art.dataset.stage=stage;art.src=selectAsset(`assets/reaches/layered-v01/promotion-${stage}-v01.webp`);}
          art.style.transform=prefersReduced?'none':`scale(${t<1.55?1+t*.12:1.15+Math.max(0,.18-(t-1.55)*.4)})`;
        }
      }
    }
  }
  // Decorative lighting runs at 15 Hz in low load (30 Hz otherwise).
  // Impact flashes and the ball simulation keep their animation-frame cadence.
  const strongPrayer=prayer.key!==null&&prayer.strong&&(engine.phase==='reach'||missState?.scenery||winConfirmation.active);
  const flashScene=strongPrayer?'prayer-ascension':scenePreview?.kind||(modeSplash?'mode':layered.key!==null?layered.kind:null);
  const flashElapsed=missState?.scenery?missPresentation.snapshot.clock:scenePreview?.elapsed??modeSplash?.elapsed??engine.phaseElapsed;
  const ascensionClock=flashElapsed+(prayer.strongOffset||0);
  const judgmentImpact=engine.phase==='reach'&&engine.currentSpin?.reachType==='judgment'&&!scenePreview?judgmentPushFlash({elapsed:engine.phaseElapsed,pushedAt,reducedMotion:prefersReduced}):null;
  const flash=judgmentImpact?.active?judgmentImpact:strongPrayer?ascensionFlash(ascensionClock,prefersReduced):screenFlash({scene:flashScene,elapsed:flashElapsed,reducedMotion:prefersReduced});
  const flashKey=flash.beatId?`${flashScene}:${scenePreview?.key??(strongPrayer?prayer.key:layered.key)}:${flash.beatId}`:null;
  const whiteFrame=!paused&&flashKey&&flashKey!==lastFlashKey&&flash.age<.07;
  const developing=layered.development.stage!=='none'&&layered.development.overlay.dataset.level==='3';
  const hotFlash=flash.active&&['#c486ff','#ff3c57'].includes(flash.color);
  hotStage.update({active:developing||hotFlash,color:developing||flash.color==='#ff3c57'?'red':'purple',energy:developing?.85:Math.min(1,flash.opacity*3),time:flashElapsed,whiteFrame,paused});
  if(flashKey)lastFlashKey=flashKey;else if(!flashScene)lastFlashKey=null;
  setStyle(flashOverlay,'--scene-flash-color',whiteFrame?'#fff':flash.color);
  setStyle(flashOverlay,'--scene-flash-opacity',String(whiteFrame?1:flash.opacity));
  setData(flashOverlay,'whiteFrame',String(Boolean(whiteFrame)));
  setStyle(shell,'--scene-shake-x',`${(Math.sin(flashElapsed*117)*flash.shake).toFixed(2)}px`);
  setStyle(shell,'--scene-shake-y',`${(Math.cos(flashElapsed*93)*flash.shake*.65).toFixed(2)}px`);
  if(now-lightStamp>=1000/(lowLoad?15:30)||flash.active||flashWasActive){
  lightStamp=now;
  const scene=resultScene.active?(resultScene.state==='revive'?'revival':null):scenePreview?.kind||(modeSplash?'mode':engine.phase==='reach'?(layered.key!==null?layered.kind:engine.currentSpin?.reachType):null);
  const elapsed=resultScene.active?resultScene.elapsed:scenePreview?.elapsed??modeSplash?.elapsed??engine.phaseElapsed;
  lighting.cue=sceneLighting({phase:resultScene.active?'result':scenePreview?'preview':pvOutro?'win':engine.phase,mode:engine.mode,bonus:pvOutro?'awakening':engine.bonusKind,scene,elapsed,clock:lightClock,pushedAt:scenePreview?null:pushedAt,promotion:engine.phase==='win'&&$('win-reward').dataset.promotion==='true',reducedMotion:prefersReduced});
  if(engine.phase==='reach'&&reachPlan().long&&!scenePreview&&!modeSplash&&!resultScene.active){
    const t=engine.phaseElapsed,hit=pushedAt===null?0:Math.max(0,1-(t-pushedAt)/.8);
    lighting.cue={...lighting.cue,brightness:Math.min(1,.62+Math.min(t/45,1)*.24+hit*.25),pulseRate:prefersReduced?.3:t<4?.7:t<15?1.1:t<30?1.55:1.9};
  }
  if(strongPrayer&&ascensionClock>=21){const color=ascensionClock>=29?'#ff3c57':'#ffe094';lighting.cue={colors:Object.fromEntries(Object.keys(lighting.zones).map(zone=>[zone,color])),mode:prefersReduced?'steady':'pulse',pulseRate:ascensionClock>=29?1.8:1.1,brightness:.95,time:flashElapsed};}
  if(missState?.scenery&&missPresentation.snapshot.lightCue)lighting.cue={...missPresentation.snapshot.lightCue,brightness:(missPresentation.snapshot.lightCue.brightness??.8)*(.3+.7*missState.opacity)};
  if(pvVisible){
    lighting.cue=pvLighting(pvClock,prefersReduced);
    if(songReward===10000&&!prefersReduced){const progression=premiumPVProgress(pvClock);lighting.cue={...lighting.cue,mode:progression.stageIndex>=1?'rainbow':'steady',rainbowSpeed:25+progression.rainbow*55,brightness:.78+progression.progress*.16+progression.energy*.06};}
  }
  if(ordinaryBonusVisible&&engine.bonusKind==='queen'){
    const queen=queenBonusLight(engine.phaseElapsed,prefersReduced);
    lighting.cue={colors:Object.fromEntries(Object.keys(lighting.zones).map(zone=>[zone,queen.color])),mode:'steady',brightness:queen.brightness,time:queen.time};
  }
  if(awakeningCutin.active)lighting.cue=awakeningCutin.variant==='kiss'?{...lighting.cue,colors:Object.fromEntries(Object.keys(lighting.zones).map(zone=>[zone,zone==='accent'?'#fff0dd':'#ff7fcf'])),mode:'pulse',pulseRate:1.8,brightness:.9,time:awakeningCutin.elapsed}:{...lighting.cue,color:'#ffe27a',accent:'#d5b4ff',mode:'rainbow',brightness:.9,time:awakeningCutin.elapsed};
  if(layered.kind==='taunt'&&layered.key!==null)lighting.cue={colors:{frame:'#ff54bf',accent:'#d172ff',title:'#ff9be0',subtitle:'#ffcbe9',push:'#ff7bd6',warp:'#f8addd'},mode:'pulse',pulseRate:1.2,brightness:.75,time:scenePreview?.elapsed??engine.phaseElapsed};
  if(flash.active)lighting.cue={...lighting.cue,colors:Object.fromEntries(Object.keys(lighting.zones).map(zone=>[zone,whiteFrame?'#ffffff':flash.color])),mode:'steady',brightness:1,time:flashElapsed};
  if(lowLoad)lighting.cue=lowLoadCabinetLighting(lighting.cue,{
    active:Boolean(scenePreview||modeSplash||engine.phase==='reach'||engine.phase==='win'||pvVisible||awakeningCutin.active||missState?.scenery||(resultScene.active&&resultScene.state==='revive')),
    pushAge:lightClock-cabinetPushAt,reducedMotion:prefersReduced,
  });
  lighting.tick(prefersReduced ? 0 : lightClock);
  flashWasActive=flash.active;
  }
  const revivalWide=resultScene.root.dataset.wide==='true';
  const boardWide=winMonitor.wide||revivalWide;
  // WebKit may discard hidden cached surfaces during a large presentation.
  // Repaint them once on return; never reset the engine or its in-flight balls.
  if(boardWasCovered&&!boardWide)rebuildBoardArtwork();
  boardWasCovered=boardWide;
  if(now>=boardDrawRetryAt){
    try{
      if(boardHealth.due(now)){
      const probes=[];
      if(cachedPegs===engine.pegs&&engine.pegs.length){const peg=engine.pegs[0];probes.push({context:pinContext,x:peg.x*boardScale,y:peg.y*boardScale});}
      const visibleBall=engine.balls.find(ball=>!ball.inWarp&&!ball.warp);
      if(visibleBall){const entry=ballSprites.get(`${visibleBall.r}:${clearBalls}:${visibleBall.colorTier||'silver'}`);if(entry)probes.push({context:entry.sprite.getContext('2d'),x:entry.center,y:entry.center});}
      boardHealth.check(now,probes,()=>{traceMotion('board-cache-empty');rebuildBoardArtwork();});
      }
      drawBoard(paused ? 0 : dt);boardDrawFailures=0;
    }
    catch(error){
      if(!['InvalidStateError','OperationError'].includes(error?.name))throw error;
      traceMotion('board-surface-retry',{error:error.name});
      rebuildBoardArtwork({resetSurface:true});boardDrawFailures=Math.min(6,boardDrawFailures+1);boardDrawRetryAt=now+Math.min(2000,100*2**(boardDrawFailures-1));
    }
  }
  renderUI(now);syncSceneImages();
  screen.classList.toggle('board-monitor-wide',boardWide);
  setStyle(screen,'--board-reveal-opacity',String(revivalWide?1:winMonitor.opacity));
  numberFocus.update(dt,{paused,soundOn,blocked:engine.phase!=='reach'||engine.currentSpin?.reachType==='prayer'||Boolean(scenePreview||modeSplash||resultScene.active)});
  reelTransition.update(`${screen.dataset.reels||'normal'}:${screen.dataset.reelFocus||'normal'}:${boardWide?'boardwide':'lcd'}`,dt,{paused});
  const pulsePlan=reachPlan(),finalPulse=engine.phaseElapsed>=pulsePlan.resultFocusAt;
  const pulseAt=finalPulse?pulsePlan.resultFocusAt+1.75:1.6;
  const pulseDuration=finalPulse?Math.max(0,pulsePlan.duration-pulseAt):3.872154;
  const pulse=heartbeat.update({key:`${engine.currentSpin?.id}:${finalPulse?'final':'early'}`,
    active:engine.phase==='reach'&&pulsePlan.long&&!scenePreview&&!modeSplash&&!resultScene.active&&!numberFocus.active&&screen.dataset.reels!=='hidden',
    time:engine.phaseElapsed,at:pulseAt,duration:pulseDuration,enabled:soundOn,paused});
  setStyle(screen,'--heartbeat-scale',String(pulse.scale));setStyle(screen,'--heartbeat-brightness',String(pulse.brightness));
  setData(screen,'heartbeatTime',pulse.active?pulse.sourceTime.toFixed(3):'');
  const confirmed=judgmentConfirm.update({phase:engine.phase,hold:engine.currentSpin,elapsed:reachArtTime(engine.currentSpin?.reachType,engine.phaseElapsed,engine.phaseDuration),realElapsed:engine.phaseElapsed,paused,blocked:Boolean(scenePreview||modeSplash||resultScene.active)});
  setData(screen,'judgmentConfirmed',String(confirmed));
  flightRecorder?.tick(now);
  if(!PLAYER_DISTRIBUTION&&now-motionStamp>=500){
    motionStamp=now;
    $('motion-diagnostics').textContent=JSON.stringify({...pachinkoDiagnostics(),build:machine.dataset.build,ballPositions:engine.balls.map(b=>({id:b.id,x:+b.x.toFixed(1),y:+b.y.toFixed(1)}))});
    if(session?.debug){
      const visible=node=>{
        if(node.closest('[hidden]'))return false;
        for(let parent=node;parent&&parent!==document.body;parent=parent.parentElement){
          const css=getComputedStyle(parent);
          if(css.display==='none'||css.visibility==='hidden'||Number(css.opacity)===0)return false;
        }
        return true;
      };
      const sources=[...screen.querySelectorAll('img,video')].filter(visible).map(node=>{
        const src=node.currentSrc||node.getAttribute('src')||'';
        return src.split('/').at(-1);
      }).filter(Boolean);
      if(!prayer.root.hidden&&getComputedStyle(prayer.video).opacity==='0'){
        const background=getComputedStyle(prayer.root).backgroundImage.match(/([^/"()]+\.(?:png|webp|jpg))/i)?.[1];
        if(background)sources.push(`${background}（動画待機背景）`);
      }
      $('debug-monitor-state').textContent=`${engine.phase} / ${engine.currentSpin?.reachType||engine.bonusKind||'通常'} / ${engine.phaseElapsed.toFixed(1)}秒 · お祈り ${prayer.root.dataset.step||'—'}（動画${prayer.root.dataset.media||'—'}） · 降臨 ${prayer.ascension?.root?.dataset.stage||'—'} · 誘惑音声 ${layered.kind==='allure'&&layered.key!==null?`${layered.allureVoiceHot?'赤＋共通セリフ':'通常・全セリフ'}／${layered.root.dataset.voiceState}`:'—'} · 表示素材: ${sources.join('、')||'なし'}`;
    }
  }
  if(profileRender)profileRender(now,performance.now()-workStart,engine.phase,paused);
  requestAnimationFrame(frame);
}
// Start the game independently of hidden/lazy artwork in optional dialogs.
requestAnimationFrame(frame);
