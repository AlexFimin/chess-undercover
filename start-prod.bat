@echo off
cd /d "C:\Open Code Projects\cid"
echo Building client...
call npx vite build
echo Starting production server...
start "Chess Prod" cmd /k "npx tsx server/index.ts"
echo Production server starting on http://localhost:3001
