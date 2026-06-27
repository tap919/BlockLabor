@echo off
setlocal EnableDelayedExpansion
title Megacode — Setup & Build

:: ============================================================
::  Megacode Engine — Windows Setup Script
::  Handles: npm install, TypeScript build (tsc)
:: ============================================================

set "SCRIPT_DIR=%~dp0"
set "DIST_DIR=%SCRIPT_DIR%dist"
set "SRC_INDEX=%SCRIPT_DIR%src\index.ts"
set "TSCONFIG=%SCRIPT_DIR%tsconfig.json"

:: ANSI colors (Win 10+)
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "CYAN=[36m"
set "BOLD=[1m"
set "RESET=[0m"

cls
echo.
echo %BOLD%%CYAN%  ============================================================%RESET%
echo %BOLD%%CYAN%   Megacode Engine  ^|  Multi-LLM Coding Assistant%RESET%
echo %BOLD%%CYAN%   Setup ^& Build%RESET%
echo %BOLD%%CYAN%  ============================================================%RESET%
echo.

:: ── Step 1: Check Node.js ─────────────────────────────────────
echo %CYAN%[1/5] Checking Node.js...%RESET%

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo %RED%  [ERROR] Node.js not found.%RESET%
    echo %YELLOW%  Install from: https://nodejs.org/  ^(LTS version recommended^)%RESET%
    echo %YELLOW%  Make sure to check "Add to PATH" during install.%RESET%
    pause
    exit /b 1
)

for /f "tokens=*" %%V in ('node --version 2^>^&1') do set NODE_VER=%%V
echo %GREEN%  [OK] Node.js %NODE_VER% found%RESET%

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo %RED%  [ERROR] npm not found. Reinstall Node.js from https://nodejs.org/%RESET%
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('npm --version 2^>^&1') do set NPM_VER=%%V
echo %GREEN%  [OK] npm %NPM_VER% found%RESET%

:: ── Step 2: Verify source files ───────────────────────────────
echo.
echo %CYAN%[2/5] Verifying source files...%RESET%

if not exist "%SRC_INDEX%" (
    echo %RED%  [ERROR] src\index.ts not found at: %SCRIPT_DIR%src%RESET%
    echo %YELLOW%  Make sure you are running this from the Megacode-main directory.%RESET%
    pause
    exit /b 1
)
echo %GREEN%  [OK] src\index.ts found%RESET%

if not exist "%TSCONFIG%" (
    echo %RED%  [ERROR] tsconfig.json not found at: %SCRIPT_DIR%%RESET%
    pause
    exit /b 1
)
echo %GREEN%  [OK] tsconfig.json found%RESET%

if not exist "%SCRIPT_DIR%package.json" (
    echo %RED%  [ERROR] package.json not found at: %SCRIPT_DIR%%RESET%
    pause
    exit /b 1
)
echo %GREEN%  [OK] package.json found%RESET%

:: ── Step 3: Install dependencies ─────────────────────────────
echo.
echo %CYAN%[3/5] Installing dependencies...%RESET%

if exist "%SCRIPT_DIR%node_modules\typescript" (
    echo %GREEN%  [OK] node_modules already installed ^(found typescript^)%RESET%
) else (
    echo %YELLOW%  Running: npm install%RESET%
    echo %YELLOW%  ^(Installs TypeScript, Jest, ws, monaco-editor, esbuild...^)%RESET%
    pushd "%SCRIPT_DIR%"
    call npm install --no-audit --no-fund --loglevel=error
    if %ERRORLEVEL% neq 0 (
        echo %RED%  [ERROR] npm install failed. Check your internet connection.%RESET%
        pause
        exit /b 1
    )
    echo %GREEN%  [OK] Dependencies installed%RESET%
    popd
)

:: Verify tsc is available
if not exist "%SCRIPT_DIR%node_modules\.bin\tsc.cmd" (
    echo %RED%  [ERROR] tsc not found in node_modules\.bin%RESET%
    echo %YELLOW%  Try: npm install typescript --save-dev%RESET%
    pause
    exit /b 1
)

