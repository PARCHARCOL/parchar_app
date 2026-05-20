@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\start-public.ps1"
echo.
if exist ".runtime\public-url.txt" (
  echo URL publica:
  type ".runtime\public-url.txt"
)
pause
