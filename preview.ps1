# preview.ps1 — launch the StrengthHub web preview locally (Windows / PowerShell)
#
# Usage:
#   1. Open PowerShell in the repo folder (or just double-run this file's folder).
#   2. If you see "running scripts is disabled", run once:
#         Set-ExecutionPolicy -Scope Process -Bypass
#   3. Run:  .\preview.ps1
#
# It installs dependencies on first run, then starts the web preview at
# http://localhost:8081 (opens your browser). Press Ctrl+C to stop.

$ErrorActionPreference = 'Stop'

# Always run from the repo root (this script's folder), even if double-clicked.
Set-Location -Path $PSScriptRoot

Write-Host 'StrengthHub — local web preview' -ForegroundColor Green

# --- Node.js check ---
try {
  $nodeVersion = (node -v)
} catch {
  Write-Host 'Node.js was not found.' -ForegroundColor Red
  Write-Host 'Install Node 20 LTS from https://nodejs.org, then reopen PowerShell and run this again.'
  exit 1
}
Write-Host "Using Node $nodeVersion"

# --- Dependencies ---
if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installing dependencies (first run, ~1 minute)...' -ForegroundColor Cyan
  npm ci
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'npm ci failed (lockfile mismatch?) — falling back to npm install...' -ForegroundColor Yellow
    npm install
  }
} else {
  Write-Host 'Dependencies already installed.'
}

# --- Launch ---
Write-Host ''
Write-Host 'Starting web preview at http://localhost:8081  (Ctrl+C to stop)' -ForegroundColor Green
npx expo start --web
