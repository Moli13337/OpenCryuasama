#!/usr/bin/env bash
set -e

root="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js not found. Install Node.js 18+ first."
    exit 1
fi

echo "=============================================="
echo " cryuasama LAN server launcher"
echo "=============================================="
echo " Game        : 宗教非法人 ゆあ様 (pachinko, served at /)"
echo " Backend     : /api/* progress sync"
echo " Language    : ja (default) / zh toggle via lan-i18n chip"
echo " Config      : server/config/server.json | site.json"
echo " Stop        : Ctrl+C"
echo "=============================================="

cd "$root/server"
exec node src/index.js

