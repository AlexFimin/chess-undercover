@echo off
cd /d "C:\Open Code Projects\cid"
start "Chess Server" cmd /k "npx tsx server/index.ts"
timeout /t 2 /nobreak >nul
start "Chess Vite" cmd /k "npx vite --host 0.0.0.0 --port 5173"
echo Servers started!
