#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

CHECK="${GREEN}✓${NC}"
FAIL="${RED}✗${NC}"
WARN="${YELLOW}!${NC}"

pass() { printf "  ${CHECK} %s\n" "$1"; }
info() { printf "  ${CYAN}→${NC} %s\n" "$1"; }
warn() { printf "  ${WARN} %s\n" "$1"; }
fail() { printf "  ${FAIL} %s\n" "$1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Parse flags ---
MODE="install"
for arg in "$@"; do
  case "$arg" in
    --check)     MODE="check" ;;
    --uninstall) MODE="uninstall" ;;
    --help|-h)
      echo "Usage: ./install.sh [--check|--uninstall]"
      echo "  (no flag)   Install missing dependencies"
      echo "  --check     Only verify dependencies, do not install"
      echo "  --uninstall Remove installed dependencies"
      exit 0 ;;
    *)
      warn "Unknown flag: $arg (use --help for usage)"
      exit 1 ;;
  esac
done

# --- Detect OS and package manager ---
detect_os() {
  case "$(uname -s)" in
    Linux*)
      if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
          ubuntu|debian|linuxmint|pop) OS="debian"; PKG="apt" ;;
          fedora|rhel|centos|rocky|alma|amzn) OS="rhel"; PKG="dnf" ;;
          arch|manjaro|endeavouros) OS="arch"; PKG="pacman" ;;
          alpine) OS="alpine"; PKG="apk" ;;
          *) OS="linux-unknown"; PKG="" ;;
        esac
      else
        OS="linux-unknown"; PKG=""
      fi ;;
    Darwin*) OS="macos"; PKG="brew" ;;
    MINGW*|MSYS*|CYGWIN*) OS="windows-msys"; PKG="pacman" ;;
    *) OS="unknown"; PKG="" ;;
  esac
}

detect_os

needs_sudo() {
  if [ "$PKG" = "apt" ] && [ "$(id -u)" -ne 0 ]; then
    echo "sudo"
  else
    echo ""
  fi
}

SUDO="$(needs_sudo)"

pkg_install() {
  local pkg="$1"
  case "$PKG" in
    apt)    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq "$pkg" ;;
    brew)   brew install "$pkg" ;;
    pacman) $SUDO pacman -S --noconfirm "$pkg" ;;
    dnf)    $SUDO dnf install -y "$pkg" ;;
    apk)    $SUDO apk add "$pkg" ;;
    *)      return 1 ;;
  esac
}

# --- Dependency check helpers ---
node_ok() {
  if command -v node &>/dev/null; then
    local v
    v=$(node -v | sed 's/v//')
    [ "$(echo "$v" | cut -d. -f1)" -ge 20 ]
  else
    return 1
  fi
}

python3_ok() { command -v python3 &>/dev/null; }
ffmpeg_ok()  { command -v ffmpeg &>/dev/null; }
edge_tts_ok() { python3 -c "import edge_tts" &>/dev/null; }

npm_deps_ok() { [ -f "$SCRIPT_DIR/node_modules/.package-lock.json" ]; }

# --- Installers ---
install_node() {
  if node_ok; then
    pass "Node.js $(node -v) — installed"
    return 0
  fi

  if command -v node &>/dev/null; then
    warn "Node.js $(node -v) found but 20+ required — upgrading..."
  fi

  info "Installing Node.js 20..."
  case "$OS" in
    debian)
      curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
      $SUDO apt-get install -y -qq nodejs ;;
    rhel)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
      $SUDO dnf install -y nodejs ;;
    arch)
      $SUDO pacman -S --noconfirm nodejs npm ;;
    alpine)
      $SUDO apk add nodejs npm ;;
    macos)
      if command -v brew &>/dev/null; then
        brew install node@20 && brew link --overwrite node@20
      else
        fail "Homebrew not found. Install from https://brew.sh"
        return 1
      fi ;;
    windows-msys)
      $SUDO pacman -S --noconfirm nodejs npm ;;
    *)
      fail "Cannot auto-install Node.js on this OS ($OS)."
      info "Install from https://nodejs.org/"
      return 1 ;;
  esac

  if node_ok; then
    pass "Node.js $(node -v) — installed"
  else
    fail "Node.js installation failed"
    return 1
  fi
}

install_python() {
  if python3_ok; then
    pass "Python $(python3 --version 2>&1 | awk '{print $2}') — installed"
    return 0
  fi

  info "Installing Python 3..."
  case "$PKG" in
    apt)    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq python3 python3-pip ;;
    brew)   brew install python3 ;;
    pacman) $SUDO pacman -S --noconfirm python python-pip ;;
    dnf)    $SUDO dnf install -y python3 python3-pip ;;
    apk)    $SUDO apk add python3 py3-pip ;;
    *)      fail "Cannot auto-install Python 3 on this OS ($OS)"; return 1 ;;
  esac

  if python3_ok; then
    pass "Python $(python3 --version 2>&1 | awk '{print $2}') — installed"
  else
    fail "Python 3 installation failed"
    return 1
  fi
}

