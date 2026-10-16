@echo off
setlocal enableextensions
cd /d "%~dp0"

set "PORT="
for %%P in (8123 5173 5500 8081 9000 8080) do (
  if not defined PORT (
    powershell -NoProfile -Command "try{$l=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,%%P);$l.Start();$l.Stop();exit 0}catch{exit 1}" >nul 2>nul
    if not errorlevel 1 set "PORT=%%P"
  )
)
if not defined PORT (
  for /l %%I in (1,1,10) do (
    if not defined PORT (
      set /a TRY=40000+%RANDOM%%%% 10000
      powershell -NoProfile -Command "...test !TRY!..." && set "PORT=!TRY!"
    )
  )
)
if not defined PORT ( echo No free port found. & pause & exit /b 1 )

start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 1; Start-Process 'http://localhost:%PORT%/'"
echo APEX GP -> http://localhost:%PORT%/
where python >nul 2>nul && ( python -m http.server %PORT% --bind 127.0.0.1 & exit /b 0 )
where py     >nul 2>nul && ( py -m http.server %PORT% --bind 127.0.0.1 & exit /b 0 )
npx --yes serve -l %PORT% .