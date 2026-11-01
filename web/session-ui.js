import {PLAYER_DISTRIBUTION,REWARDS_ENABLED} from './runtime-config.js';
import {sessionAccess} from './player-settings.js';
import {RelicShop} from './relic-shop.js';
import {RewardGallery} from './reward-gallery.js';
import {captureSession,restoreSession,validateSession,createSessionStore,SESSION_STORAGE_KEY} from './session-store.js';
import {createCreditLedger,redeemCreditCode} from './credit-codes.js';

// Transactions and their access ledgers are saved only after the operation has
// completed. Normal ball motion is checkpointed less often, away from draw code.
export function connectSession(engine,{stop=()=>engine.setFiring(false),onResume=()=>{},onRestore=()=>{},onChange=()=>{},rewardsEnabled=REWARDS_ENABLED}={}){
  const $=id=>document.getElementById(id),{debug,operator}=sessionAccess(location.search,PLAYER_DISTRIBUTION);
  const storageKey=debug?'yua-pachinko-debug-v1':SESSION_STORAGE_KEY;
  let credits=createCreditLedger(),blocked=false,gated=false,dirty=false,stamp=performance.now(),restored=null,ready=false;
  let transactionDepth=0,lastCaptureError=null,importCommitted=false;
  let autosaveTask=null,checkpointMode=engine.mode,checkpointBonus=engine.phase==='win';
  function cancelAutosave(){
    if(!autosaveTask)return;
    const task=autosaveTask;autosaveTask=null;
    if(task.idle)globalThis.cancelIdleCallback?.(task.id);else clearTimeout(task.id);
  }
  function scheduleAutosave(){
    if(autosaveTask||!ready||blocked||gated||importCommitted||!dirty||transactionDepth)return;
    const task={idle:typeof globalThis.requestIdleCallback==='function',id:null};autosaveTask=task;
    const run=()=>{
      if(autosaveTask!==task)return;
      autosaveTask=null;save();paint();
    };
    // Capture at execution time, never at scheduling time. Purchases and all
    // explicit checkpoints cancel this task and commit synchronously instead.
    task.id=task.idle?globalThis.requestIdleCallback(run,{timeout:1000}):setTimeout(run,0);
  }
  let store;
  try{store=createSessionStore(localStorage,{key:storageKey});}catch{store=createSessionStore({getItem(){throw Error('unavailable');}},{key:storageKey});}
  const notice=$('session-notice');
  function showNotice(text,button,action){
    notice.replaceChildren(document.createTextNode(text));notice.hidden=false;
    if(button){const b=document.createElement('button');b.textContent=button;b.addEventListener('click',action);notice.append(b);}
  }
  function block(reason){
    blocked=true;cancelAutosave();stop();
    delete notice.dataset.saveError;
    showNotice(reason==='revision-conflict'?'別の画面で遊技が更新されました。続きの状態を読み込みます。':'保存した続きの読み込みを確認できませんでした。元の記録は残しています。','再読み込み',()=>location.reload());
  }
  function check(){
    if(blocked||gated||importCommitted)return false;
    const result=store.checkRevision();if(!result.ok){block(result.reason);return false;}return true;
  }
  function resume(){stamp=performance.now();if(!blocked&&!gated)onResume();}
  function transaction(action){
    transactionDepth++;
    try{return action();}finally{transactionDepth--;}
  }
  const gallery=new RewardGallery({root:rewardsEnabled?$('reward-gallery'):null,
    onPurchase:(amount,id,quote)=>{
      if(!rewardsEnabled||!check()||engine.stock!==quote.stockBefore)return {ok:false,stock:engine.stock};
      const before=engine.stock;
      return transaction(()=>{
        try{return engine.changeStock(-amount,'reward-gallery');}
        catch(error){
          // A UI listener can throw after the debit. Acknowledge an actual
          // debit so the gallery still records the paid access in this stack.
          if(engine.stock===before-amount)return {ok:true,stock:engine.stock};
          throw error;
        }
      });
    },
    onStateChange:()=>{if(ready){dirty=true;if(!transactionDepth){save();paint();}}},
    onClose:()=>{if(!transactionDepth)resume();}
  });
  const shop=new RelicShop($('relic-shop'),{
    getShop:()=>engine.getRelicShop(),
    onBuy:id=>check()?transaction(()=>engine.buyRelic(id)):{ok:false},
    onReroll:()=>check()?transaction(()=>engine.rerollRelics()):{ok:false},
    onChanged:result=>{if(result?.ok){dirty=true;save();paint();}}
  });
  const loaded=store.load();
  if(!loaded.ok)block(loaded.reason);
  else if(loaded.payload){
    restored=restoreSession(engine,loaded.payload);
    if(restored.ok){
      credits=restored.credits;gallery.importState(restored.rewards);gated=true;
      showNotice(loaded.recovered?'予備の記録から前回の持ち玉と遊技の続きが見つかりました。':'前回の持ち玉と遊技の続きがあります。','続きから遊ぶ',()=>{
        const current=store.checkRevision();if(!current.ok){block(current.reason);return;}
        gated=false;notice.hidden=true;onRestore(restored);resume();
      });
    }else block(restored.reason);
  }
  function save(){
    cancelAutosave();
    if(!ready||blocked||gated||importCommitted||!dirty||transactionDepth)return {ok:false,reason:'deferred'};
    let payload;
    try{payload=captureSession(engine,{credits,rewards:gallery.exportState()});}
    catch(error){
      if(lastCaptureError!==error.message)console.warn('遊技の保存を次の状態で再試行します',error.message);
      lastCaptureError=error.message;notice.dataset.saveError='true';
      showNotice('遊技の保存が完了していません。画面を閉じずにお待ちください。');
      return {ok:false,reason:'capture-failed'};
    }
    lastCaptureError=null;
    const result=store.save(payload);
    if(result.ok){dirty=false;checkpointMode=payload.engine.mode;checkpointBonus=payload.engine.phase==='win';if(notice.dataset.saveError){delete notice.dataset.saveError;notice.hidden=true;}}
    else if(result.reason==='revision-conflict'||store.status.blocked)block(result.reason);
    else{notice.dataset.saveError='true';showNotice('この端末への保存ができていません。画面を閉じずに続けてください。');}
    return result;
  }
  function paint(){
    const s=engine.getRelicSummary(),parts=[];
    if(s.bonusMultiplier>1)parts.push(`全BONUS ×${s.bonusMultiplier.toLocaleString()}`);
    if(s.ballValueMultiplier>1)parts.push(`玉価値 ×${s.ballValueMultiplier.toLocaleString()}`);
    if(s.guaranteedWins)parts.push(`連チャン保証 ${s.guaranteedWins}回`);
    const count=Object.values(s.purchases).reduce((a,b)=>a+b,0);
    if(count&&!parts.length)parts.push(`レリック強化 ${count}回`);
    $('growth-strip').hidden=!parts.length;$('growth-strip').textContent=parts.join(' ／ ');
    $('machine-setting').value=String(engine.machineSetting);
    gallery.updateStock(engine.stock);onChange();
  }
  function open(which){if(!check())return;stop();dirty=true;save();if(!blocked)which();}
  $('shop-open').addEventListener('click',()=>open(()=>shop.show()));
  $('rewards-open').hidden=!rewardsEnabled;
  if(rewardsEnabled)$('rewards-open').addEventListener('click',()=>open(()=>gallery.open({stock:engine.stock,library:true})));
  document.querySelectorAll('[data-reward-only]').forEach(node=>{node.hidden=!rewardsEnabled;});
  $('credits-open').addEventListener('click',()=>open(()=>{$('credits-dialog').showModal();$('credit-code').focus();}));
  for(const dialog of [$('relic-shop'),$('credits-dialog')])dialog.addEventListener('close',resume);
  function credit(){
    if(!check())return;
    const result=transaction(()=>redeemCreditCode(engine,credits,$('credit-code').value));
    $('credit-result').textContent=result.ok?`${result.amount.toLocaleString()}玉を補充しました。`:result.reason==='already-used'?'このコードは使用済みです。':'コードを確認してください。';
    if(result.ok){$('credit-code').value='';dirty=true;save();paint();}
  }
  $('redeem-credit').addEventListener('click',credit);
  $('credit-code').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();credit();}});
  document.querySelectorAll('[data-operator-only]').forEach(node=>{node.hidden=!operator;});
  document.querySelectorAll('[data-debug-only]').forEach(node=>{node.hidden=!debug;});
  $('operator-panel').hidden=!operator;
  $('machine-setting').addEventListener('change',()=>{
    if(operator&&check()){engine.setMachineSetting(Number($('machine-setting').value));dirty=true;save();paint();}
  });
  addEventListener('storage',event=>{
    if(event.key!==storageKey&&event.key!==null)return;
    if(blocked)return;
    const result=store.checkRevision();if(!result.ok)block(result.reason);
  });
  const saveOnLeave=()=>{dirty=true;save();};
  addEventListener('pagehide',saveOnLeave);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveOnLeave();});
  document.addEventListener('freeze',saveOnLeave);
  checkpointMode=engine.mode;checkpointBonus=engine.phase==='win';
  ready=true;paint();
  if(!loaded.payload&&!blocked){dirty=true;save();}
  return {
    shop,gallery,restored,operator,debug,
    get paused(){return blocked||gated||importCommitted||shop.open||gallery.isOpen||$('credits-dialog').open;},
    get status(){return {...store.status,blocked,gated,dirty,importCommitted,autosavePending:Boolean(autosaveTask),captureError:lastCaptureError};},
    canAct:check,
    // Called once the engine step and its synchronous callbacks have finished.
    tick(now,active){
      const inBonus=engine.phase==='win',boundary=engine.mode!==checkpointMode||inBonus!==checkpointBonus;
      checkpointMode=engine.mode;checkpointBonus=inBonus;
      if(active)dirty=true;
      // Commit completed mode/bonus transitions before the next presentation.
      // A renderer termination may deliver no pagehide/visibility event. This
      // adds one write at each boundary, never one per frame or ball. Failures
      // use the regular retry interval instead of hammering storage each frame.
      if(boundary){dirty=true;stamp=now;save();paint();}
      else if(now-stamp>=3000){stamp=now;scheduleAutosave();}
    },
    checkpoint(){dirty=true;return save();},
    exportSnapshot(){
      if(!check()||transactionDepth||gallery.pending)return {ok:false,reason:'busy'};
      stop();dirty=true;const result=save();if(!result.ok)return result;
      try{return {ok:true,payload:captureSession(engine,{credits,rewards:gallery.exportState()})};}
      catch{return {ok:false,reason:'capture-failed'};}
    },
    importSnapshot(payload){
      // Validate before even stopping play. The old live state is never mixed
      // with an imported state; the next document restores the committed save.
      const valid=validateSession(payload);if(!valid.ok)return valid;
      if(!check()||transactionDepth||gallery.pending)return {ok:false,reason:'busy'};
      const result=store.save(valid.payload);if(!result.ok)return result;
      importCommitted=true;cancelAutosave();dirty=false;stop();
      showNotice('続きの記録を読み込みました。画面を開き直します。');
      return {ok:true};
    },
    reset(){
      if(!check()||gallery.pending)return false;
      transaction(()=>{credits=createCreditLedger();gallery.reset();});
      dirty=true;save();paint();return true;
    },
    changed(){dirty=true;paint();}
  };
}
