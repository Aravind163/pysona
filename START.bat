@echo off
echo ============================================
echo   PYSONA - Setup and Start
echo ============================================
echo.

cd /d "%~dp0"

echo [1/4] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Backend npm install failed
    pause
    exit /b 1
)

echo.
echo [2/4] Installing frontend dependencies...
cd ..\frontend
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo ERROR: Frontend npm install failed
    pause
    exit /b 1
)

echo.
echo [3/4] Starting backend on http://localhost:5000 ...
cd ..\backend
start "Pysona Backend" cmd /k "npm run dev"

echo.
echo [4/4] Starting frontend on http://localhost:5173 ...
cd ..\frontend
start "Pysona Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo   Both servers are starting!
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:5173
echo ============================================
echo.
echo You can close this window.
timeout /t 3
