@echo off
cd /d %~dp0
set PYTHON=%~dp0..\.venv\Scripts\python.exe
if not exist "%PYTHON%" (
  echo Could not find venv Python at %PYTHON%
  echo Create the venv in the repo root folder first.
  exit /b 1
)
"%PYTHON%" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
