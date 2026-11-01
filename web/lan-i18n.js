(function (root) {
  "use strict";

  // Runtime ja/zh translator for the LAN mirror. Japanese is the original
  // build (untouched); zh applies a dictionary to text nodes, user-facing
  // attributes and canvas fillText/strokeText/measureText calls.
  const LANG_KEY = "yua-pachinko-lang-v1";
  const doc = root.document;
  if (!doc) return;

  const dict = root.LAN_ZH_DICT || {};
  const EXACT = dict.exact || {};
  const PATTERNS = [];

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  (dict.patterns || []).forEach(function (pair) {
    if (!pair || typeof pair[0] !== "string") return;
    const slots = pair[0].split("${...}").length - 1;
    const reSrc = pair[0].split("${...}").map(escapeRe).join("([\\s\\S]+?)");
    try {
      PATTERNS.push({ re: new RegExp("^" + reSrc + "$"), zh: pair[1], slots: slots });
    } catch (_error) { /* skip malformed pattern */ }
  });

  let lang = "ja";
  try {
    const query = new URLSearchParams(root.location.search).get("lan");
    if (query === "zh" || query === "ja") root.localStorage.setItem(LANG_KEY, query);
    const saved = root.localStorage.getItem(LANG_KEY);
    if (saved === "zh" || saved === "ja") lang = saved;
  } catch (_error) { /* storage unavailable */ }

  function translateCaptured(cap) {
    if (cap == null) return "";
    if (EXACT[cap] !== undefined) return EXACT[cap];
    const deeper = translateText(cap);
    return deeper !== null ? deeper : cap;
  }

  function translateText(text) {
    if (typeof text !== "string" || !text) return null;
    const exact = EXACT[text];
    if (exact !== undefined) return exact;
    for (let i = 0; i < PATTERNS.length; i += 1) {
      const p = PATTERNS[i];
      const m = p.re.exec(text);
      if (!m) continue;
      let result = p.zh;
      for (let k = 1; k <= p.slots; k += 1) {
        result = result.replace("${...}", translateCaptured(m[k]));
      }
      return result;
    }
    return null;
  }

  const ATTRS = ["title", "aria-label", "placeholder", "alt"];
  const nodeOrig = new WeakMap();   // text node -> original value
  const attrOrig = new WeakMap();   // element -> { attr: original }

  function translateTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    const original = nodeOrig.get(node) !== undefined ? nodeOrig.get(node) : node.nodeValue;
    if (lang === "ja") {
      if (nodeOrig.has(node) && node.nodeValue !== original) node.nodeValue = original;
      nodeOrig.delete(node);
      return;
    }
    nodeOrig.set(node, original);
    const translated = translateText(original);
    // Compare against the CURRENT value, not the stored original: setNodeValue
    // fires a characterData mutation, and an unconditional write would feed
    // the MutationObserver back into itself (infinite microtask loop).
    if (translated !== null && node.nodeValue !== translated) node.nodeValue = translated;
  }

  function translateElement(el) {
    for (const attr of ATTRS) {
      if (!el.hasAttribute || !el.hasAttribute(attr)) continue;
      const store = attrOrig.get(el) || {};
      const original = store[attr] !== undefined ? store[attr] : el.getAttribute(attr);
      store[attr] = original;
      attrOrig.set(el, store);
      // setAttribute emits a mutation record even when the value is identical,
      // so every write must be guarded by a value comparison.
      if (lang === "ja") {
        if (el.getAttribute(attr) !== original) el.setAttribute(attr, original);
      } else {
        const translated = translateText(original);
        if (translated !== null && el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
      }
    }
    if (lang === "zh" && el.tagName === "TITLE") {
      const first = el.firstChild;
      if (first && first.nodeType === 3) {
        const original = nodeOrig.get(first) !== undefined ? nodeOrig.get(first) : first.nodeValue;
        nodeOrig.set(first, original);
        const translated = translateText(original);
        // Write through the existing text node: assigning textContent would
        // detach firstChild and lose the nodeOrig mapping needed to restore ja.
        if (translated !== null && first.nodeValue !== translated) first.nodeValue = translated;
      }
    }
  }

  function walk(rootEl) {
    if (!rootEl) return;
    const walker = doc.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (node) {
        return (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim())
          || (node.nodeType === 1 && (node.tagName === "TITLE" || ATTRS.some(a => node.hasAttribute && node.hasAttribute(a))))
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const hits = [];
    while (walker.nextNode()) hits.push(walker.currentNode);
    for (const node of hits) {
      if (node.nodeType === 3) translateTextNode(node);
      else translateElement(node);
    }
  }

  // Canvas text goes through fillText/strokeText; sprite caches measure first.
  const protoTargets = [root.CanvasRenderingContext2D];
  if (root.OffscreenCanvasRenderingContext2D) protoTargets.push(root.OffscreenCanvasRenderingContext2D);
  for (const Proto of protoTargets) {
    for (const method of ["fillText", "strokeText", "measureText"]) {
      const original = Proto.prototype[method];
      if (typeof original !== "function") continue;
      Proto.prototype[method] = function (text) {
        if (lang === "zh" && typeof arguments[0] === "string") {
          const translated = translateText(arguments[0]);
          if (translated !== null) {
            arguments[0] = translated;
            return original.apply(this, arguments);
          }
        }
        return original.apply(this, arguments);
      };
    }
  }

  function applyLanguage() {
    doc.documentElement.lang = lang === "zh" ? "zh-CN" : "ja";
    doc.documentElement.dataset.lan = lang;
    styleEl.textContent = lang === "zh" ? CSS_OVERRIDES : "";
    walk(doc.documentElement);
    renderChip();
  }

  const CSS_OVERRIDES = [
    'html[data-lan="zh"] .lcd[data-long-reach="true"] .lcd-push::after{content:\'按下，呼喚光芒\'!important}'
  ].join("\n");

  const styleEl = doc.createElement("style");
  (doc.head || doc.documentElement).appendChild(styleEl);

  const observer = new MutationObserver(function (mutations) {
    const textNodes = [];
    const elements = [];
    for (const m of mutations) {
      if (m.type === "characterData") {
        textNodes.push(m.target);
      } else if (m.type === "childList") {
        for (const node of m.addedNodes) {
          if (node.nodeType === 3) textNodes.push(node);
          else if (node.nodeType === 1) elements.push(node);
        }
      } else if (m.type === "attributes" && m.target.nodeType === 1) {
        elements.push(m.target);
      }
    }
    if (lang !== "zh") return;
    for (const node of textNodes) translateTextNode(node);
    for (const el of elements) { translateElement(el); walk(el); }
  });

  function startObserver() {
    observer.observe(doc.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }

  // language toggle chip
  const chip = doc.createElement("button");
  chip.type = "button";
  chip.id = "lan-i18n-chip";
  chip.addEventListener("click", function () {
    lang = lang === "zh" ? "ja" : "zh";
    try { root.localStorage.setItem(LANG_KEY, lang); } catch (_error) { /* ignore */ }
    applyLanguage();
  });

  function renderChip() {
    chip.textContent = lang === "zh" ? "日本語" : "中文";
    chip.title = lang === "zh" ? "切換為日文原文" : "切换为繁体中文";
    chip.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:2147483000;"
      + "padding:6px 12px;border-radius:999px;border:1px solid rgba(233,221,191,.55);"
      + "background:rgba(9,12,17,.82);color:#eee6d0;font:600 13px/1.2 sans-serif;"
      + "cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.45);backdrop-filter:blur(4px)";
  }

  function boot() {
    doc.body.appendChild(chip);
    renderChip();
    applyLanguage();
    startObserver();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();

  root.__lanI18n = {
    get lang() { return lang; },
    setLang: function (value) {
      if (value !== "zh" && value !== "ja") return;
      lang = value;
      try { root.localStorage.setItem(LANG_KEY, lang); } catch (_error) { /* ignore */ }
      applyLanguage();
    },
    translateText: translateText
  };
})(window);
