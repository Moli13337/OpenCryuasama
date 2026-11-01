// Traditional Chinese dictionary (templates + glue). Loaded after zh-dict.js
// and before lan-i18n.js. Any exact key containing a ${...} placeholder is
// actually a pattern: move those into patterns preserving declaration order
// (earlier declarations win over later catch-alls).
(function () {
  "use strict";
  var dict = window.LAN_ZH_DICT;
  if (!dict) return;
  dict.patterns = dict.patterns || [];
  var moved = [];
  for (var key in dict.exact) {
    if (Object.prototype.hasOwnProperty.call(dict.exact, key) && key.indexOf("${...}") !== -1) {
      moved.push([key, dict.exact[key]]);
      delete dict.exact[key];
    }
  }
  // Extra templates that were never part of the exact table.
  var extra = [
    ["回 ＋ 保留${...}", "次 ＋ 保留${...}"],
    ["${...}を予約しました。", "已預約${...}。"]
  ];
  dict.patterns = moved.concat(extra, dict.patterns);
})();
