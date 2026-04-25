@echo off
TITLE TOEIC Pilot v0.3.1 Standalone Launcher

echo ========================================================
echo TOEIC AI Engine v0.3.1 - Standalone Environment
echo ========================================================
echo.
echo Installing internal dependencies (if necessary)...
call npm install --silent

echo.
echo Starting Backend API (Localhost:3001)...
start "TOEIC AI Backend" cmd /c "node server.js"

echo Starting Frontend UI (Localhost:5173)...
timeout /t 2 >nul
start "TOEIC AI Frontend" cmd /c "npm run dev -- --open"

echo.
echo Standalone cluster running successfully. 
echo - Close this window to terminate the launcher.
pause
