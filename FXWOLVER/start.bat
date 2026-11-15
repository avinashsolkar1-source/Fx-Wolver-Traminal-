@echo off
TITLE FXWOLVER — MT5-Style Trading Terminal
echo ========================================================
echo        FXWOLVER — Starting Development Servers
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Launching FXWOLVER Backend (FastAPI)...
start "FXWOLVER Backend" cmd /k "cd backend && if exist venv\Scripts\activate (call venv\Scripts\activate) && uvicorn app.main:app --reload --port 8000"

echo [2/2] Launching FXWOLVER Frontend (React + Vite)...
start "FXWOLVER Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo FXWOLVER is starting up!
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000/docs
echo ========================================================
echo.
