@echo off
cd D:\AntigravityData\scratch\toeic-v0.3.0
start "Server" cmd /k "node server.js"
timeout /t 3 /nobreak >nul
start "Vite" cmd /k "npx vite --host"
echo Services started
pause