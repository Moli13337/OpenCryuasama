"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  host: "0.0.0.0",
  port: 8803,
  corsAllowOrigin: "*",
  webDir: "../web",
  dataDir: "data",
  injectScript: "/lan-sync.js",
  unlockAuto: true,
  syncIntervalHintMs: 10000,
  maxPlayers: 200,
  requestTimeoutMs: 15000
};

function loadConfig(serverRoot) {
  const file = path.join(serverRoot, "config", "server.json");
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_error) { /* fall back to defaults */ }
  const merged = Object.assign({}, DEFAULTS, raw);
  merged.webDir = path.resolve(serverRoot, merged.webDir);
  merged.dataDir = path.resolve(serverRoot, merged.dataDir);
  const siteFile = path.join(serverRoot, "config", "site.json");
  let site = {};
  try {
    site = JSON.parse(fs.readFileSync(siteFile, "utf8"));
  } catch (_error) { /* empty site config */ }
  return { server: merged, site: site };
}

module.exports = { loadConfig: loadConfig };
