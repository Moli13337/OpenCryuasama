import {selectAsset} from './asset-variants-v47.js';
const amount=n=>Number(n).toLocaleString('ja-JP');
const icons=new Set(['fortune','bonus_double','ball_value','blue_rate','gold_rate','rainbow_rate','chain_one','chain_three']);
export class RelicShop {
  constructor(root,{getShop,onBuy,onReroll,onChanged=()=>{}}){
    this.root=root;this.getShop=getShop;this.onBuy=onBuy;this.onReroll=onReroll;this.onChanged=onChanged;
    root.classList.add('relic-shop');
    root.innerHTML=`<form method="dialog"><button class="close" aria-label="お店を閉じる">×</button></form>
      <header class="shop-welcome"><img data-shop-portrait data-src="assets/shop-v01/tonari-v01.webp" alt="となりちゃん"><div><small>TONARI'S COLLECTION</small><h2>となりちゃんの<br>レリックショップ</h2><p>お帰りなさい。<br>次の一勝に、投資しましょう。</p></div></header>
      <div class="shop-wallet"><span>使える出玉</span><strong data-shop-wallet>0</strong><span>玉</span></div>
      <p class="shop-rule">購入するとすぐに消費し、今回の遊技中の強化になります。同じ品は買うたびに価格が2倍。</p>
      <div class="shop-offers" data-shop-offers></div>
      <button class="shop-reroll" data-shop-reroll><span>品揃えをリロール</span><b></b></button>
      <p class="shop-restock" data-shop-restock></p>
      <p class="shop-receipt" data-shop-receipt role="status" aria-live="polite"></p>
      <details class="shop-growth" open><summary>今回の強化</summary><div data-shop-summary></div></details>`;
    this.offers=root.querySelector('[data-shop-offers]');
    this.portrait=root.querySelector('[data-shop-portrait]');
    root.addEventListener('close',()=>{this.portrait.removeAttribute('src');this.offers.replaceChildren();});
    root.querySelector('[data-shop-reroll]').addEventListener('click',()=>this.transact(()=>this.onReroll(),'品揃えを新しくしました。'));
  }
  get open(){return this.root.open;}
  show(){this.portrait.src=selectAsset(this.portrait.dataset.src);this.paint();if(!this.root.open)this.root.showModal();}
  close(){this.root.close();}
  transact(action,message){
    if(this.busy)return;this.busy=true;
    try{const result=action();this.onChanged(result);this.paint();const receipt=this.root.querySelector('[data-shop-receipt]');
      receipt.textContent=result?.ok?`${message} −${amount(result.cost||0)}玉`:'購入できませんでした。出玉と品揃えを確認してください。';
      receipt.dataset.ok=String(Boolean(result?.ok));
    }finally{this.busy=false;}
  }
  paint(){
    const state=this.getShop(),s=state.summary;
    this.root.querySelector('[data-shop-wallet]').textContent=amount(state.stock);
    this.offers.replaceChildren();
    for(const offer of state.offers){
      const card=document.createElement('article');card.className='shop-card';card.dataset.relic=offer.id;card.dataset.sold=String(offer.sold);
      const icon=document.createElement('img');icon.src=selectAsset(`assets/shop-v01/${icons.has(offer.id)?offer.id:'fortune'}.png`);icon.alt='';
      const body=document.createElement('div'),heading=document.createElement('h3'),desc=document.createElement('p'),price=document.createElement('small'),button=document.createElement('button');
      heading.textContent=offer.name;desc.textContent=offer.description;
      price.textContent=`購入後、この品の次回価格 ${amount(offer.price*2)}玉`;
      button.textContent=offer.sold?'購入済み':`${amount(offer.price)}玉で購入`;
      button.disabled=offer.sold||!offer.affordable;button.dataset.offer=offer.offerId;
      button.addEventListener('click',()=>this.transact(()=>this.onBuy(offer.offerId),`${offer.name}を使用しました。`));
      body.append(heading,desc,button,price);card.append(icon,body);this.offers.append(card);
    }
    const reroll=this.root.querySelector('[data-shop-reroll]');reroll.disabled=!state.canReroll;reroll.querySelector('b').textContent=`${amount(state.rerollCost)}玉`;
    this.root.querySelector('[data-shop-restock]').textContent=`仕入れ ${state.epoch+1}回目 · 大当たり終了で無料入れ替え。リロール価格は毎回2倍。`;
    const list=this.root.querySelector('[data-shop-summary]');list.replaceChildren();
    const row=(name,value)=>{const el=document.createElement('div'),label=document.createElement('span'),b=document.createElement('b');label.textContent=name;b.textContent=value;el.append(label,b);list.append(el);};
    row('全BONUS',`×${amount(s.bonusMultiplier)}`);row('入賞した玉の価値',`×${amount(s.ballValueMultiplier)}`);row('右保留の大当たり保証',`${s.guaranteedWins}回`);
    row('大当たり確率',`通常 約1/${(1/s.normalOdds).toFixed(1)} · 右 約1/${(1/s.specialOdds).toFixed(1)}`);
    row('色玉の出現率',`青 ${(s.colorRates.blue*100).toFixed(1)}% · 金 ${(s.colorRates.gold*100).toFixed(1)}% · 虹 ${(s.colorRates.rainbow*100).toFixed(1)}%`);
    row('色玉の賞球倍率','青 ×2 · 金 ×5 · 虹 ×10');
  }
}
