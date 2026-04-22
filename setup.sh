#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}${BOLD}║       Connectly — WhatsApp Platform      ║${NC}"
  echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo ""
}

print_step() { echo -e "${CYAN}${BOLD}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err()  { echo -e "${RED}✗ $1${NC}"; }

print_header

# ──────────────────────────────────────────────
# 1. Install Node.js via NVM if not present
# ──────────────────────────────────────────────
print_step "Checking for Node.js..."

if ! command -v node &>/dev/null; then
  print_warn "Node.js not found. Installing via NVM..."

  # Install NVM
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    print_step "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi

  # Load NVM
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

  print_step "Installing Node.js 20 LTS..."
  nvm install 20
  nvm use 20
  nvm alias default 20
  print_ok "Node.js $(node --version) installed"
else
  # Load NVM if it exists (so npm is in path)
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  print_ok "Node.js $(node --version) already installed"
fi

# Verify npm
if ! command -v npm &>/dev/null; then
  print_err "npm not found even after Node install. Please install Node.js manually from https://nodejs.org"
  exit 1
fi
print_ok "npm $(npm --version)"

# ──────────────────────────────────────────────
# 2. Install backend dependencies
# ──────────────────────────────────────────────
print_step "Installing backend dependencies..."
cd "$(dirname "$0")/backend"
npm install --silent
print_ok "Backend dependencies installed"

# ──────────────────────────────────────────────
# 3. Setup database
# ──────────────────────────────────────────────
print_step "Setting up database..."
npx prisma generate --silent
npx prisma db push --skip-generate
print_ok "Database ready (SQLite)"

print_step "Seeding demo data..."
npx ts-node src/seed.ts 2>/dev/null || true
print_ok "Demo data seeded"

# ──────────────────────────────────────────────
# 4. Install frontend dependencies
# ──────────────────────────────────────────────
print_step "Installing frontend dependencies..."
cd "$(dirname "$0")/../frontend"
npm install --silent
print_ok "Frontend dependencies installed"

# ──────────────────────────────────────────────
# 5. Start the app
# ──────────────────────────────────────────────
cd "$(dirname "$0")/.."

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ Setup complete! Starting Connectly...${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC} http://localhost:5173"
echo -e "  ${BOLD}Backend:${NC}  http://localhost:3001"
echo ""
echo -e "  ${BOLD}Demo login:${NC}"
echo -e "  Email:    admin@connectly.app"
echo -e "  Password: admin123"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Kill any existing processes on those ports
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start backend
cd backend
NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm run dev &
BACKEND_PID=$!

# Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Wait and open browser
sleep 3
open "http://localhost:5173" 2>/dev/null || xdg-open "http://localhost:5173" 2>/dev/null || true

# Handle Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Stopped.'; exit 0" INT TERM

wait $BACKEND_PID $FRONTEND_PID
