Set-Location $PSScriptRoot

$pidFile = Join-Path $PSScriptRoot ".uvicorn.pid"
if (-not (Test-Path $pidFile)) {
  Write-Host "No PID file found ($pidFile). Nothing to stop."
  exit 0
}

$pidRaw = Get-Content $pidFile | Select-Object -First 1
if (-not $pidRaw) {
  Remove-Item $pidFile -ErrorAction SilentlyContinue
  Write-Host "PID file was empty. Removed."
  exit 0
}

$pid = [int]$pidRaw
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
if ($proc) {
  cmd /c "taskkill /PID $pid /F" | Out-Null
  Write-Host "Stopped process PID $pid."
} else {
  Write-Host "Process PID $pid not found (already stopped)."
}

# If something is still listening on port 8000, stop it as well.
$listen = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listen) {
  $listenPid = $listen.OwningProcess
  if ($listenPid -and ($listenPid -ne $pid)) {
    $p2 = Get-Process -Id $listenPid -ErrorAction SilentlyContinue
    if ($p2) {
      cmd /c "taskkill /PID $listenPid /F" | Out-Null
      Write-Host "Stopped listener PID $listenPid (port 8000)."
    }
  }
}

Remove-Item $pidFile -ErrorAction SilentlyContinue
