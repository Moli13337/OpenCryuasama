$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[ERROR] Node.js not found. Install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

Write-Host "==============================================" -ForegroundColor Yellow
Write-Host " cryuasama LAN server launcher" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host " Game        : 宗教非法人 ゆあ様 (pachinko, served at /)"
Write-Host " Backend     : /api/* progress sync"
Write-Host " Language    : ja (default) / zh toggle via lan-i18n chip"
Write-Host " Config      : server/config/server.json | site.json"
Write-Host " Stop        : Ctrl+C"
Write-Host "==============================================" -ForegroundColor Yellow

Set-Location (Join-Path $root "server")
node src/index.js
