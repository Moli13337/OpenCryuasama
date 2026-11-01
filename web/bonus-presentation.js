import {selectAsset} from './asset-variants-v47.js';
/** LCD-only ordinary jackpot picture show. Audio and game results stay external. */
export const BONUS_CUT_SECONDS=3.6;
export const BONUS_MIN_IMAGE_SECONDS=3;
export const BONUS_ASSETS=Object.freeze(['room','invitation','full','beckon','point','gaze','heart','key-ready'].map(id=>Object.freeze({id,src:`./assets/reaches/layered-v01/pv-${id}-v02.webp`})));
const ASSETS=Object.fromEntries(BONUS_ASSETS.map(asset=>[asset.id,asset]));
const POSES={blessing:['invitation','beckon','full','invitation','gaze'],queen:['point','gaze','heart','key-ready','beckon','full']};
const clamp=n=>Math.max(0,Math.min(1,n));
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};

// One clock colors the illustration, background, physical field and frame.
export function queenBonusLight(time,reducedMotion=false){
  time=Math.max(0,finite(time));
  const palette=['#b789ff','#ff609e','#ffd47b','#78ffd6'];
  const color=palette[Math.floor(time/3.6)%palette.length];
  const beat=reducedMotion?.18:Math.exp(-(time%.72)*8);
  return {color,beat,field:reducedMotion?.10:.08+beat*.18,brightness:.76+beat*.24,time};
}

export function bonusFrame(input={}){
  const kind=input.kind==='queen'?'queen':'blessing';
  const round=Math.max(0,Math.floor(finite(input.round))),total=Math.max(1,Math.floor(finite(input.totalRounds,kind==='queen'?8:4)));
  const time=Math.max(0,finite(input.phaseElapsed)),still=Boolean(input.reducedMotion),sequence=POSES[kind];
  const cut=still?0:Math.floor(time/BONUS_CUT_SECONDS),index=(cut+Math.max(0,round-1))%sequence.length;
  const local=still?0:time%BONUS_CUT_SECONDS,move=still?0:smooth(local/BONUS_CUT_SECONDS),direction=round%2?1:-1;
  const duration=Math.max(.001,finite(input.roundDuration,12));
  const nextMode=input.nextMode==='rush'||input.nextMode==='challenge'?input.nextMode:kind==='queen'?'rush':null;
  return {kind,round,total,time,still,id:sequence[still?0:index],nextId:still?null:sequence[(index+1)%sequence.length],
    local,x:still?0:direction*(move-.5)*(kind==='queen'?11:4),y:still?0:Math.sin(local*(kind==='queen'?1.7:.85))*(kind==='queen'?2.8:1.1),scale:still?1.03:kind==='queen'?1.06+move*.15:1.04+move*.055,
    angle:still?0:direction*Math.sin(local*.9)*(kind==='queen'?2.2:.65),progress:round>0?clamp(finite(input.roundElapsed)/duration):0,
    ending:round>=total?(nextMode==='rush'?'RUSHへ':nextMode==='challenge'?'挑戦へ':'FINAL ROUND'):'BONUS TIME'};
}

export class BonusPresentation{
  constructor(root){
    this.root=root;root.classList.add('bonus-presentation');root.setAttribute('aria-hidden','true');root.hidden=true;
    this._active=false;this._tick=null;this._roundKey=null;this._clock=0;this._introAt=0;this._lastSwap=-Infinity;this._lastPayout=0;this._awardAt=-Infinity;this.lastFrame=null;
    const create=(tag,name,parent=root)=>{const node=root.ownerDocument.createElement(tag);node.className=`bonus-presentation__${name}`;if(parent)parent.append(node);return node;};
    const slot=(name,attached)=>{
      const node=create('img',name,attached?root:null);node.alt='';node.draggable=false;node.decoding='async';node.hidden=true;
      return {node,id:null,loaded:false,version:0,cancel:null};
    };
    this.room=slot('room',true);this.front=slot('actor',true);this.spare=slot('actor',false);
    this.halo=create('div','halo');this.rays=create('div','rays');this.sweep=create('div','sweep');this.energy=create('div','energy');create('div','frame');create('div','shade');
    this.small=create('div','small-round');this.smallLabel=create('span','small-label',this.small);this.smallLabel.textContent='ROUND';
    this.smallNumber=create('b','small-number',this.small);this.smallTotal=create('span','small-total',this.small);
    this.hero=create('div','round-intro');this.heroLabel=create('span','round-label',this.hero);this.heroLabel.textContent='ROUND';
    this.heroNumber=create('b','round-number',this.hero);
    this.title=create('div','title');this.ending=create('div','ending');
    this.progress=create('div','progress');this.progressFill=create('i','progress-fill',this.progress);
    this._styles=new WeakMap();this.mobile=root.ownerDocument.documentElement?.dataset.renderQuality==='mobile';this.lowLoad=root.ownerDocument.documentElement?.dataset.qualityPreset==='light';
  }

