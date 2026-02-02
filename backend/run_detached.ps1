param(
  [switch]$Reload
)

Set-Location $PSScriptRoot

$python = Join-Path (Resolve-Path "..\.venv\Scripts") "python.exe"
if (-not (Test-Path $python)) {
  Write-Error "Could not find venv Python at $python. Create the venv in the repo root first."
  exit 1
}

$pidFile = Join-Path $PSScriptRoot ".uvicorn.pid"
$logFile = Join-Path $PSScriptRoot "uvicorn.log"
$errFile = Join-Path $PSScriptRoot "uvicorn.err.log"

$port = 8000

$existingListen = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingListen) {
  Write-Host "Port $port is already in use (PID $($existingListen.OwningProcess))."
  Write-Host "Stop it first (or run: .\\stop_detached.ps1 if it was started by this repo)."
  exit 1
}

if (Test-Path $pidFile) {
  try {
    $existingPid = Get-Content $pidFile -ErrorAction Stop | Select-Object -First 1
    if ($existingPid) {
      $p = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
      if ($p) {
        Write-Host "Uvicorn appears to already be running (PID $existingPid)."
        Write-Host "Log: $logFile"
        exit 0
      }
    }
  } catch {
    # ignore
  }
}

$args = @('-m','uvicorn','app.main:app','--host','0.0.0.0','--port',"$port")
if ($Reload) {
  $args += '--reload'
}

try {
  $proc = Start-Process -FilePath $python -ArgumentList $args -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru -ErrorAction Stop
} catch {
  Write-Error $_
  exit 1
}

 $listenPid = $null
 for ($i = 0; $i -lt 20; $i++) {
   Start-Sleep -Milliseconds 250
   $listen = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
   if ($listen) {
     $listenPid = $listen.OwningProcess
     break
   }
 }

 if ($listenPid) {
   Set-Content -Path $pidFile -Value $listenPid
   Write-Host "Started Uvicorn (PID $listenPid)."
 } else {
   # Fallback: store the Start-Process PID, even if we couldn't detect the listener yet.
   Set-Content -Path $pidFile -Value $proc.Id
   Write-Host "Started Uvicorn (PID $($proc.Id))."
 }

Write-Host "Log: $logFile"
Write-Host "Err: $errFile"
Write-Host "Stop: .\\stop_detached.ps1" 
