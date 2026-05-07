@echo off
echo Starting Pysona servers...
cd /d "%~dp0"

start "Pysona Backend" cmd /k "cd backend && npm run dev"
timeout /t 2 /nobreak >nul
start "Pysona Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo Both windows opened. Close this one.
timeout /t 3