  _style(node,key,value){
    let cached=this._styles.get(node);if(!cached){cached=new Map();this._styles.set(node,cached);}
    if(cached.get(key)===value)return;cached.set(key,value);
    if(key.startsWith('--'))node.style.setProperty(key,value);else node.style[key]=value;
  }
  _text(node,value){if(node.textContent!==value)node.textContent=value;}

  _load(slot,id){
    if(slot.id===id)return;
    slot.cancel?.();slot.id=id;slot.loaded=false;const version=++slot.version;
    const image=slot.node;let settled=false;
    const finish=ok=>{
      if(settled)return;settled=true;
      if(slot.version===version){slot.loaded=ok;image.onload=image.onerror=null;slot.cancel=null;}
    };
    const decoded=()=>{
      if(typeof image.decode!=='function'){finish(true);return;}
      try{image.decode().then(()=>finish(true),()=>finish(false));}catch{finish(false);}
    };
    slot.cancel=()=>finish(false);image.onload=decoded;image.onerror=()=>finish(false);image.src=selectAsset(ASSETS[id].src,this.root.ownerDocument);
    if(typeof image.decode==='function'){
      try{image.decode().then(()=>finish(true),()=>{if(image.complete)finish(image.naturalWidth>0);});}
      catch{if(image.complete)finish(image.naturalWidth>0);}
    }else if(image.complete)finish(image.naturalWidth>0);
  }

  prepare(kind){
    if(this._active||!POSES[kind])return;
    this._preparedKind=kind;this._load(this.room,'room');this._load(this.front,POSES[kind][0]);
  }

  _release(slot){
    slot.cancel?.();slot.version++;slot.loaded=false;slot.id=null;slot.cancel=null;
    slot.node.onload=slot.node.onerror=null;slot.node.hidden=true;slot.node.removeAttribute('src');
    if(slot.node.style.transform)slot.node.style.transform='';this._styles.delete(slot.node);
  }

  _select(frame){
    if(!this.front.id)this._load(this.front,frame.id);
    if(this.front.id!==frame.id){
      this._load(this.spare,frame.id);
      if(this.spare.loaded&&(frame.time-this._lastSwap>=BONUS_MIN_IMAGE_SECONDS||!this.front.loaded)){
        this.root.replaceChild(this.spare.node,this.front.node);[this.front,this.spare]=[this.spare,this.front];
        this._lastSwap=frame.time;
      }
    }
    if(this.front.loaded&&this._lastSwap===-Infinity)this._lastSwap=frame.time;
    // One upcoming character is prepared, never a cache of all decoded poses.
    if(this.front.id===frame.id&&this.front.loaded&&frame.nextId&&frame.nextId!==this.front.id)this._load(this.spare,frame.nextId);
    if(this.room.node.hidden===this.room.loaded)this.room.node.hidden=!this.room.loaded;if(this.front.node.hidden===this.front.loaded)this.front.node.hidden=!this.front.loaded;
  }

