import {selectAsset} from './asset-variants-v47.js';
// ImageGen numerals share the same full-image fit while stopped and in motion.
const COLORS = ['#2583ff','#edf7ff','#ff9424','#34d258','#f13b3e','#ed4bb7','#ffcb28','#2bd8e9','#ab5bff'];
const ATLAS=selectAsset('assets/numerals-brush-v03.png');
const NS='http://www.w3.org/2000/svg';
const regions=[
 {box:[0,0,424,418],path:'M0 0H424V418H0Z'},
 {box:[424,0,418,418],path:'M424 0H842V418H424Z'},
 {box:[842,0,412,418],path:'M842 0H1254V418H842Z'},
 {box:[0,418,434,427],path:'M0 418H434V804L243 812 198 845H0Z'},
 {box:[430,418,412,420],path:'M430 418H842V838H430Z'},
 {box:[842,418,412,424],path:'M842 418H1254V842H842Z'},
 {box:[0,806,485,448],path:'M0 845H198L243 812 485 806V924L430 1070 421 1254H0Z'},
 {box:[421,838,421,416],path:'M485 838H842V1254H421L430 1070 485 924Z'},
 {box:[842,842,412,412],path:'M842 842H1254V1254H842Z'}
];
let sequence=0;
const symbolRecords=new WeakMap();
const preload=typeof Image==='undefined'?null:new Image();
if(preload)preload.src=ATLAS;
const ready=preload?preload.decode().then(()=>true).catch(()=>false):Promise.resolve(false);
export function createSymbol(value,document=globalThis.document) {
  const frame=document.createElement('span');frame.className='symbol-frame';frame.dataset.value=value;
  frame.style.setProperty('--symbol-color',COLORS[value-1]);
  const fallback=document.createElement('span');fallback.className='symbol-fallback';fallback.textContent=value;
  const svg=document.createElementNS(NS,'svg');svg.classList.add('symbol-art');
  const region=regions[value-1],b=region.box,pad=9;
  svg.setAttribute('viewBox',`${b[0]-pad} ${b[1]-pad} ${b[2]+pad*2} ${b[3]+pad*2}`);
  svg.setAttribute('aria-hidden','true');
  const id=`glyph-clip-${++sequence}`;
  svg.innerHTML=`<defs><clipPath id="${id}"><path d="${region.path}"/></clipPath></defs><image href="${ATLAS}" x="0" y="0" width="1254" height="1254" clip-path="url(#${id})"/>`;
  frame.append(fallback,svg);symbolRecords.set(frame,{fallback,svg,path:svg.querySelector?.('path')});ready.then(ok=>{if(ok)frame.classList.add('art-ready');});
  return frame;
}

// Preserve SVG identity (and clip IDs) while the displayed value changes.
function updateSymbol(frame,value){
  if(Number(frame.dataset.value)===value)return;
  const record=symbolRecords.get(frame),region=regions[value-1],b=region.box,pad=9;
  frame.dataset.value=value;frame.style.setProperty('--symbol-color',COLORS[value-1]);
  record.fallback.textContent=value;
  record.svg.setAttribute('viewBox',`${b[0]-pad} ${b[1]-pad} ${b[2]+pad*2} ${b[3]+pad*2}`);
  record.path.setAttribute('d',region.path);
}

