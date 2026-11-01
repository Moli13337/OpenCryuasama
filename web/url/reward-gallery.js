/** The game owns balls; this gallery owns only paid access and reading progress. */
const ASSET_ROOT = './assets/rewards-v01/';
const page = (image, text, alt) => Object.freeze({ src: `${ASSET_ROOT}${image}`, text, alt });
export const REWARD_SCENES = Object.freeze([
  Object.freeze({ id: 'heart-v01', price: 10000, title: 'ハートのご褒美', subtitle: '視線の先に、小さなハート。', mark: '♡', pages: Object.freeze([
    page('tap_temptation_v01.png', 'でも必死に見てる顔は、ちょっと面白い♡', '腕を上げてこちらを見るゆあ様'),
    page('heart_temptation_v01.png', 'ハート作ってほしかったんでしょ？♡', '指でハートを作るゆあ様'),
    page('heart_temptation_v01.png', 'これで好かれたとか勘違いするなよ？♡', '指でハートを作るゆあ様'),
  ]) }),
  Object.freeze({ id: 'closer-v01', price: 50000, title: '近くのゆあ様', subtitle: 'ゆっくり、近くへ。', mark: '◇', pages: Object.freeze([
    page('closer_fullscreen_v01.png', 'いいよ♡その判断、最後まで後悔するなよ？♡', '紫の水着姿で横たわるゆあ様'),
    page('closer_arm_v01.png', '触ったら終了♡いいなりで我慢しろ♡', '腕を上げたゆあ様の近景'),
    page('heart_temptation_v01.png', 'ふふん♡', '指でハートを作るゆあ様'),
  ]) }),
  Object.freeze({ id: 'live-v01', price: 100000, title: 'ゆあ様のライブ', subtitle: 'スポットライトを、ひとりじめ。', mark: '✧', pages: Object.freeze([
    page('live_pose_v01.jpg', 'ほら♡もっと恥ずかしそうな顔しろよ♡', '紫の照明に包まれたゆあ様'),
    page('live_pose_v01.jpg', 'その顔、最後までゆあ様が見届けてあげる♡', 'こちらを見つめるゆあ様'),
    page('winner_pose_v01.jpg', '……いい顔♡', '両手でピースをするゆあ様'),
  ]) }),
]);
const SCENES = new Map(REWARD_SCENES.map(scene => [scene.id, scene]));
const validStock = value => Number.isSafeInteger(value) && value >= 0;
const balls = value => `${value.toLocaleString('ja-JP')} 玉`;
const emptyState = () => ({ version: 1, unlockedIds: [], completedIds: [], positions: {}, activeId: null, imageOnly: false });

/** User-specified fixed prices. Current stock never changes a scene's price. */
export function quoteReward(stock, price) {
  if (!validStock(stock) || !REWARD_SCENES.some(scene => scene.price === price)) return { allowed: false, reason: 'invalid' };
  const allowed = stock >= price;
  return { allowed, reason: allowed ? null : 'insufficient-stock', amount: price, price, stockBefore: stock,
    stockAfter: allowed ? stock - price : null, shortfall: Math.max(0, price - stock) };
}

export function normalizeRewardState(input) {
  if (!input || input.version !== 1) return null;
  const ids = list => [...new Set((Array.isArray(list) ? list : []).filter(id => SCENES.has(id)))];
  const unlockedIds = ids(input.unlockedIds), completedIds = ids(input.completedIds).filter(id => unlockedIds.includes(id));
  const positions = {};
  for (const id of unlockedIds) {
    const value = input.positions?.[id];
    positions[id] = Number.isSafeInteger(value) ? Math.min(SCENES.get(id).pages.length - 1, Math.max(0, value)) : 0;
  }
  return { version: 1, unlockedIds, completedIds, positions, activeId: unlockedIds.includes(input.activeId) ? input.activeId : null, imageOnly: input.imageOnly === true };
}

export class RewardGallery {
  constructor({ root = null, onPurchase = () => false, onStateChange = () => {}, onClose = () => {}, autoDelay = 4200 } = {}) {
    this.root = root; this.onPurchase = onPurchase; this.onStateChange = onStateChange; this.onClose = onClose;
    this.autoDelay = Math.max(2000, Number.isFinite(autoDelay) ? autoDelay : 4200);
    this.state = emptyState(); this.stock = 0; this.isOpen = false; this.pending = false; this.auto = false; this.message = '';
    this._timer = null; this._preload = null; this._imageSrc = null; this._imageReady = false;
    if (root) this._build();
  }

