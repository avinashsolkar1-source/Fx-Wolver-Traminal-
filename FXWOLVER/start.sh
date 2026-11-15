#!/usr/bin/env bash
echo "========================================================"
echo "       FXWOLVER — Starting Development Servers"
echo "========================================================"
echo ""

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Start Backend
echo "[1/2] Starting Backend (FastAPI)..."
cd "$DIR/backend"
if [ -d "venv" ]; then
    source venv/bin/activate
fi
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start Frontend
echo "[2/2] Starting Frontend (Vite)..."
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo "FXWOLVER running!"
echo "  Frontend : http://localhost:5173"
echo "  Backend  : http://localhost:8000/docs"
echo "Press Ctrl+C to shut down both servers."
echo "========================================================"

trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM
wait
