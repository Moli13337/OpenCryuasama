// Run-persistent purchases. Shop/color streams never draw from game physics
// or outcome RNG; a saved offer is a transaction, not just a product name.
export const RELIC_CATALOG = Object.freeze(Object.fromEntries([
  ['fortune','運命の瞳','確率',2000,'新しい保留の当選確率 ×1.2'],
  ['bonus_double','倍神の祝印','玉価値',5000,'これから受け入れる保留の全 BONUS ×2'],
  ['ball_value','貢玉の加護','玉価値',2000,'これから発射する玉の実入賞賞球 ×1.5'],
  ['blue_rate','蒼玉の祈り','色玉',2000,'青玉の出現率 +5%'],
  ['gold_rate','黄金の誘惑','色玉',3500,'金玉の出現率 +1%'],
  ['rainbow_rate','虹彩の覚醒','色玉',7000,'虹玉の出現率 +0.2%'],
  ['chain_one','連契の印','連チャン',4000,'次に受け入れる右保留 1 回を大当たり保証'],
  ['chain_three','三連の誓い','連チャン',9000,'次に受け入れる右保留 3 回を大当たり保証'],
].map(([id,name,category,basePrice,description])=>[id,Object.freeze({id,name,category,basePrice,description})])));
const IDS=Object.keys(RELIC_CATALOG);
const MAX=Number.MAX_SAFE_INTEGER;
const integer=(n)=>Number.isSafeInteger(n)&&n>=0;
const copy=(value)=>JSON.parse(JSON.stringify(value));
const doubled=(base,count)=>Math.min(MAX,base*2**count);
const safeGrowth=p=>Number.isSafeInteger(10000*2**p.bonus_double)
  &&Number.isSafeInteger(Math.floor(100*2**p.bonus_double*1.5**p.ball_value));

export function relicQuota(epoch){
  if(epoch===0)return 0;
  if(epoch===1)return 30;
  if(epoch===2)return 55;
  if(epoch===3)return 90;
  return epoch<10?140+(epoch-4)*50:Math.min(MAX,Math.round(520*1.3**(epoch-10)));
}

export class RelicSystem {
  constructor({seed=20260916,state}={}){
    this.purchases=Object.fromEntries(IDS.map(id=>[id,0]));
    this.guaranteedWins=0;this.epoch=0;this.rerollCount=0;
    this.shopRng=((Number(seed)>>>0)^0x9e3779b9)>>>0;
    this.colorRng=((Number(seed)>>>0)^0xa5b35705)>>>0;
    this.offers=[];this._fill();
    if(state&&!this.importState(state))throw new TypeError('Invalid relic state');
  }

  _random(stream){
    let value=this[stream]=(this[stream]+0x6D2B79F5)>>>0;
    value=Math.imul(value^value>>>15,value|1);
    value^=value+Math.imul(value^value>>>7,value|61);
    return ((value^value>>>14)>>>0)/4294967296;
  }

  price(id){return Object.hasOwn(RELIC_CATALOG,id)?doubled(RELIC_CATALOG[id].basePrice,this.purchases[id]):null;}
  get rerollCost(){return doubled(3000,this.rerollCount);}

  _fill(){
    const pool=[...IDS];
    this.offers=Array.from({length:3},(_,slot)=>{
      const id=pool.splice(Math.floor(this._random('shopRng')*pool.length),1)[0];
      return {offerId:`${this.epoch}:${this.rerollCount}:${slot}`,id,price:this.price(id),sold:false};
    });
  }

  summary({normalOdds=1/99.9,specialOdds=1/7.4}={}){
    const p=this.purchases;
    // Retain at least 20% silver; rare high-value colors keep priority.
    const rainbow=Math.min(.8,p.rainbow_rate*.002);
    const gold=Math.min(.8-rainbow,p.gold_rate*.01);
    const blue=Math.min(Math.max(0,.8-rainbow-gold),p.blue_rate*.05);
    return {normalOdds:Math.min(.5,normalOdds*1.2**p.fortune),specialOdds:Math.min(.8,specialOdds*1.2**p.fortune),
      bonusMultiplier:Math.min(MAX,2**p.bonus_double),ballValueMultiplier:Math.min(MAX,1.5**p.ball_value),
      guaranteedWins:this.guaranteedWins,colorRates:{silver:1-blue-gold-rainbow,blue,gold,rainbow},purchases:{...p}};
  }