  update(input={}){
    if(!input.active||!['blessing','queen'].includes(input.kind)||!Number.isFinite(input.phaseElapsed)){this.stop();return false;}
    if(input.paused)return this._active&&!this.root.hidden;
    const clock=Math.max(0,input.phaseElapsed),tick=Math.floor(clock*30+1e-7);
    if(!this._active||this._kind!==input.kind||clock+1e-7<this._clock){
      if(this._preparedKind!==input.kind)this.reset();
      this._preparedKind=null;this._active=true;this._kind=input.kind;
      this._load(this.room,'room');this._introAt=clock-Math.max(0,finite(input.roundElapsed));
    }
    const frame=bonusFrame({...input,phaseElapsed:tick/30}),roundKey=`${frame.kind}:${frame.round}:${frame.total}`;
    const flags=`${roundKey}:${frame.still}:${input.nextMode??''}`;
    if(this._tick===tick&&this._flags===flags)return true;
    this._tick=tick;this._flags=flags;this._clock=clock;
    if(this._roundKey!==roundKey){this._roundKey=roundKey;this._introAt=clock-Math.max(0,finite(input.roundElapsed));}
    const payout=Math.max(0,finite(input.payout));
    if(payout>this._lastPayout)this._awardAt=clock;this._lastPayout=payout;
    this._select(frame);if(this.root.hidden)this.root.hidden=false;
    for(const [key,value] of Object.entries({kind:frame.kind,reduced:String(frame.still),pose:this.front.loaded?this.front.id:''}))if(this.root.dataset[key]!==value)this.root.dataset[key]=value;
    const introAge=Math.max(0,clock-this._introAt),intro=frame.round>0?clamp((.8-introAge)/.22):0;
    const impact=frame.still?0:Math.exp(-introAge*8);
    this._text(this.smallNumber,frame.round?String(frame.round).padStart(2,'0'):'—');this._text(this.smallTotal,` / ${frame.total}`);
    this._text(this.heroNumber,String(frame.round).padStart(2,'0'));
    this._text(this.title,frame.kind==='queen'?'女王降臨 BONUS':'祝福 BONUS');this._text(this.ending,frame.ending);
    this._style(this.hero,'opacity',String(frame.still?0:intro));
    this._style(this.hero,'transform',`translateY(${(-impact*12).toFixed(2)}%) scale(${(1+impact*.6).toFixed(3)}) rotate(${(-impact*4).toFixed(2)}deg)`);
    this._style(this.front.node,'transform',`translate3d(${frame.x.toFixed(2)}%,${frame.y.toFixed(2)}%,0) rotate(${frame.angle.toFixed(2)}deg) scale(${frame.scale.toFixed(3)})`);
    this._style(this.room.node,'transform',`scale(${frame.still?1.08:1.10+Math.sin(clock*.13)*.025})`);
    this._style(this.progressFill,'transform',`scaleX(${frame.progress.toFixed(4)})`);
    // Only the palette crosses the scene tree (once per 3.6 s). Moving
    // decoration variables stay on their consumers, away from round text.
    if(frame.kind==='queen'){
      const queen=queenBonusLight(clock,frame.still);
      this._style(this.root,'--queen-color',queen.color);
      if(!this.lowLoad&&(!frame.still||this.mobile))this._style(this.front.node,'--queen-beat',String(queen.beat));
      this._style(this.halo,'--queen-beat',String(queen.beat));this._style(this.halo,'--queen-turn',`${frame.still?0:clock*24}deg`);
      if(!frame.still){
        for(const node of this.lowLoad?[this.halo,this.rays]:[this.halo,this.rays,this.energy,this.front.node])this._style(node,'--queen-beat',String(queen.beat));
        for(const node of this.lowLoad?[this.halo,this.rays]:[this.halo,this.rays,this.energy])this._style(node,'--queen-turn',`${clock*24}deg`);
        this._style(this.sweep,'--queen-flight',`${-80+(clock%1.8)/1.8*160}%`);
      }
    }else if(!frame.still){
      for(const node of [this.halo,this.rays])this._style(node,'--bonus-orbit',`${(clock*9).toFixed(2)}deg`);
      this._style(this.sweep,'--bonus-sweep',`${(-130+(clock%6)/6*280).toFixed(2)}%`);
      this._style(this.rays,'--bonus-light',String(.2+Math.sin(clock*1.5)**2*.14+Math.exp(-(clock-this._awardAt)*6)*.24));
    }
    this.lastFrame=frame;
    return true;
  }

  stop(){
    if(!this._active&&this.root.hidden)return;
    const release=this.mobile&&this._active;
    this.root.hidden=true;this._active=false;this._tick=null;this.lastFrame=null;
    // Preserve pre-entry prepare(), but release sources after an actual run.
    if(release){
      for(const slot of [this.room,this.front,this.spare])this._release(slot);
      this._preparedKind=null;this._roundKey=null;this._lastSwap=-Infinity;delete this.root.dataset.pose;
    }
  }
  reset(){
    this.stop();this._preparedKind=null;this._roundKey=null;this._clock=0;this._lastSwap=-Infinity;this._lastPayout=0;this._awardAt=-Infinity;
    for(const slot of [this.room,this.front,this.spare])this._release(slot);
    delete this.root.dataset.pose;
  }
}
