@echo off
chcp 65001 >nul
title 名刺印刷 起動
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-meishi.ps1"
echo.
pause