  getShop(stock,odds){
    const valid=integer(stock);
    return {epoch:this.epoch,quota:relicQuota(this.epoch),rerollCost:this.rerollCost,
      canReroll:valid&&stock>=this.rerollCost&&this.rerollCost<MAX,
      offers:this.offers.map(offer=>({...RELIC_CATALOG[offer.id],...offer,purchases:this.purchases[offer.id],
        affordable:!offer.sold&&valid&&stock>=offer.price&&offer.price<MAX})),summary:this.summary(odds),stock};
  }

  quote(offerId,stock){
    const offer=this.offers.find(item=>item.offerId===offerId);
    if(!offer)return {ok:false,reason:'stale-offer',stock};
    if(offer.sold)return {ok:false,reason:'sold',stock};
    if(!integer(stock))return {ok:false,reason:'invalid-stock',stock};
    if(offer.price>=MAX)return {ok:false,reason:'limit',stock};
    if(stock<offer.price)return {ok:false,reason:'insufficient-stock',cost:offer.price,stock};
    return {ok:true,offerId,id:offer.id,cost:offer.price,stock:stock-offer.price};
  }

  buy(offerId,stock){
    const result=this.quote(offerId,stock);if(!result.ok)return result;
    const count=result.id==='chain_one'?1:result.id==='chain_three'?3:0;
    if(this.guaranteedWins>MAX-count||!safeGrowth({...this.purchases,[result.id]:this.purchases[result.id]+1}))return {ok:false,reason:'limit',stock};
    this.offers.find(item=>item.offerId===offerId).sold=true;
    this.purchases[result.id]++;this.guaranteedWins+=count;
    return {...result,summary:this.summary()};
  }

  reroll(stock){
    const cost=this.rerollCost;
    if(!integer(stock))return {ok:false,reason:'invalid-stock',stock};
    if(cost>=MAX)return {ok:false,reason:'limit',stock};
    if(stock<cost)return {ok:false,reason:'insufficient-stock',cost,stock};
    this.rerollCount++;this._fill();
    return {ok:true,cost,stock:stock-cost,summary:this.summary()};
  }

  nextEpoch(){this.epoch++;this._fill();return this.epoch;}
  consumeGuarantee(){if(this.guaranteedWins<=0)return false;this.guaranteedWins--;return true;}

  captureBall(){
    const {colorRates:r,ballValueMultiplier}=this.summary();
    // With no color upgrades, even this separate RNG remains untouched.
    const roll=r.silver>=1?1:this._random('colorRng');
    const colorTier=roll<r.rainbow?'rainbow':roll<r.rainbow+r.gold?'gold':roll<r.rainbow+r.gold+r.blue?'blue':'silver';
    return {colorTier,colorMultiplier:{silver:1,blue:2,gold:5,rainbow:10}[colorTier],ballValueMultiplier};
  }

  exportState(){
    return copy({version:1,purchases:this.purchases,guaranteedWins:this.guaranteedWins,epoch:this.epoch,
      rerollCount:this.rerollCount,offers:this.offers,shopRng:this.shopRng,colorRng:this.colorRng});
  }

  importState(state){
    // Validate the complete snapshot before replacing anything. Ignore no
    // malformed transaction IDs: they are the double-purchase protection.
    if(!state||state.version!==1||!state.purchases||IDS.some(id=>!integer(state.purchases[id])))return false;
    if(!safeGrowth(state.purchases))return false;
    if(['guaranteedWins','epoch','rerollCount','shopRng','colorRng'].some(key=>!integer(state[key])))return false;
    if(state.guaranteedWins>state.purchases.chain_one+3*state.purchases.chain_three)return false;
    if(state.shopRng>0xffffffff||state.colorRng>0xffffffff||!Array.isArray(state.offers)||state.offers.length!==3)return false;
    if(new Set(state.offers.map(o=>o?.id)).size!==3)return false;
    for(let i=0;i<3;i++){
      const o=state.offers[i];
      if(!o||!Object.hasOwn(RELIC_CATALOG,o.id)||o.offerId!==`${state.epoch}:${state.rerollCount}:${i}`||typeof o.sold!=='boolean'||!integer(o.price))return false;
      const count=state.purchases[o.id]-(o.sold?1:0);
      if(count<0||o.price!==doubled(RELIC_CATALOG[o.id].basePrice,count))return false;
    }
    this.purchases=Object.fromEntries(IDS.map(id=>[id,state.purchases[id]]));
    for(const key of ['guaranteedWins','epoch','rerollCount','shopRng','colorRng'])this[key]=state[key];
    this.offers=state.offers.map(({offerId,id,price,sold})=>({offerId,id,price,sold}));
    return true;
  }
}
