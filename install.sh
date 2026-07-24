#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
fail()  { printf "${RED}[✗]${NC} %s\n" "$1"; }

echo ""
echo "========================================="
echo "  AI English Test Practice – Installer"
echo "========================================="
echo ""

# --- 1. Node.js 20+ ---
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    info "Node.js $(node -v) detected"
  else
    fail "Node.js $(node -v) detected, but version 20+ is required."
    echo ""
    echo "  Install Node.js 20+ from: https://nodejs.org/"
    exit 1
  fi
else
  fail "Node.js is not installed."
  echo ""
  echo "  Install Node.js 20+ from: https://nodejs.org/"
  exit 1
fi

# --- 2. Python 3 ---
if command -v python3 &>/dev/null; then
  info "Python $(python3 --version 2>&1) detected"
else
  fail "Python 3 is not installed."
  echo ""
  echo "  Install Python 3: sudo apt install python3 python3-pip"
  exit 1
fi

# --- 3. npm install ---
info "Installing Node.js dependencies..."
npm install --no-fund --no-audit
info "npm install complete"

# --- 4. edge-tts via pip3 ---
info "Installing edge-tts..."
pip3 install --user edge-tts 2>/dev/null || pip3 install edge-tts
info "edge-tts installed"

# --- 5. ffmpeg ---
if command -v ffmpeg &>/dev/null; then
  info "ffmpeg detected ($(ffmpeg -version 2>&1 | head -1 | awk '{print $3}'))"
else
  fail "ffmpeg is not installed."
  echo ""
  echo "  Install ffmpeg: sudo apt install ffmpeg"
  exit 1
fi

# --- 6. Verify dependencies ---
info "Verifying dependencies..."

if node -e "require('express')" 2>/dev/null; then
  info "express – OK"
else
  fail "express – FAILED (run npm install again)"
  exit 1
fi

if ffmpeg -version &>/dev/null; then
  info "ffmpeg – OK"
else
  fail "ffmpeg – FAILED"
  exit 1
fi

if python3 -c "import edge_tts" 2>/dev/null; then
  info "edge_tts – OK"
else
  fail "edge_tts – FAILED (run: pip3 install edge-tts)"
  exit 1
fi

# --- 7. Success ---
echo ""
echo "========================================="
echo "  All dependencies installed!"
echo "========================================="
echo ""
echo "  To start the app, run these in separate terminals:"
echo ""
echo "    Terminal 1 (API server):   npx tsx server/app.ts"
echo "    Terminal 2 (Vite dev):     npx vite"
echo ""
echo "  Then open http://localhost:5173"
echo ""