  exportState() { return JSON.parse(JSON.stringify(this.state)); }
  importState(input) {
    if (this.pending) return false;
    const next = normalizeRewardState(input); if (!next) return false;
    this._stopAuto(); this.state = next; this.message = ''; this._render(); return true;
  }
  reset() {
    if (this.pending) return false;
    this.close(); this.state = emptyState(); this.message = ''; this._emit(); return true;
  }
  open({ stock = this.stock, library = false } = {}) {
    if (!validStock(stock)) return false;
    this.stock = stock; this.message = '';
    if (library) this.state.activeId = null;
    if (!this.isOpen && this.root) {
      this._focusBefore = this.root.ownerDocument.activeElement;
      this._bodyOverflow = this.root.ownerDocument.body.style.overflow;
      this.root.ownerDocument.body.style.overflow = 'hidden';
    }
    this.isOpen = true; this._render(); this.closeButton?.focus(); return true;
  }
  updateStock(stock) {
    if (!validStock(stock)) return false;
    if (this.stock !== stock) { this.stock = stock; if (this.isOpen && !this.state.activeId) this._render(); }
    return true;
  }
  close() {
    const wasOpen = this.isOpen; this.isOpen = false; this._stopAuto(); this._releaseImages();
    if (this.root) {
      this.root.hidden = true;
      if (wasOpen) { this.root.ownerDocument.body.style.overflow = this._bodyOverflow ?? ''; this._focusBefore?.focus?.(); }
    }
    if (wasOpen) this.onClose(this.exportState());
    return true;
  }
  getQuote(rewardId) {
    const scene = SCENES.get(rewardId); if (!scene) return { allowed: false, reason: 'unknown' };
    if (this.state.unlockedIds.includes(rewardId)) return { allowed: true, owned: true, amount: 0, price: scene.price, stockBefore: this.stock, stockAfter: this.stock, shortfall: 0 };
    return { ...quoteReward(this.stock, scene.price), owned: false };
  }
  /** Callback must debit the current game stock atomically and acknowledge only success. */
  async purchase(rewardId, expectedStock = this.stock) {
    if (this.pending) return { ok: false, reason: 'pending' };
    const quote = this.getQuote(rewardId);
    if (quote.owned) { this.play(rewardId); return { ok: true, owned: true, amount: 0 }; }
    if (!quote.allowed || expectedStock !== this.stock) {
      this.message = expectedStock !== this.stock ? '持ち玉が変わりました。金額を確認してください。' : quote.shortfall ? `持ち玉が足りません。あと${balls(quote.shortfall)}必要です。` : 'このご褒美は購入できません。';
      this._render(); return { ok: false, reason: expectedStock !== this.stock ? 'changed' : quote.reason };
    }
    this.pending = true; this.message = ''; this._render();
    let result;
    try {
      result = this.onPurchase(quote.amount, rewardId, { ...quote });
      if (result && typeof result.then === 'function') result = await result;
    } catch { result = false; }
    this.pending = false;
    if (result !== true && result?.ok !== true) {
      if (validStock(result?.stock)) this.stock = result.stock;
      this.message = '購入できませんでした。玉の支払いを確認して、もう一度お試しください。';
      this._render(); return { ok: false, reason: 'payment' };
    }
    this.stock = validStock(result?.stock) ? result.stock : quote.stockAfter;
    this.state.unlockedIds.push(rewardId); this.state.positions[rewardId] = 0;
    this.state.activeId = rewardId; this.state.imageOnly = false; this._emit(); this._render();
    return { ok: true, owned: false, amount: quote.amount, stock: this.stock };
  }
  play(rewardId, { restart = false } = {}) {
    if (this.pending || !this.state.unlockedIds.includes(rewardId)) return false;
    this._stopAuto(); this.state.activeId = rewardId;
    if (restart || this.state.positions[rewardId] === undefined) this.state.positions[rewardId] = 0;
    this.message = ''; this._emit(); this._render(); return true;
  }
  showLibrary() {
    this._stopAuto(); this.state.activeId = null; this.state.imageOnly = false;
    this.message = ''; this._releaseImages(); this._emit(); this._render(); return true;
  }
  next() {
    const scene = SCENES.get(this.state.activeId); if (!scene) return false;
    const current = this.state.positions[scene.id] ?? 0;
    if (current >= scene.pages.length - 1) {
      this._complete(scene.id); this.showLibrary(); return false;
    }
    this.state.positions[scene.id] = current + 1;
    this._emit(); this._render(); return true;
  }
  previous() {
    const id = this.state.activeId; if (!SCENES.has(id) || !(this.state.positions[id] > 0)) return false;
    this._stopAuto(); this.state.positions[id]--; this._emit(); this._render(); return true;
  }
  setImageOnly(value) {
    this.state.imageOnly = Boolean(value); this._emit(); this._render(); return this.state.imageOnly;
  }
  setAuto(value) {
    this._stopAuto(); this.auto = Boolean(value) && this.isOpen && Boolean(this.state.activeId);
    this._render(); return this.auto;
  }
  _complete(id) {
    if (!this.state.completedIds.includes(id)) this.state.completedIds.push(id);
    this._emit();
  }
  _emit() { this.onStateChange(this.exportState()); }
  _stopAuto() { this.auto = false; clearTimeout(this._timer); this._timer = null; }
  _scheduleAuto() {
    clearTimeout(this._timer); this._timer = null;
    if (!this.auto || !this.isOpen || !this.state.activeId || (this.root && !this._imageReady)) return;
    this._timer = setTimeout(() => { this._timer = null; this.next(); }, this.autoDelay);
  }

