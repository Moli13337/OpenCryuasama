import {selectAsset} from './asset-variants-v47.js';
// One still image and composited light layers. The caller owns the pause clock.
export const AWAKENING_CUTIN_SECONDS=8.2;
// Presentation-only hash; never consumes the outcome RNG or changes awards.
export function awakeningVariant(seed,id){return ((Math.imul((seed^Math.imul(id,2654435761))>>>0,1597334677)>>>0)%100)<50?'kiss':'royal';}
const clamp=x=>Math.max(0,Math.min(1,x));
function collectImages(root){
 return [...(root.querySelectorAll?.('img[data-scene-src]')??[])].map(node=>{node.loading='eager';return [node,node.dataset.sceneSrc];});
}
function sceneImages(images,active,variant){
 for(const [node,original] of images){
  const src=selectAsset(original);
  const name=node.className||'';
  const portrait=name.includes('__premium')?'premium':name.includes('__kiss')?'kiss':name.includes('__art')?'royal':null;
  const wanted=active&&(!variant||!portrait||variant===portrait)&&!(variant==='premium'&&node.hasAttribute?.('data-fever-3000'));
  if(wanted){if(node.getAttribute('src')!==src)node.src=src;}else node.removeAttribute('src');
 }
}
export class AwakeningCutin {
  constructor(root,{reducedMotion=false,onBeat=()=>{}}={}){
    this.root=root;this.images=collectImages(root);this.reducedMotion=reducedMotion;this.onBeat=onBeat;
    this.active=false;this.elapsed=0;this.beaten=new Set();root.hidden=true;
    root.dataset.reduced=String(reducedMotion);
    const hearts=root.querySelector?.('[data-kiss-hearts]');
    if(hearts)for(let i=0;i<24;i++){
      const node=root.ownerDocument.createElement('i'),angle=i*Math.PI*2/24;
      node.textContent='♥';node.style.setProperty('--hx',`${Math.cos(angle)*(55+i%3*14)}vw`);node.style.setProperty('--hy',`${Math.sin(angle)*(60+i%4*10)}vh`);
      node.style.setProperty('--hr',`${i%2?24:-20}deg`);node.style.setProperty('--hs',String(.7+i%5*.18));hearts.append(node);
    }
  }
  start({variant='royal'}={}){this.variant=['kiss','premium'].includes(variant)?variant:'royal';this.root.dataset.variant=this.variant;sceneImages(this.images,true,this.variant);this.active=true;this.elapsed=0;this.beaten.clear();this.root.hidden=false;this.paint();}
  reset(){this.active=false;this.elapsed=0;this.beaten.clear();this.root.hidden=true;this.root.dataset.fever='false';sceneImages(this.images,false);}
  update(dt,{paused=false}={}){
    if(!this.active)return false;
    if(paused)return true;
    this.elapsed+=Math.max(0,Math.min(.05,dt));
    if(this.elapsed>=AWAKENING_CUTIN_SECONDS){this.reset();return false;}
    for(const [id,at] of [['reveal',.65],['seal',1.45]])if(this.elapsed>=at&&!this.beaten.has(id)){this.beaten.add(id);this.onBeat({id,at});}
    if(this.variant==='kiss'&&this.elapsed>=1.45&&!this.beaten.has('kiss')){this.beaten.add('kiss');this.onBeat({id:'kiss',at:1.45});}
    for(const at of [4.2,4.36,4.52,4.68,4.84,5,5.4]){const id=`fever-${at}`;if(this.elapsed>=at&&!this.beaten.has(id)){this.beaten.add(id);this.onBeat({id,at,final:at===5.4});}}
    this.paint();return true;
  }
  paint(){
    const t=this.elapsed,style=this.root.style,reduce=this.reducedMotion;
    this.root.dataset.step=t<.65?'slit':t<1.45?'reveal':'seal';
    this.root.dataset.fever=String(t>=4.2);
    const feverAge=t-4.2,hit=feverAge<0?0:feverAge<.96?Math.exp(-(feverAge%.16)*24)*.22:feverAge<1.2?0:Math.exp(-(feverAge-1.2)*5)*.65;
    style.setProperty('--fever-scale',String(reduce?1:1+Math.max(0,1-feverAge/.28)*1.3+hit));
    style.setProperty('--fever-jolt',`${reduce||feverAge<0?0:Math.sin(feverAge*140)*hit*24}px`);
    style.setProperty('--fever-glow',String(reduce?.1:hit));
    style.setProperty('--cutin-opacity',String(clamp(t/.12)*clamp((AWAKENING_CUTIN_SECONDS-t)/.55)));
    style.setProperty('--cutin-open',String(reduce?1:clamp(t/.75)));
    style.setProperty('--cutin-x',`${reduce?0:(1-clamp(t/.9))*35}%`);
    style.setProperty('--cutin-scale',String(reduce?1:1.2+(1-clamp((t-.65)/.8))*.24+t*.006));
    style.setProperty('--cutin-glow',String(reduce?.18:.25+Math.max(0,1-(t-.65)/.3)*.3));
    style.setProperty('--cutin-title-scale',String(reduce?1:1+Math.max(0,1-(t-1.45)/.28)*1.8));
    style.setProperty('--cutin-sweep',`${-50+t*31}%`);
    if(this.variant==='premium'){
      style.setProperty('--premium-cutin-scale',String(reduce?1:1.04+clamp(t/6)*.16+hit*.09));
      style.setProperty('--premium-cutin-angle',`${reduce?0:-3+clamp(t/1.4)*4+Math.sin(t*38)*hit}deg`);
      style.setProperty('--premium-cutin-hue',`${reduce?0:t*32}deg`);
    }
    if(this.variant==='kiss'){
      const age=Math.max(0,t-1.45),wave=clamp(age/2.5);
      style.setProperty('--kiss-close',String(reduce?1.08:1.08+clamp(t/1.45)*.16));
      style.setProperty('--kiss-burst',String(reduce?.72:wave));
      style.setProperty('--kiss-heart-opacity',String(t<1.45?0:reduce?.4:clamp(age/.15)*clamp((4.4-age)/.8)));
      style.setProperty('--kiss-ring',String(reduce?1:.2+wave*4));
      style.setProperty('--kiss-flash',String(reduce?0:Math.max(0,1-age/.5)*(t>=1.45?1:0)*.35));
    }
  }
}