export function createReels(root, initialValues = [3, 5, 1]) {
  const doc=root.ownerDocument??globalThis.document,view=doc.defaultView??globalThis;
  const mobile=doc.documentElement?.dataset.renderQuality==='mobile'&&typeof view.Path2D==='function';
  const reducedMotion=view.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const paths=mobile?regions.map(region=>new view.Path2D(region.path)):null;
  const records=initialValues.map((value,column)=>{
    const reel=doc.createElement('div');reel.className='reel';
    const record={reel,value,stopped:true,dirty:true,position:column*3,width:0,height:0};
    if(mobile){
      const canvas=doc.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:true});
      if(ctx){
        canvas.className='reel-canvas symbol-art';canvas.setAttribute('aria-hidden','true');
        canvas.width=1;canvas.height=1;reel.dataset.reelRenderer='canvas';reel.append(canvas);
        Object.assign(record,{canvas,ctx});
      }
    }
    if(!record.canvas){
      const settled=doc.createElement('div');settled.className='settled';
      const symbol=createSymbol(value,doc);settled.append(symbol);
      reel.append(settled);record.symbol=symbol;
      if(!mobile){
        const strip=doc.createElement('div');strip.className='symbols';strip.setAttribute('aria-hidden','true');
        for(let i=0;i<=9;i++)strip.append(createSymbol((i+column*3)%9+1,doc));
        reel.append(strip);
      }else reel.dataset.reelRenderer='static';
    }
    return record;
  });
  root.replaceChildren(...records.map(record=>record.reel));
  const machine=root.closest?.('.machine'),lcd=root.closest?.('.lcd');
  function sizeCanvas(record,width,height){
    if(!record.canvas||width<=0||height<=0)return;
    // Three view-sized buffers, never a ten-symbol strip or an atlas per cell.
    const density=Math.min(view.devicePixelRatio||1,doc.documentElement?.dataset.qualityPreset==='light'?1:2,768/width,768/height,Math.sqrt(196608/(width*height)));
    const w=Math.max(1,Math.floor(width*density)),h=Math.max(1,Math.floor(height*density));
    if(record.canvas.width!==w||record.canvas.height!==h){record.canvas.width=w;record.canvas.height=h;record.dirty=true;}
    record.width=w;record.height=h;
  }
  const observer=mobile&&typeof view.ResizeObserver==='function'?new view.ResizeObserver(entries=>{
    for(const entry of entries){const record=records.find(item=>item.reel===entry.target);if(record)sizeCanvas(record,entry.contentRect.width,entry.contentRect.height);}
  }):null;
  for(const record of records)if(record.canvas){observer?.observe(record.reel);sizeCanvas(record,record.reel.clientWidth,record.reel.clientHeight);}
  let atlasReady=false;ready.then(ok=>{atlasReady=ok;for(const record of records)record.dirty=true;});
  function drawSymbol(record,value,y){
    const {ctx,width,height}=record,region=regions[value-1],b=region.box,pad=9;
    if(!atlasReady){ctx.font=`900 ${Math.min(width*.8,height*.8)}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=COLORS[value-1];ctx.fillText(String(value),width/2,y+height/2);return;}
    const scale=Math.min(width/(b[2]+pad*2),height/(b[3]+pad*2));
    ctx.save();ctx.translate((width-(b[2]+pad*2)*scale)/2-(b[0]-pad)*scale,y+(height-(b[3]+pad*2)*scale)/2-(b[1]-pad)*scale);ctx.scale(scale,scale);
    ctx.clip(paths[value-1]);ctx.drawImage(preload,0,0,1254,1254);ctx.restore();
  }
  let previous=[],lastTime=null,disposed=false;
  const update=(values,stopped=[true,true,true],options={})=>{
    if(disposed)return;
    const now=Number.isFinite(options.time)?options.time:(view.performance?.now?.()??Date.now())/1000;
    const paused=options.paused??machine?.dataset.paused==='true';
    const visible=options.visible!==false;
    const dt=lastTime===null||paused?0:Math.max(0,Math.min(.1,now-lastTime));lastTime=now;
    const phase=options.phase??(lcd?.classList.contains('phase-reach')?'reach':'spin');
    records.forEach((record,index)=>{
      const value=values[index],stop=stopped[index]!==false,changed=value!==record.value||stop!==record.stopped;
      if(stop!==record.stopped)record.reel.classList.toggle('spinning',!stop);
      if(value!==record.value||previous.length===0){
        if(record.symbol)updateSymbol(record.symbol,value);
        record.reel.setAttribute('aria-label',`${index+1}列目 ${value}`);
      }
      if(record.canvas){
        if(!observer)sizeCanvas(record,record.reel.clientWidth,record.reel.clientHeight);
        if(!stop&&!paused){const duration=reducedMotion?1.8:phase==='reach'&&index===1?1.35:[.72,.63,.81][index];record.position=(record.position+dt*9/duration)%9;}
        if(!visible)record.dirty=true;
        if(visible&&record.width>0&&record.height>0&&(record.dirty||changed||(!stop&&!paused))){
          record.ctx.clearRect(0,0,record.width,record.height);
          if(stop)drawSymbol(record,value,0);
          else{
            const whole=Math.floor(record.position),fraction=record.position-whole;
            drawSymbol(record,whole%9+1,-fraction*record.height);
            drawSymbol(record,(whole+1)%9+1,(1-fraction)*record.height);
          }
          record.dirty=false;
        }
        if(changed||previous.length===0)record.canvas.dataset.value=String(value);
      }
      record.value=value;record.stopped=stop;
    });
    if(values.some((value,index)=>value!==previous[index]))root.setAttribute('aria-label',`図柄 ${values.join('・')}`);
    previous=[...values];
  };
  update.dispose=()=>{disposed=true;observer?.disconnect();for(const record of records)if(record.canvas){record.canvas.width=1;record.canvas.height=1;}};
  update(initialValues);
  return update;
}
