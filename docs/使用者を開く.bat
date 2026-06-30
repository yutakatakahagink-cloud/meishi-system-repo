@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\start-meishi.ps1" -StartPage user.html
pause