install_ffmpeg() {
  if ffmpeg_ok; then
    local ver
    ver=$(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')
    pass "ffmpeg $ver — installed"
    return 0
  fi

  info "Installing ffmpeg..."
  case "$PKG" in
    apt)    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq ffmpeg ;;
    brew)   brew install ffmpeg ;;
    pacman) $SUDO pacman -S --noconfirm ffmpeg ;;
    dnf)    $SUDO dnf install -y ffmpeg ;;
    apk)    $SUDO apk add ffmpeg ;;
    *)      fail "Cannot auto-install ffmpeg on this OS ($OS)"; return 1 ;;
  esac

  if ffmpeg_ok; then
    pass "ffmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}') — installed"
  else
    fail "ffmpeg installation failed"
    return 1
  fi
}

install_npm_deps() {
  info "Running npm install..."
  npm install --no-fund --no-audit --prefix "$SCRIPT_DIR"
  pass "npm dependencies installed"
}

install_edge_tts() {
  if edge_tts_ok; then
    pass "edge-tts — installed"
    return 0
  fi

  info "Installing edge-tts..."
  python3 -m pip install --user edge-tts 2>/dev/null || python3 -m pip install edge-tts

  if edge_tts_ok; then
    pass "edge-tts — installed"
  else
    fail "edge-tts installation failed"
    return 1
  fi
}

# --- Uninstall ---
do_uninstall() {
  echo ""
  echo "========================================="
  echo "  Uninstalling dependencies..."
  echo "========================================="
  echo ""

  if command -v npm &>/dev/null && [ -f "$SCRIPT_DIR/package.json" ]; then
    info "Removing node_modules..."
    rm -rf "$SCRIPT_DIR/node_modules" "$SCRIPT_DIR/package-lock.json"
    pass "node_modules removed"
  fi

  if edge_tts_ok; then
    info "Uninstalling edge-tts..."
    python3 -m pip uninstall -y edge-tts 2>/dev/null || pip3 uninstall -y edge-tts 2>/dev/null || true
    pass "edge-tts removed"
  fi

  echo ""
  echo "========================================="
  echo "  Uninstall complete"
  echo "========================================="
  echo ""
}

# --- Check only ---
do_check() {
  echo ""
  echo "========================================="
  echo "  Dependency Status"
  echo "========================================="
  echo ""

  echo "  [System tools]"
  if node_ok; then
    pass "Node.js $(node -v)"
  else
    fail "Node.js 20+ — NOT installed"
  fi

  if python3_ok; then
    pass "Python $(python3 --version 2>&1 | awk '{print $2}')"
  else
    fail "Python 3 — NOT installed"
  fi

  if ffmpeg_ok; then
    pass "ffmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')"
  else
    fail "ffmpeg — NOT installed"
  fi

  echo ""
  echo "  [npm packages]"
  if [ -f "$SCRIPT_DIR/node_modules/.package-lock.json" ]; then
    pass "npm dependencies"
  else
    fail "npm dependencies — NOT installed (run ./install.sh)"
  fi

  if node -e "require('express')" &>/dev/null; then
    pass "express"
  else
    fail "express — NOT found"
  fi

  echo ""
  echo "  [Python packages]"
  if edge_tts_ok; then
    pass "edge-tts"
  else
    fail "edge-tts — NOT installed"
  fi

  echo ""
  echo "========================================="
  local all_ok=true
  node_ok      || all_ok=false
  python3_ok   || all_ok=false
  ffmpeg_ok    || all_ok=false
  if $all_ok; then
    echo "  All system dependencies OK"
  else
    echo "  Some dependencies missing — run ./install.sh"
  fi
  echo "========================================="
  echo ""

  $all_ok
}

# --- Main ---
main() {
  echo ""
  echo "========================================="
  echo "  AI English Test Practice — Installer"
  echo "========================================="
  echo ""
  info "OS: $OS | Package manager: ${PKG:-none detected}"
  echo ""

  case "$MODE" in
    check)
      do_check ;;
    uninstall)
      do_uninstall ;;
    install)
      local failed=0

      install_node    || failed=1
      install_python  || failed=1
      install_ffmpeg  || failed=1

      echo ""
      info "Installing project dependencies..."
      install_npm_deps  || failed=1
      install_edge_tts  || failed=1

      if [ "$failed" -eq 1 ]; then
        echo ""
        echo "========================================="
        echo "  Installation completed with errors"
        echo "========================================="
        echo ""
        exit 1
      fi

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
      ;;
  esac
}

main
