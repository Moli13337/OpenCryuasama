"use strict";

const fs = require("fs");
const path = require("path");

function createStore(dataDir) {
  const file = path.join(dataDir, "db.json");
  const state = {
    data: { players: {} },
    timer: null
  };

  function load() {
    fs.mkdirSync(dataDir, { recursive: true });
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      state.data.players = raw.players && typeof raw.players === "object" ? raw.players : {};
    } catch (_error) { /* first boot or unreadable file starts fresh */ }
  }

  function persistNow() {
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state.data, null, 2), "utf8");
    fs.renameSync(tmp, file);
  }

  function schedulePersist() {
    if (state.timer) return;
    state.timer = setTimeout(function () {
      state.timer = null;
      try { persistNow(); } catch (_error) { /* retried on next change */ }
    }, 800);
  }

  return { data: state.data, load: load, persistNow: persistNow, schedulePersist: schedulePersist };
}

module.exports = { createStore: createStore };
