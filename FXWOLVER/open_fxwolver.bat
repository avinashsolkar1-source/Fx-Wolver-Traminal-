@echo off
TITLE FXWOLVER Terminal
echo ========================================================
echo        Starting FXWOLVER Multi-Market Terminal
echo ========================================================
echo.

cd /d "%~dp0"

echo Launching FXWOLVER Server on http://localhost:3000...
start "" "http://localhost:3000"
node server.js

pause
