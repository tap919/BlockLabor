@echo off
title Megacode UI
color 0B

echo.
echo  =============================================
echo         ^_^  MEGACODE  ^_^   AI Coding Assistant
echo  =============================================
echo.

:: ── Check Node.js ────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER% detected
echo.

:: ── Move to project root ──────────────────────────────────────
cd /d "%~dp0"

:: ── Install dependencies if node_modules is missing ──────────
if not exist "node_modules\" (
    echo  [SETUP] Installing dependencies...
    call npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo  [OK] Dependencies installed.
    echo.
)

:: ── Install esbuild if not present ───────────────────────────
if not exist "node_modules\esbuild\" (
    echo  [SETUP] Installing esbuild...
    call npm install --save-dev esbuild --no-audit --no-fund
    echo  [OK] esbuild installed.
    echo.
)

:: ── Install express if not present ───────────────────────────
if not exist "node_modules\express\" (
    echo  [SETUP] Installing express...
    call npm install express --save --no-audit --no-fund
    echo  [OK] express installed.
    echo.
)

:: ── Build the Megacode bundle ─────────────────────────────────
echo  [BUILD] Bundling Megacode core (esbuild)...
call npm run esbuild:build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Build failed. Check the output above for details.
    pause
    exit /b 1
)
echo  [OK] Build complete.
echo.

:: ── Start the UI server ───────────────────────────────────────
echo  [START] Starting Megacode UI server...
echo.
echo  ┌─────────────────────────────────────────┐
echo  │  Open your browser at:                  │
echo  │  http://localhost:3000                  │
echo  │                                         │
echo  │  Press Ctrl+C to stop the server        │
echo  └─────────────────────────────────────────┘
echo.

:: Open browser after short delay (background task)
start /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"

:: Start the server (blocking)
node ui\server.js

echo.
echo  [STOPPED] Megacode UI server has stopped.
pause
