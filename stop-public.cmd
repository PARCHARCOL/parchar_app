@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\stop-public.ps1"
pause
