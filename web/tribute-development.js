import {selectAsset} from './asset-variants-v47.js';
// Long tribute scenes are presentation only: the engine owns the frozen result.
const ASSETS='assets/reaches/layered-v01/';
export const TRIBUTE_TEXT_ART=Object.freeze({
  'その想いはまだ終わらない':'assets/reaches/layered-v01/tribute-text-linger-v42.webp',
  'お貢ぎPUSH':'assets/reaches/layered-v01/tribute-text-push-v42.webp',
  'もっとお貢ぎ♡':'assets/reaches/layered-v01/tribute-text-more-v42.webp',
  '腰突き出して':'assets/reaches/layered-v01/tribute-text-green-first-v42.webp',
  'バカみたいだよ♡':'assets/reaches/layered-v01/tribute-text-green-second-v42.webp',
  '雑な色仕掛けなのに':'assets/reaches/layered-v01/tribute-text-red-first-v42.webp',
  'マゾってかわいそう♡':'assets/reaches/layered-v01/tribute-text-red-second-v42.webp',
  'さらにその先へ':'assets/reaches/layered-v01/tribute-text-further-v42.webp',
  '破産までお貢ぎ♡':'assets/reaches/layered-v01/tribute-text-bankrupt-v42.webp',
});
const artSource=(node,file)=>{if(file){const src=selectAsset(`${ASSETS}${file}`);if((node.getAttribute?.('src')??node.src)!==src)node.src=src;}else if(node.removeAttribute)node.removeAttribute('src');else delete node.src;};
const clamp=value=>Math.max(0,Math.min(1,value));
const style=(node,key,value)=>{if(node.style[key]!==value)node.style[key]=value;};
const hidden=(node,value)=>{if(node.hidden!==value)node.hidden=value;};
const data=(node,key,value)=>{if(node.dataset[key]!==value)node.dataset[key]=value;};
const property=(node,key,value)=>{if(node.style.getPropertyValue?.(key)!==value)node.style.setProperty(key,value);};
// A supplied scene clock owns these cuts, including restored and paused scenes.
// Short black intervals separate changes in framing; text never scales in place.
export function tributeBranchFrame(elapsed,branch,{reducedMotion=false}={}){
  if(!['green','red'].includes(branch)||elapsed<30||elapsed>=42)return null;
  const time=elapsed-30,cut=time<3.2?'wide':time<7.8?'close':'return';
  const start=cut==='wide'?0:cut==='close'?3.2:7.8,end=cut==='wide'?3.2:cut==='close'?7.8:12;
  const age=time-start,progress=clamp(age/(end-start));
  const actorOpacity=clamp(age/.2)*clamp((end-time)/.18);
  const scale=reducedMotion?1:cut==='wide'?1.035+progress*.055:cut==='close'?1.20+progress*.065:1.10-progress*.055;
  const x=reducedMotion?0:cut==='close'?-2.5+progress*3.5:(progress-.5)*2;
  const y=reducedMotion?0:cut==='close'?3.5-progress*1.5:progress*.6;
  const first=branch==='green'?'腰突き出して':'雑な色仕掛けなのに',second=branch==='green'?'バカみたいだよ♡':'マゾってかわいそう♡';
  const textCue=time>=.8&&time<3.05?{start:.8,end:3.05,lines:[first]}:time>=4&&time<7.65?{start:4,end:7.65,lines:[second]}:time>=8.4?{start:8.4,end:12,lines:[first,second]}:null;
  const textAge=textCue?time-textCue.start:0;
  const textOpacity=textCue?clamp(textAge/.12)*clamp((textCue.end-time)/.2):0;
  const lineMotion=reducedMotion?0:(1-clamp(textAge/.24))*18;
  return {cut,actorOpacity,scale,x,y,lines:textCue?.lines??[],textOpacity,lineMotion};
}
export const TRIBUTE_STAGES=Object.freeze([
  {at:0,stage:'opening',lines:[]},
  {at:4,stage:'title',lines:[]},
  {at:10,stage:'linger',lines:['その想いはまだ終わらない']},
  {at:18,stage:'show',lines:['お貢ぎPUSH']},
  {at:24,stage:'more',lines:['もっとお貢ぎ♡']},
  {at:30,stage:'branch',lines:[]},
  {at:42,stage:'further',lines:['さらにその先へ']},
  {at:48,stage:'bankrupt',lines:['破産までお貢ぎ♡']},
  {at:54,stage:'ending',lines:[]},
]);
export function tributeDevelopmentState(elapsed,branch,win){
  if(!['green','red'].includes(branch))return null;
  let cue=TRIBUTE_STAGES[0];for(let i=TRIBUTE_STAGES.length-1;i>=0;i--)if(elapsed>=TRIBUTE_STAGES[i].at){cue=TRIBUTE_STAGES[i];break;}
  const lines=cue.stage==='branch'?(branch==='green'?['腰突き出してバカみたいだよ♡']:['雑な色仕掛けなのに','マゾってかわいそう♡'])
    :cue.lines;
  const art=cue.stage==='title'?'temptation-heart-v01.webp':cue.stage==='branch'?(branch==='green'?'tribute-branch-phone-v01.png':'tribute-branch-lingerie-v01.png')
    :cue.stage==='ending'&&win?'tribute-branch-confirm-v01.png':null;
  return {stage:cue.stage,lines,art,branch,win:win===true,reels:'hidden'};
}
export class TributeDevelopment{
  constructor(root,{onBeat=()=>{},reducedMotion=false}={}){
    this.root=root;this.onBeat=onBeat;this.reducedMotion=reducedMotion;this.pushCount=0;
    const doc=root.ownerDocument;this.lowLoad=doc.documentElement?.dataset?.qualityPreset==='light';
    this.overlay=doc.createElement('div');this.overlay.className='tribute-development';this.overlay.setAttribute('aria-hidden','true');this.overlay.hidden=true;
    this.backdrop=doc.createElement('div');this.backdrop.className='tribute-development__backdrop';
    this.actor=doc.createElement('div');this.actor.className='tribute-development__actor';
    this.art=doc.createElement('img');this.art.decoding='async';this.art.className='tribute-development__art';this.art.alt='';
    this.qr=doc.createElement('img');this.qr.decoding='async';this.qr.className='tribute-development__qr';this.qr.alt='';
    this.title=doc.createElement('img');this.title.decoding='async';this.title.className='tribute-development__title';this.title.alt='';
    this.line1=doc.createElement('b');this.line1.className='tribute-development__line tribute-development__line--1';
    this.line2=doc.createElement('b');this.line2.className='tribute-development__line tribute-development__line--2';
    this.lineImages=[this.line1,this.line2].map(line=>{const image=doc.createElement('img');image.className='tribute-development__word-art';image.decoding='async';image.alt='';image.draggable=false;line.dataset.generated='true';line.append(image);return image;});
    this.actor.append(this.art,this.qr);this.overlay.append(this.backdrop,this.actor,this.title,this.line1,this.line2);root.append(this.overlay);
    this.reset();
  }
  reset(){this.overlay.hidden=true;for(const node of [this.art,this.qr,this.title,...this.lineImages])artSource(node,null);this.root.dataset.tributeDevelopment='none';this.lastStage=null;this.pushCount=0;this.pushAt=null;delete this.overlay.dataset.branchCut;for(const node of [this.overlay,this.backdrop,this.actor,this.line1,this.line2]){style(node,'transform','');style(node,'opacity','');}this.overlay.dataset.pushCount='0';this.line1.style.setProperty('--tribute-push-scale','1');this.overlay.style.setProperty('--tribute-push-flash','0');}
  push(elapsed){
    if(this.overlay.hidden||this.overlay.dataset.stage!=='show'||elapsed<18||elapsed>=24)return false;
    this.pushCount++;this.pushAt=elapsed;this.overlay.dataset.pushCount=String(this.pushCount);
    return true;
  }
  update(elapsed,branch,win){
    const state=tributeDevelopmentState(elapsed,branch,win);
    if(!state||elapsed>=60){this.reset();return null;}
    // The opening uses the original ImageGen ImpactTitles behind this overlay.
    const covered=state.stage==='opening';if(this.overlay.hidden!==covered)this.overlay.hidden=covered;
    data(this.overlay,'stage',state.stage);data(this.overlay,'branch',state.branch);data(this.overlay,'win',String(state.win));
    data(this.root,'tributeDevelopment',state.stage);
    const hit=this.pushAt===null?0:Math.max(0,1-(elapsed-this.pushAt)/.45);
    property(this.line1,'--tribute-push-scale',String(this.reducedMotion?1:1+hit*.18));
    property(this.overlay,'--tribute-push-flash',String(hit));
    // One bounded backdrop: change its paint only at scene cuts, then move
    // the already-painted layer. The same game clock also freezes on pause.
    const age=Math.max(0,elapsed-(TRIBUTE_STAGES.find(cue=>cue.stage===state.stage)?.at??0));
    const scenery=this.lowLoad||this.reducedMotion?'none':state.stage==='linger'?`translate(${(Math.sin(age*.7)*2).toFixed(2)}%,${(Math.cos(age*.5)*1.5).toFixed(2)}%) scale(1.025)`
      :state.stage==='show'?`scale(${(1.015+Math.pow(Math.sin(age*2.1),2)*.045).toFixed(3)})`
      :state.stage==='more'?`translate(${(Math.sin(age*1.25)*2.5).toFixed(2)}%,${(Math.cos(age*.9)*1.5).toFixed(2)}%) scale(1.04)`:'none';
    style(this.backdrop,'transform',scenery);
    if(state.stage==='ending'&&win&&!this.reducedMotion){
      const envelope=clamp(age/.25)*clamp((6-age)/.35),pulse=.35+.65*Math.pow(Math.sin(age*6),2);
      const amount=envelope*pulse;
      style(this.overlay,'transform',`translate(${(Math.sin(age*71)*amount*1.1).toFixed(3)}%,${(Math.cos(age*89)*amount*.8).toFixed(3)}%) scale(1.035)`);
    }else style(this.overlay,'transform','');
    hidden(this.art,!state.art);
    const upcoming=elapsed>=2&&elapsed<4?'temptation-heart-v01.webp':elapsed>=28&&elapsed<30?(branch==='green'?'tribute-branch-phone-v01.png':'tribute-branch-lingerie-v01.png'):elapsed>=52&&elapsed<54&&win?'tribute-branch-confirm-v01.png':null;
    artSource(this.art,state.art||upcoming);
    artSource(this.qr,branch==='green'&&elapsed>=28&&elapsed<42?'tribute-branch-qr-v01.png':null);
    artSource(this.title,elapsed>=2&&elapsed<10?'tribute-title-yellow-red-v01.png':null);
    hidden(this.qr,!(state.stage==='branch'&&branch==='green'));
    hidden(this.title,state.stage!=='title');
    const frame=tributeBranchFrame(elapsed,branch,{reducedMotion:this.reducedMotion}),lines=frame?.lines??state.lines;
    if(frame){
      data(this.overlay,'branchCut',frame.cut);
      style(this.actor,'transform',`translate(${frame.x.toFixed(3)}%,${frame.y.toFixed(3)}%) scale(${frame.scale.toFixed(4)})`);
      style(this.actor,'opacity',frame.actorOpacity.toFixed(3));
    }else{delete this.overlay.dataset.branchCut;style(this.actor,'transform','');style(this.actor,'opacity','');}
    for(const [index,node] of [this.line1,this.line2].entries()){
      const value=lines[index]??'',image=this.lineImages[index],src=selectAsset(TRIBUTE_TEXT_ART[value]);
      // Keep a zero-size text fallback and exact alt; only the two visible
      // image slots own sources. No preload cache of the generated words.
      if(node.textContent!==value){node.textContent=value;node.append(image);}
      if(image.alt!==value)image.alt=value;
      if(src){if((image.getAttribute?.('src')??image.src)!==src)image.src=src;}else artSource(image,null);
      hidden(node,!value);style(node,'opacity',frame?frame.textOpacity.toFixed(3):'');
      style(node,'transform',frame?`translateX(${((index?-1:1)*frame.lineMotion).toFixed(2)}%)`:'');
    }
    if(state.stage!==this.lastStage){
      this.lastStage=state.stage;
      const cue=TRIBUTE_STAGES.find(item=>item.stage===state.stage),lateness=elapsed-cue.at;
      if(lateness<.25)this.onBeat({kind:'tribute',text:state.lines[0]||state.stage,at:cue.at,elapsed,lateness,index:`tribute-development-${state.stage}`});
    }
    return state;
  }
}
