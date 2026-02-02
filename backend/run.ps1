Set-Location $PSScriptRoot

$python = Join-Path (Resolve-Path "..\.venv\Scripts") "python.exe"
if (-not (Test-Path $python)) {
  Write-Error "Could not find venv Python at $python. Create the venv in the repo root first."
  exit 1
}

& $python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