for /f "tokens=*" %%V in ('"%SCRIPT_DIR%node_modules\.bin\tsc.cmd" --version 2^>^&1') do set TSC_VER=%%V
echo %GREEN%  [OK] %TSC_VER% available%RESET%

:: ── Step 4: Build TypeScript → JavaScript ────────────────────
echo.
echo %CYAN%[4/5] Building TypeScript library...%RESET%
echo %YELLOW%  Compiling src\ ^-^> dist\ ...%RESET%
echo.

pushd "%SCRIPT_DIR%"

:: Run tsc build via npm script
call npm run build 2>&1
set BUILD_RESULT=%ERRORLEVEL%

popd

if %BUILD_RESULT% neq 0 (
    echo.
    echo %RED%  [ERROR] TypeScript build failed.%RESET%
    echo.
    echo %YELLOW%  Common causes:%RESET%
    echo %YELLOW%    - Type errors in src\ files ^(check output above^)%RESET%
    echo %YELLOW%    - Missing @types packages%RESET%
    echo %YELLOW%    - Duplicate exports ^(see src\index.ts^)%RESET%
    echo.
    echo %YELLOW%  To diagnose:%RESET%
    echo     cd "%SCRIPT_DIR%"
    echo     npx tsc --noEmit
    echo.
    echo %YELLOW%  To skip type errors and force emit ^(not recommended^):%RESET%
    echo     npx tsc --noEmitOnError false
    echo.
    pause
    exit /b 1
)

:: Verify output
if not exist "%DIST_DIR%\index.js" (
    echo %RED%  [ERROR] Build completed but dist\index.js not found.%RESET%
    echo %YELLOW%         Check tsconfig.json outDir setting.%RESET%
    pause
    exit /b 1
)

echo %GREEN%  [OK] dist\index.js built successfully%RESET%

if exist "%DIST_DIR%\index.d.ts" (
    echo %GREEN%  [OK] dist\index.d.ts type declarations generated%RESET%
) else (
    echo %YELLOW%  [INFO] dist\index.d.ts not found ^(declaration: true not set in tsconfig^)%RESET%
)

:: ── Step 5: Done ──────────────────────────────────────────────
echo.
echo %BOLD%%GREEN%  ============================================================%RESET%
echo %BOLD%%GREEN%   Megacode Engine is built and ready.%RESET%
echo %BOLD%%GREEN%  ============================================================%RESET%
echo.
echo %CYAN%  Output files:%RESET%
echo     dist\index.js      ^(main library bundle^)
echo     dist\index.d.ts    ^(TypeScript declarations^)
echo.
echo %CYAN%  Usage in Street Code IDE:%RESET%
echo     The IDE uses the pre-bundled runtime at:
echo     products\street-code-ide\src\megacode\megacode-runtime.js
echo     ^(This file is already present and up to date^)
echo.
echo %CYAN%  Usage as a Node.js library:%RESET%
echo     const Megacode = require('./dist/index.js')
echo     const ctrl = Megacode.MegacodeController({ ... })
echo.
echo %CYAN%  Run tests:%RESET%
echo     npm test
echo.
echo %YELLOW%  Supported LLM providers ^(set API keys in IDE Settings^):%RESET%
echo     Ollama ^(local, free^) ^| OpenAI ^| Anthropic/Claude ^| DeepSeek
echo     Gemini ^| Grok ^| Perplexity ^| Mistral
echo.

set /p RUN_TESTS="  Run tests now? (Y/N): "
if /i "!RUN_TESTS!"=="Y" (
    echo.
    echo %CYAN%  Running tests...%RESET%
    echo.
    pushd "%SCRIPT_DIR%"
    call npm test 2>&1
    if %ERRORLEVEL% neq 0 (
        echo %YELLOW%  [WARN] Some tests failed ^(see above^). This may be OK in dev mode.%RESET%
    ) else (
        echo %GREEN%  [OK] All tests passed%RESET%
    )
    popd
)

echo.
pause
endlocal
