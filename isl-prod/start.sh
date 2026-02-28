#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  ISL NMF Detector v2.0 — Production-grade launch script
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_LOG="$ROOT/backend.log"
BACKEND_PID_FILE="$ROOT/.backend.pid"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ISL Non-Manual Features Detector  v2.0              ║${NC}"
echo -e "${CYAN}║  Detection of Non-Manual Features in ISL Sentences   ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisites ────────────────────────────────────────────────────
command -v python3 &>/dev/null || error "Python 3.9+ required. Install from python.org"
command -v node    &>/dev/null || error "Node.js 16+ required. Install from nodejs.org"
PYVER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
NODE_VER=$(node --version)
info "Python $PYVER | Node $NODE_VER"

# ── Stop old backend if running ──────────────────────────────────────
if [ -f "$BACKEND_PID_FILE" ]; then
  OLD_PID=$(cat "$BACKEND_PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    info "Stopping old backend (PID $OLD_PID)…"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$BACKEND_PID_FILE"
fi

# ── Backend setup ────────────────────────────────────────────────────
info "Setting up backend…"
cd "$ROOT/backend"

if [ ! -d "venv" ]; then
  info "Creating Python virtual environment…"
  python3 -m venv venv
fi
source venv/bin/activate

info "Installing backend dependencies…"
pip install --upgrade pip -q
pip install -r requirements.txt -q
success "Backend dependencies installed."

# ── Copy env if missing ──────────────────────────────────────────────
if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  warn "Created .env from template. Edit $ROOT/.env to set SECRET_KEY and JWT_SECRET."
fi

# ── Launch backend ───────────────────────────────────────────────────
info "Starting backend on http://localhost:5000 …"
BACKEND_CMD="python app.py"
nohup $BACKEND_CMD > "$BACKEND_LOG" 2>&1 &
echo $! > "$BACKEND_PID_FILE"
BACKEND_PID=$(cat "$BACKEND_PID_FILE")
success "Backend started (PID $BACKEND_PID). Log: $BACKEND_LOG"

# Wait for backend to be ready
info "Waiting for backend…"
for i in {1..20}; do
  if curl -sf http://localhost:5000/api/health >/dev/null 2>&1; then
    success "Backend is ready."
    break
  fi
  sleep 1
  if [ $i -eq 20 ]; then
    warn "Backend may still be initializing. Check $BACKEND_LOG"
  fi
done

# ── Frontend setup ───────────────────────────────────────────────────
info "Setting up frontend…"
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  info "Installing npm packages (first time, may take 1-2 min)…"
  npm install --legacy-peer-deps 2>&1 | tail -5
fi
success "Frontend dependencies ready."

# ── Launch frontend ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}🚀 Starting frontend at http://localhost:3000${NC}"
echo ""
echo -e "   Backend:  ${CYAN}http://localhost:5000${NC}"
echo -e "   Frontend: ${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "   Press ${YELLOW}Ctrl+C${NC} to stop"
echo ""

# Cleanup on exit
cleanup() {
  echo ""
  info "Stopping backend…"
  if [ -f "$BACKEND_PID_FILE" ]; then
    kill $(cat "$BACKEND_PID_FILE") 2>/dev/null || true
    rm -f "$BACKEND_PID_FILE"
  fi
  success "Stopped."
}
trap cleanup EXIT INT TERM

REACT_APP_API_URL=http://localhost:5000 npm start
