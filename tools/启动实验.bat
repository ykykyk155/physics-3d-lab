@echo off
rem Local launcher: starts a 127.0.0.1 static server and opens the browser.
rem Works offline. Needs nothing but Windows PowerShell (built into Windows).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-lab.ps1" -Root "%~dp0"
if errorlevel 1 pause