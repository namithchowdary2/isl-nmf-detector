@echo off
title ISL NMF Detector v2.0

echo.
echo ============================================================
echo  ISL Non-Manual Features Detector  v2.0
echo  Detection of Non-Manual Features in ISL Sentences
echo ============================================================
echo.

REM Copy .env if missing
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo [WARN] Created .env from template. Edit it to set SECRET_KEY and JWT_SECRET.
)

REM ── Backend ──────────────────────────────────────────────────────────
cd /d "%~dp0backend"
if not exist venv (
    echo [INFO] Creating Python venv...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
echo [OK] Backend deps ready.

echo [INFO] Starting backend on http://localhost:5000
start "ISL Backend" /MIN cmd /k "venv\Scripts\activate && python app.py"
timeout /t 4 /nobreak >nul

REM ── Frontend ─────────────────────────────────────────────────────────
cd /d "%~dp0frontend"
if not exist node_modules (
    echo [INFO] Installing npm packages...
    npm install --legacy-peer-deps
)
echo [OK] Frontend deps ready.

echo.
echo [INFO] Starting frontend at http://localhost:3000
echo        Backend:  http://localhost:5000
echo        Frontend: http://localhost:3000
echo.

start "ISL Frontend" cmd /k "set REACT_APP_API_URL=http://localhost:5000 && npm start"

echo.
echo Both services are starting. The browser will open automatically.
echo Close the backend and frontend windows to stop.
echo.
pause