  _build() {
    const root = this.root, doc = root.ownerDocument;
    root.classList.add('reward-gallery'); root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'ゆあ様のご褒美');
    const el = (tag, name, parent = root, text = '') => { const node = doc.createElement(tag); node.className = `reward-gallery__${name}`; node.textContent = text; parent?.append(node); return node; };
    const button = (name, text, parent, action) => { const node = el('button', name, parent, text); node.type = 'button'; node.addEventListener('click', action); return node; };
    this.panel = el('section', 'panel'); this.header = el('header', 'header', this.panel);
    const heading = el('div', 'heading', this.header); el('span', 'eyebrow', heading, 'YUA REWARDS'); el('h2', 'title', heading, 'ゆあ様のご褒美');
    this.closeButton = button('close', '閉じる ×', this.header, () => this.close());
    this.stockLabel = el('p', 'stock', this.panel); this.status = el('p', 'status', this.panel); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    this.library = el('section', 'library', this.panel);
    el('p', 'intro', this.library, '持ち玉を払うと、ご褒美パートが開きます。購入したシーンは、この試遊中いつでも無料で見返せます。');
    this.cards = el('div', 'cards', this.library);
    el('p', 'note', this.library, 'ご褒美は固定料金です。購入による大当たり確率の変化はありません。');
    this.reader = el('section', 'reader', this.panel); this.reader.hidden = true;
    this.readerHead = el('div', 'reader-head', this.reader); this.sceneTitle = el('h3', 'scene-title', this.readerHead);
    this.libraryButton = button('library-back', '一覧へ', this.readerHead, () => this.showLibrary());
    this.figure = el('figure', 'figure', this.reader); this.art = el('img', 'art', this.figure); this.art.draggable = false; this.art.decoding = 'async';
    this.imageStatus = el('p', 'image-status', this.figure); this.imageStatus.setAttribute('role', 'status');
    this.dialogue = el('div', 'dialogue', this.reader); el('b', 'speaker', this.dialogue, 'ゆあ様');
    this.text = el('p', 'text', this.dialogue); this.text.setAttribute('aria-live', 'polite'); this.progress = el('span', 'progress', this.dialogue);
    this.controls = el('nav', 'controls', this.reader); this.controls.setAttribute('aria-label', 'ご褒美のページ操作');
    this.previousButton = button('previous', '← 戻る', this.controls, () => this.previous());
    this.nextButton = button('next', '進む →', this.controls, () => this.next());
    this.autoButton = button('auto', '自動送り', this.controls, () => this.setAuto(!this.auto));
    this.imageOnlyButton = button('image-only', 'イラストのみ', this.controls, () => this.setImageOnly(!this.state.imageOnly));
    root.addEventListener('click', event => { if (event.target === root) this.close(); });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.close(); }
      else if (event.key === 'ArrowRight' && this.state.activeId) { event.preventDefault(); this.next(); }
      else if (event.key === 'ArrowLeft' && this.state.activeId) { event.preventDefault(); this.previous(); }
      else if (event.key === 'Tab') {
        const nodes = [...root.querySelectorAll('button:not(:disabled)')].filter(node => node.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    this._makeElement = el; this._makeButton = button;
  }
  _render() {
    if (!this.root || !this.isOpen) { this._scheduleAuto(); return; }
    const scene = SCENES.get(this.state.activeId);
    const priorView = this.root.dataset.view, wasFocusInside = this.root.contains(this.root.ownerDocument.activeElement);
    this.root.hidden = false; this.root.dataset.view = scene ? 'reader' : 'library'; this.root.dataset.imageOnly = String(Boolean(scene && this.state.imageOnly));
    this.stockLabel.textContent = `持ち玉 ${balls(this.stock)}`; this.status.textContent = this.message; this.status.hidden = !this.message;
    this.library.hidden = Boolean(scene); this.reader.hidden = !scene;
    if (!scene) {
      this._releaseImages(); this.cards.replaceChildren();
      // New scenes first, then unfinished purchases, then completed purchases.
      const rank = entry => !this.state.unlockedIds.includes(entry.id) ? 0 : !this.state.completedIds.includes(entry.id) ? 1 : 2;
      const ordered = [...REWARD_SCENES].sort((a, b) => rank(a) - rank(b));
      for (const item of ordered) {
        const q = this.getQuote(item.id), card = this._makeElement('article', 'card', this.cards); card.dataset.rewardId = item.id;
        this._makeElement('span', 'card-mark', card, item.mark);
        const copy = this._makeElement('div', 'card-copy', card);
        this._makeElement('span', 'card-tier', copy, q.owned ? (this.state.completedIds.includes(item.id) ? '読了・購入済み' : '購入済み・つづきあり') : '固定料金のご褒美');
        this._makeElement('h3', 'card-title', copy, item.title); this._makeElement('p', 'card-subtitle', copy, item.subtitle);
        this._makeElement('p', 'card-price', copy, q.owned ? `再生 0 玉 ／ 全 ${item.pages.length} ページ` : q.allowed ? `支払い ${balls(q.amount)} → 残り ${balls(q.stockAfter)}` : `支払い ${balls(q.amount)} ／ あと ${balls(q.shortfall)} 必要`);
        const purchase = this._makeButton('buy', q.owned ? 'つづきから見る（無料）' : `${balls(q.amount)}を払って見る`, copy, () => this.purchase(item.id, q.stockBefore));
        purchase.dataset.rewardId = item.id; purchase.disabled = this.pending || !q.allowed;
        if (q.owned) { const restart = this._makeButton('restart', '最初から見る', copy, () => this.play(item.id, { restart: true })); restart.disabled = this.pending; }
      }
      this.cards.setAttribute('aria-busy', String(this.pending));
    } else {
      const index = this.state.positions[scene.id] ?? 0, current = scene.pages[index];
      this.sceneTitle.textContent = scene.title; this.text.textContent = current.text; this.progress.textContent = `${index + 1} / ${scene.pages.length}`;
      this.previousButton.disabled = index === 0; this.nextButton.textContent = index === scene.pages.length - 1 ? '読了・一覧へ ✓' : '進む →';
      this.autoButton.textContent = this.auto ? '自動送り 停止' : '自動送り'; this.autoButton.setAttribute('aria-pressed', String(this.auto));
      this.imageOnlyButton.textContent = this.state.imageOnly ? '台詞を表示' : 'イラストのみ'; this.imageOnlyButton.setAttribute('aria-pressed', String(this.state.imageOnly));
      this.dialogue.hidden = this.state.imageOnly;
      this._showImage(current);
      const upcoming = scene.pages.slice(index + 1).find(entry => entry.src !== current.src);
      this._preloadImage(upcoming?.src);
    }
    this._scheduleAuto();
    if (priorView !== this.root.dataset.view || (wasFocusInside && !this.root.contains(this.root.ownerDocument.activeElement))) {
      (scene ? this.nextButton : this.closeButton).focus();
    }
  }
  _showImage(current) {
    this.art.alt = current.alt;
    if (this._imageSrc === current.src) return;
    this._imageSrc = current.src; this._imageReady = false; this.art.hidden = true;
    this.imageStatus.hidden = false; this.imageStatus.textContent = 'イラストを読み込み中…';
    const src = current.src, version = this._imageVersion = (this._imageVersion ?? 0) + 1;
    this.art.onload = async () => {
      // An async-decoding image can fire load before its pixels are ready to paint.
      try { await this.art.decode?.(); } catch { /* onerror handles a real load failure. */ }
      if (this._imageVersion !== version || this._imageSrc !== src || !this.isOpen || !this.art.naturalWidth) return;
      this._imageReady = true; this.art.hidden = false; this.imageStatus.hidden = true; this._scheduleAuto();
    };
    this.art.onerror = () => {
      if (this._imageVersion !== version || this._imageSrc !== src || !this.isOpen) return;
      this._imageReady = false; this.imageStatus.hidden = false; this.imageStatus.textContent = 'イラストを読み込めませんでした。一覧へ戻って再度お試しください。'; this._stopAuto();
      this.autoButton.setAttribute('aria-pressed', 'false'); this.autoButton.textContent = '自動送り';
    };
    this.art.src = src;
  }
  _preloadImage(src) {
    if (this._preload?.getAttribute('src') === src) return;
    this._preload?.removeAttribute('src'); this._preload = null;
    if (!src || !this.root) return;
    this._preload = this.root.ownerDocument.createElement('img'); this._preload.decoding = 'async'; this._preload.src = src;
  }
  _releaseImages() {
    this._imageVersion = (this._imageVersion ?? 0) + 1;
    this._preload?.removeAttribute('src'); this._preload = null; this._imageSrc = null; this._imageReady = false;
    if (this.art) { this.art.onload = this.art.onerror = null; this.art.removeAttribute('src'); this.art.hidden = true; }
  }
}