export class DiagonalCutin {
  constructor(root,{reducedMotion=false,onBeat=()=>{}}={}){this.root=root;this.images=collectImages(root);this.reducedMotion=reducedMotion;this.onBeat=onBeat;this.active=false;this.elapsed=0;this.beaten=new Set();root.hidden=true;}
  start(kind){sceneImages(this.images,true);this.elapsed=0;this.active=true;this.beaten.clear();this.root.hidden=false;this.root.dataset.kind=kind;this.paint();}
  reset(){this.active=false;this.elapsed=0;this.root.hidden=true;sceneImages(this.images,false);}
  update(dt,{paused=false}={}){if(!this.active||paused)return this.active;this.elapsed+=Math.max(0,Math.min(.05,dt));if(this.elapsed>=3.4){this.reset();return false;}for(const at of [.32,.72,1.35])if(this.elapsed>=at&&!this.beaten.has(at)){this.beaten.add(at);this.onBeat(at);}this.paint();return true;}
  paint(){
    const t=this.elapsed,s=this.root.style,r=this.reducedMotion;
    s.setProperty('--diagonal-opacity',String(clamp(t/.1)*clamp((3.4-t)/.25)));
    const x=t<.4?115*(1-clamp(t/.4))**3:t>2.9?-110*clamp((t-2.9)/.5):0;
    s.setProperty('--diagonal-x',`${r?0:x}%`);s.setProperty('--diagonal-art-x',`${r?0:Math.max(0,1-t/.65)*55}%`);
    s.setProperty('--diagonal-title-scale',String(r?1:1+Math.max(0,1-(t-.72)/.35)*1.5));
    s.setProperty('--diagonal-title-opacity',String(clamp((t-.65)/.1)));
    s.setProperty('--diagonal-flash',String(r?0:Math.max(0,1-Math.abs(t-.32)/.2)*.8+Math.max(0,1-Math.abs(t-.75)/.15)*.6));
    s.setProperty('--diagonal-ring',String(r?1:.3+Math.max(0,t-.7)*2));
    s.setProperty('--diagonal-sweep',`${r?100:-120+t*100}%`);
    s.setProperty('--diagonal-jolt',`${r?0:Math.sin(t*70)*Math.max(0,1-(t-.72)/.5)*3*(t>=.72?1:0)}px`);
  }
}
