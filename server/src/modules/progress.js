"use strict";

const SYNC_PREFIXES = ["yua-pachinko"];

const MAIN_SAVE_KEY = "yua-pachinko-trial-v1";

function isSyncKey(key) {
  return typeof key === "string" && SYNC_PREFIXES.some(function (prefix) { return key.startsWith(prefix); });
}

function sanitizePlayerId(value) {
  const id = String(value == null ? "" : value).trim().slice(0, 32);
  if (!id) return null;
  return id.replace(/[^\w\u4e00-\u9fff\-·]/g, "_");
}

function createProgressModule(store, config) {
  function getPlayer(playerId) {
    return store.data.players[playerId] || null;
  }

  function upsertPlayer(playerId) {
    let player = store.data.players[playerId];
    if (!player) {
      if (Object.keys(store.data.players).length >= config.maxPlayers) {
        const error = new Error("player registry is full");
        error.statusCode = 507;
        throw error;
      }
      player = store.data.players[playerId] = {
        id: playerId,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        state: Object.create(null)
      };
    }
    return player;
  }

  function mergeState(playerId, incomingState) {
    if (!incomingState || typeof incomingState !== "object" || Array.isArray(incomingState)) {
      const error = new Error("state must be an object");
      error.statusCode = 400;
      throw error;
    }
    const player = upsertPlayer(playerId);
    let applied = 0;
    for (const key of Object.keys(incomingState)) {
      if (!isSyncKey(key)) continue;
      player.state[key] = incomingState[key];
      applied += 1;
    }
    player.updatedAt = new Date().toISOString();
    store.schedulePersist();
    return { applied: applied, total: Object.keys(player.state).length };
  }

  function getState(playerId) {
    const player = getPlayer(playerId);
    if (!player) {
      return { id: playerId, updatedAt: null, state: Object.create(null) };
    }
    return { id: player.id, updatedAt: player.updatedAt, state: player.state };
  }

  // The pachinko save is one opaque validated JSON record; the roster only
  // surfaces a few headline numbers when the record parses cleanly.
  function saveSummary(raw) {
    try {
      const record = JSON.parse(raw || "null");
      const payload = record && (record.payload || record);
      const engine = payload && payload.engine;
      if (!engine) return null;
      return {
        stock: Number(engine.stock) || 0,
        spins: Number(engine.stats && engine.stats.spins) || 0,
        relics: engine.relics && engine.relics.unlockedIds ? engine.relics.unlockedIds.length : 0
      };
    } catch (_error) { return null; }
  }

  function roster() {
    return Object.values(store.data.players).map(function (player) {
      const state = player.state || {};
      const summary = saveSummary(state[MAIN_SAVE_KEY]);
      return {
        id: player.id,
        createdAt: player.createdAt,
        updatedAt: player.updatedAt,
        keys: Object.keys(state).length,
        stock: summary ? summary.stock : null,
        spins: summary ? summary.spins : null,
        relics: summary ? summary.relics : null
      };
    }).sort(function (a, b) {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
  }

  return { mergeState: mergeState, getState: getState, roster: roster };
}

module.exports = {
  createProgressModule: createProgressModule,
  SYNC_PREFIXES: SYNC_PREFIXES
};
