@echo off
rem Builds the Zaal installer into V:\Zaal\dist
rem Needs admin once so Windows lets the icon tool unpack (symlink privilege), so it re-opens itself as admin.
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
rem The mirrors are here because GitHub downloads fail on some networks.
set ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/
set ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/
cd /d %~dp0
call npm install
call npm run dist
pause
