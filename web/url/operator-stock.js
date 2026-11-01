export const MAX_OPERATOR_STOCK=100_000_000;

export function parseOperatorStock(value){
  if(typeof value!=='string'||!/^\d+$/.test(value.trim()))return {ok:false,reason:'integer'};
  const stock=Number(value.trim());
  return Number.isSafeInteger(stock)&&stock>=0&&stock<=MAX_OPERATOR_STOCK
    ?{ok:true,stock}:{ok:false,reason:'range'};
}

// The existing session owns access/revision checks and persistence. This is an
// operator adjustment, never a jackpot payout or an outcome/settings change.
export function connectOperatorStock(engine,session,{root,openButton,dialog,stockDisplay}={}){
  if(!root)return null;
  const input=root.querySelector('[data-stock-input]'),button=root.querySelector('[data-stock-apply]');
  const status=root.querySelector('[data-stock-status]'),current=root.querySelector('[data-stock-current]');
  let busy=false,destroyed=false;
  const authorized=()=>!destroyed&&session?.operator===true;
  const announce=(text,error=false)=>{status.textContent=text;status.dataset.error=String(error);};
  function refresh(){
    root.hidden=!authorized();input.disabled=button.disabled=!authorized();
    if(!authorized())return;
    input.value=String(engine.stock);current.textContent=engine.stock.toLocaleString('ja-JP');
    input.setAttribute('aria-invalid','false');
  }
  function apply(){
    if(!authorized())return {ok:false,reason:'operator-only'};
    if(busy)return {ok:false,reason:'busy'};
    const parsed=parseOperatorStock(input.value);
    if(!parsed.ok){
      input.setAttribute('aria-invalid','true');
      announce(parsed.reason==='integer'?'0以上の整数を入力してください。':'持ち玉は0〜100,000,000玉で指定してください。',true);
      return parsed;
    }
    if(!session.canAct()){announce('遊技の続きや保存状態を確認してから、もう一度お試しください。',true);return {ok:false,reason:'session-blocked'};}
    const target=parsed.stock,before=engine.stock,delta=target-before;
    if(!Number.isSafeInteger(before)||before<0||!Number.isSafeInteger(delta)||
      !Number.isSafeInteger((engine.stats?.stockAdjustments??0)+delta)){
      announce('現在の持ち玉を確認できないため、変更できませんでした。',true);return {ok:false,reason:'invalid-balance'};
    }
    busy=true;button.disabled=true;
    try{
      if(delta!==0){
        try{engine.changeStock(delta,'operator-stock');}
        catch(error){
          // The synchronous UI listener may fail after the engine applied the
          // adjustment. Save that actual value once; never credit it twice.
          if(engine.stock!==target){announce('持ち玉を変更できませんでした。',true);return {ok:false,reason:'adjustment-failed'};}
        }
        if(engine.stock!==target){announce('持ち玉を変更できませんでした。',true);return {ok:false,reason:'adjustment-failed'};}
      }
      refresh();if(stockDisplay)stockDisplay.textContent=String(engine.stock);
      // A view refresh failing must not prevent the save attempt.
      try{session.changed?.();}catch{}
      let saved;
      try{saved=session.checkpoint();}catch{saved={ok:false,reason:'save-error'};}
      if(!saved?.ok){
        announce(`持ち玉は${target.toLocaleString('ja-JP')}玉ですが、保存が完了していません。この画面を閉じずに再度「適用」を押してください。`,true);
        return {ok:false,applied:true,reason:'save-failed',stock:target};
      }
      announce(`持ち玉を${target.toLocaleString('ja-JP')}玉に設定し、保存しました。`);
      return {ok:true,stock:target,delta};
    }finally{busy=false;button.disabled=!authorized();}
  }
  const enter=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();apply();}};
  const edit=()=>{input.setAttribute('aria-invalid','false');announce('指定した持ち玉に変更します。');};
  const toggle=event=>{if(event.newState==='open')refresh();};
  button.addEventListener('click',apply);input.addEventListener('keydown',enter);input.addEventListener('input',edit);
  openButton?.addEventListener('click',refresh);dialog?.addEventListener('toggle',toggle);
  refresh();
  return {apply,refresh,destroy(){
    destroyed=true;root.hidden=true;button.disabled=input.disabled=true;
    button.removeEventListener('click',apply);input.removeEventListener('keydown',enter);input.removeEventListener('input',edit);
    openButton?.removeEventListener('click',refresh);dialog?.removeEventListener('toggle',toggle);
  }};
}
