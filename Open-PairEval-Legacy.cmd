@echo off
cd /d "%~dp0"
curl.exe --silent --fail --max-time 2 http://localhost:3100/api/health >nul 2>&1
if %errorlevel% equ 0 (
  start "" "http://localhost:3100"
  exit /b 0
)
if not exist "node_modules\next\package.json" (
  echo Dependencies are missing. Run npm ci in this folder first.
  pause
  exit /b 1
)
if not exist ".next\BUILD_ID" (
  echo The verified build is missing. Run npm run build first.
  pause
  exit /b 1
)
if not exist "data\demo.sqlite" (
  echo The prepared demo database is missing. No reset was performed.
  pause
  exit /b 1
)
echo PairEval local Demo: http://localhost:3100
echo Keep this window open while presenting. Press Ctrl+C to stop.
start "" "http://localhost:3100"
call npm run start -- -p 3100 -H 127.0.0.1
