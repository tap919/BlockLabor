@echo off
title Megacode Full-Stack System
color 0B

echo.
echo  =============================================
echo         🔮  MEGACODE  FULL-STACK  SYSTEM
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

:: ── Auto-discover and load MCP servers ───────────────────────
echo  [MCP] Discovering and loading MCP servers...
node mcp-autoloader.js
if %errorlevel% neq 0 (
    echo  [WARN] MCP auto-loader had issues, continuing anyway...
)
echo.

:: ── Start the UI server ───────────────────────────────────────
echo  [START] Starting Megacode Full-Stack System...
echo.
echo  ┌─────────────────────────────────────────┐
echo  │  Open your browser at:                  │
echo  │  http://localhost:3000                  │
echo  │                                         │
echo  │  Features:                              │
echo  │  • Voice chat with Voicebox             │
echo  │  • Game/animation tools                 │
echo  │  • Business logic & backend             │
echo  │  • Project assessment on open           │
echo  │  • Full-stack workflow sequence         │
echo  │                                         │
echo  │  Press Ctrl+C to stop the system        │
echo  └─────────────────────────────────────────┘
echo.

:: Open browser after short delay (background task)
start /b cmd /c "timeout /t 3 >nul && start http://localhost:3000"

:: Start the server (blocking)
node ui\server.js

echo.
echo  [STOPPED] Megacode Full-Stack System has stopped.
pause