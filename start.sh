#!/bin/bash
# Quick start (run after setup.sh has already been run once)

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

ROOT="$(dirname "$0")"

echo "🚀 Starting Connectly..."
echo "   Frontend → http://localhost:5173"
echo "   Backend  → http://localhost:3001"
echo ""

lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

cd "$ROOT/backend" && npm run dev &
BACKEND_PID=$!

cd "$ROOT/frontend" && npm run dev &
FRONTEND_PID=$!

sleep 3
open "http://localhost:5173" 2>/dev/null || true

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID
