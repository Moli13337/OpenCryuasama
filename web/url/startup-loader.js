import {selectAsset} from './asset-variants-v47.js';
import {applyInitialRenderQuality} from './render-quality.js';
// Only assets visible on the first normal-play frame belong in this gate.
// Optional dialogs and long videos must never hold up the game.
const FIRST_FRAME_ASSETS=[
  'assets/yua.png',
  'assets/numerals-brush-v03.png',
  'assets/playfield-pearl-v01.png',
  'assets/attacker-serpent-v01.png',
  'assets/bonus-chameleon-v01.png',
  'assets/deflector-serpent-v01.png',
  'assets/warp-serpent-v01.png',
];
const $=id=>document.getElementById(id),root=$('startup-loader');
const shell=document.querySelector('.game-shell'),html=document.documentElement;
applyInitialRenderQuality();
for(const image of document.querySelectorAll('[data-boot-src]'))image.src=selectAsset(image.dataset.bootSrc);
const CSS_MEDIA={"--media-shutter-doors-v01": "assets/reaches/layered-v01/shutter-doors-v01.webp", "--media-rpg-ornament-v01": "assets/reaches/layered-v01/rpg-ornament-v01.webp", "--media-jackpot-cutin-frame-v01": "assets/reaches/layered-v01/jackpot-cutin-frame-v01.webp", "--media-rpg-title-band-v01": "assets/reaches/layered-v01/rpg-title-band-v01.webp", "--media-rainbow-tunnel-poster-v01": "assets/reaches/layered-v01/rainbow-tunnel-poster-v01.jpg", "--media-dokun-ink-v01": "assets/reaches/layered-v01/dokun-ink-v01.webp"};
if(html.dataset.qualityPreset==='light')for(const [name,source] of Object.entries(CSS_MEDIA))html.style.setProperty(name,`url("${selectAsset(source)}")`);

const total=FIRST_FRAME_ASSETS.length+2;
let completed=0,failed=false,finished=false,slowTimer,deadline;
function progress(){
  if(failed)return;
  const percent=Math.floor(++completed/total*100);
  $('startup-progress').setAttribute('aria-valuenow',String(percent));
  $('startup-fill').style.width=`${percent}%`;$('startup-percent').textContent=`${percent}%`;
  root.dataset.completed=String(completed);
}
function fail(error){
  if(failed||finished)return;
  failed=true;clearTimeout(slowTimer);clearTimeout(deadline);
  root.dataset.state='error';html.dataset.startup='error';
  $('startup-status').textContent='読み込みが完了しませんでした';
  root.querySelector('.startup-note').textContent='接続を確認して、もう一度お試しください。';
  $('startup-retry').textContent='もう一度読み込む';
  console.warn('初回読み込みを完了できませんでした',error);
}
const imageReady=src=>{
  const image=new Image();image.decoding='async';image.src=selectAsset(src);
  return image.decode().then(progress);
};
async function boot(){
  slowTimer=setTimeout(()=>{if(!failed&&!finished)$('startup-status').textContent='素材を読み込んでいます。もう少しお待ちください';},12000);
  deadline=setTimeout(()=>fail(new Error('Startup timed out')),120000);
  try{
    $('startup-status').textContent='枠と盤面を読み込んでいます';
    const game=import('./main.js').then(async app=>{
      progress();await app.cabinetReady;progress();
    });
    await Promise.all([game,...FIRST_FRAME_ASSETS.map(imageReady)]);
    if(failed)return;
    $('startup-status').textContent='準備が整いました';
    clearTimeout(slowTimer);clearTimeout(deadline);
    // Two rendering opportunities for the mounted SVG and decoded images.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    finished=true;html.dataset.startup='ready';root.dataset.state='ready';
    shell.inert=false;shell.removeAttribute('aria-busy');root.hidden=true;
    document.dispatchEvent(new Event('game-ready'));
  }catch(error){fail(error);}
}
boot();
