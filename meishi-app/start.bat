@echo off
rem 名刺印刷ソフト ローカル起動（http://127.0.0.1:8791/）
cd /d "%~dp0public"
echo ブラウザで http://127.0.0.1:8791/ を開いてください。
python -m http.server 8791
pause
