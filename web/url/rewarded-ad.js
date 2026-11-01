import {selectAsset} from './asset-variants-v47.js';
export const REWARDED_AD_SECONDS=5;
export const REWARDED_ADS=Object.freeze([
  Object.freeze({id:'othello',title:'ゆあ様とお貢ぎオセロ♡',kicker:'YUA’S OTHELLO',description:'白と紫の盤上で、ゆあ様に挑戦。難易度を選んで遊べるオセロです。',src:'assets/reward-ads-v01/othello-start-v01.png',alt:'ゆあ様とお貢ぎオセロのタイトルと難易度選択画面'}),
  Object.freeze({id:'manager',title:'ゆあ様のマゾ管理手帳',kicker:'YUA’S PRIVATE NOTEBOOK',description:'日々の記録・実績・ゲームをひとつに。自分のペースで記録を続けられる手帳です。',src:'assets/reward-ads-v01/manager-yua-v01.png',alt:'腕を組んだゆあ様の管理手帳用イラスト'}),
  Object.freeze({id:'cien-comic',title:'R18漫画を読むなら、Ci-enへ♡',kicker:'CI-EN · COMICS',description:'ゆあ様のR18漫画をご紹介。漫画のサンプルや作品の案内をCi-enでチェック。',src:'assets/reward-ads-v01/manager-yua-v01.png',alt:'ゆあ様のイラスト',href:'https://ci-en.dlsite.com/creator/40190',link:'R18漫画をCi-enで見る ↗'}),
  Object.freeze({id:'cien-voice',title:'ゆあ様のボイス、聞いてみる？',kicker:'CI-EN · VOICE',description:'ゆあ様のボイスを聞くならCi-enへ。音声作品の案内はこちらから。',src:'assets/reward-ads-v01/manager-yua-v01.png',alt:'ゆあ様のイラスト',href:'https://ci-en.dlsite.com/creator/40190',link:'ボイスの案内をCi-enで見る ↗'}),
  Object.freeze({id:'note-sm',title:'SMのこと、noteで書いてるよ。',kicker:'NOTE · ESSAYS',description:'ゆあ様のSMについての考えやお話を、noteで読んでみてね。',src:'assets/reward-ads-v01/manager-yua-v01.png',alt:'ゆあ様のイラスト',href:'https://note.com/yotogichan',link:'SMの記事をnoteで読む ↗'}),
]);

/** The host owns eligibility, stock and persistence. This controller never
 * grants currency on its own, on load, or when an external link is clicked. */
export function createRewardedAd({onReward=()=>false,onOpen=()=>{},onClose=()=>{},document:doc=globalThis.document}={}){
  const root=doc.getElementById('rewarded-ad'),reopen=doc.getElementById('rewarded-ad-open');
  const image=root.querySelector('[data-ad-image]'),title=root.querySelector('[data-ad-title]'),kicker=root.querySelector('[data-ad-kicker]'),description=root.querySelector('[data-ad-description]');
  const link=root.querySelector('[data-ad-link]');
  const status=root.querySelector('[data-ad-status]'),progress=root.querySelector('[data-ad-progress]'),claim=root.querySelector('[data-ad-claim]');
  let eligible=false,blocked=true,shownForEmpty=false,isOpen=false,elapsed=0,ready=false,claimed=false,claiming=false,next=0,error=false;
  const visible=()=>!doc.hidden;
  const paint=()=>{
    reopen.hidden=!eligible||isOpen;reopen.disabled=blocked;
    const remaining=Math.max(0,Math.ceil(REWARDED_AD_SECONDS-elapsed-1e-7));
    claim.disabled=!isOpen||!eligible||blocked||!visible()||!ready||elapsed+1e-7<REWARDED_AD_SECONDS||claimed||claiming;
    progress.style.setProperty('--ad-progress',String(Math.min(1,elapsed/REWARDED_AD_SECONDS)));
    progress.setAttribute('aria-valuenow',String(Math.round(elapsed/REWARDED_AD_SECONDS*100)));
    const label=error?'画像を読み込めませんでした。閉じて、もう一度お試しください。':!ready?'作品の紹介を読み込んでいます…':remaining?`あと${remaining}秒で500玉を受け取れます`:'500玉を受け取って、もう一度遊べます。';
    if(status.textContent!==label)status.textContent=label;
  };
  function close(){
    if(!isOpen)return false;
    isOpen=false;ready=false;elapsed=0;
    if(root.open)root.close();
    image.removeAttribute('src');paint();onClose();return true;
  }
  function show(){
    if(isOpen||!eligible||blocked||!visible())return false;
    const ad=REWARDED_ADS[next++%REWARDED_ADS.length];
    isOpen=true;shownForEmpty=true;elapsed=0;ready=false;error=false;claimed=false;claiming=false;
    root.dataset.ad=ad.id;title.textContent=ad.title;kicker.textContent=ad.kicker;description.textContent=ad.description;
    if(link){link.href=ad.href||'https://note.com/yotogichan';link.textContent=ad.link||'作品の案内をnoteで見る ↗';}
    image.alt=ad.alt;image.src=selectAsset(ad.src);
    ready=Boolean(image.complete&&image.naturalWidth>0);
    root.showModal();paint();onOpen();return true;
  }
  image.addEventListener('load',()=>{if(isOpen){ready=image.naturalWidth>0;error=false;paint();}});
  image.addEventListener('error',()=>{if(isOpen){ready=false;error=true;paint();}});
  root.querySelector('[data-ad-close]').addEventListener('click',close);
  root.addEventListener('cancel',event=>{event.preventDefault();close();});
  // Native close events are queued. Ignore an old close after a fast reopen.
  root.addEventListener('close',()=>{if(isOpen&&!root.open)close();});
  reopen.addEventListener('click',show);
  doc.addEventListener('visibilitychange',paint);
  claim.addEventListener('click',()=>{
    paint();if(claim.disabled)return;
    claiming=true;claim.disabled=true;
    try{
      // Lock synchronously before asking the host, including double-clicks.
      if(onReward()===true){claimed=true;close();}
      else{eligible=false;close();}
    }catch(error){
      // A failed save might follow a successful in-memory award. Never retry
      // this view automatically; the host controls recovery from that state.
      claimed=true;close();console.warn('広告の受け取りを完了できませんでした',error);
    }finally{claiming=false;paint();}
  });
  paint();
  return {
    get open(){return isOpen;},show,close,
    tick({eligible:allowed=false,blocked:busy=false,dt=0}={}){
      if(!isOpen&&!eligible&&!allowed&&blocked===Boolean(busy))return;
      eligible=Boolean(allowed);blocked=Boolean(busy);
      if(!eligible){shownForEmpty=false;if(isOpen)close();}
      if(eligible&&!blocked&&!shownForEmpty&&!isOpen&&visible())show();
      if(isOpen&&eligible&&!blocked&&visible()&&ready&&!claimed){
        // A suspended frame never counts as watched time, even if the host
        // forwards a large delta on foregrounding.
        elapsed=Math.min(REWARDED_AD_SECONDS,elapsed+Math.min(.25,Math.max(0,Number.isFinite(dt)?dt:0)));
      }
      paint();
    },
  };
}
