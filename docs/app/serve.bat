@echo off
REM 本地起静态服务器打开 3D 演示。ES Module 不能走 file:// 直接双击打开，必须过 http。
REM 以 docs/ 为根启动，页面以 ./data/experiments.json 相对路径取清单。
set PY="D:\DSH-apps\DS bot\resources\primary-runtime\dependencies\python\python.exe"
cd /d "%~dp0.."
start "" http://127.0.0.1:8765/app/index.html
%PY% -m http.server 8765 --bind 127.0.0.1
