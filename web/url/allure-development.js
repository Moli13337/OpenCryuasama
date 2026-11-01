import {selectAsset} from './asset-variants-v47.js';
// Presentation-only continuation. The outcome remains the frozen hold's result.
export const ALLURE_DEVELOPMENT_START=21;
const artSource=(node,file)=>{if(file){const src=selectAsset(`assets/reaches/layered-v01/${file}`);if((node.getAttribute?.('src')??node.src)!==src)node.src=src;}else if(node.removeAttribute)node.removeAttribute('src');else delete node.src;};
export function allureDevelopmentState(elapsed){
  if(elapsed<21)return {stage:'base',reels:null,caption:null};
  if(elapsed<26)return {stage:'approach',reels:'hidden',caption:'その視線、逃がさない。'};
  if(elapsed<29)return {stage:'still',reels:'hidden',caption:'ガラスの向こうで、待ってる。'};
  if(elapsed<34)return {stage:'title',reels:'hidden',caption:''};
  if(elapsed<35.25)return {stage:'fracture',reels:'hidden',caption:''};
  if(elapsed<37)return {stage:'return',reels:'small',caption:''};
  return {stage:'resolve',reels:'settle',caption:elapsed<40?'こちらへ、おいで。':''};
}

export class AllureDevelopment{
  constructor(root,{reducedMotion=false,onBeat=()=>{}}={}){
    this.root=root;this.reducedMotion=reducedMotion;this.onBeat=onBeat;this.seen=new Set();
    const doc=root.ownerDocument;
    this.overlay=doc.createElement('div');this.overlay.className='allure-development';this.overlay.setAttribute('aria-hidden','true');this.overlay.hidden=true;
    this.panes=doc.createElement('div');this.panes.className='allure-development__panes';
    for(let i=0;i<3;i++){const pane=doc.createElement('i');pane.className='allure-development__pane';this.panes.append(pane);}
    this.glint=doc.createElement('i');this.glint.className='allure-development__glint';
    this.eyebrow=doc.createElement('small');this.eyebrow.className='allure-development__eyebrow';this.eyebrow.textContent='ここから、もう一段。';
    this.title=doc.createElement('img');this.title.decoding='async';this.title.className='allure-development__title';this.title.alt='×3';
    this.multiplier=doc.createElement('img');this.multiplier.decoding='async';this.multiplier.className='allure-development__multiplier';this.multiplier.alt='×2';this.multiplier.hidden=true;
    this.tier=doc.createElement('b');this.tier.className='allure-development__tier';this.tier.textContent='誘惑、さらに深く。';
    this.overlay.append(this.panes,this.glint,this.eyebrow,this.title,this.tier,this.multiplier);root.append(this.overlay);
    this.reset();
  }
  reset(){this.overlay.hidden=true;artSource(this.title,null);artSource(this.multiplier,null);this.root.dataset.allureDevelopment='none';this.seen.clear();}
  update(elapsed){
    const state=allureDevelopmentState(elapsed),stage=state.stage;
    artSource(this.multiplier,elapsed>=19&&elapsed<23.5?'allure-x2-green-v31.png':null);
    artSource(this.title,elapsed>=27&&elapsed<34?'allure-x3-red-v31.png':null);
    this.root.dataset.allureDevelopment=stage;
    this.multiplier.hidden=!(stage==='approach'&&elapsed<23.5);
    if(!this.multiplier.hidden)this.multiplier.style.transform=this.reducedMotion?'none':`scale(${1+Math.max(0,1-(elapsed-21)/.32)*1.5}) rotate(${-4+Math.sin(elapsed*19)*1.5}deg)`;
    this.overlay.hidden=stage==='base'||stage==='resolve';
    if(!this.overlay.hidden){
      this.overlay.dataset.stage=stage;
      const progress=stage==='approach'?(elapsed-21)/5:stage==='still'?(elapsed-26)/3:stage==='title'?(elapsed-29)/5:stage==='fracture'?(elapsed-34)/1.25:(elapsed-35.25)/1.75;
      this.overlay.style.setProperty('--allure-progress',String(Math.max(0,Math.min(1,progress))));
      this.overlay.style.setProperty('--allure-phase',String(elapsed));
      const titleAge=Math.max(0,elapsed-29);
      this.overlay.style.setProperty('--allure-title-scale',String(this.reducedMotion?1:1+Math.max(0,1-titleAge/.32)*.7+Math.exp(-(titleAge%.65)*12)*.035));
    }
    for(const [id,at,text] of [['veil',21,'接近'],['still',26,'溜め'],['title',29,'発展'],['fracture',34,'衝撃'],['return',35.25,'復帰'],['resolve',37,'結末']]){
      if(elapsed<at||this.seen.has(id))continue;
      this.seen.add(id);const lateness=elapsed-at;
      if(lateness<.25)this.onBeat({kind:'allure',text,at,elapsed,lateness,index:`allure-${id}`});
    }
    return state;
  }
}
