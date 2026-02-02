<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# KEC Opportunities Hub (Frontend + Backend)

This repo is now split into:

- `frontend/`: React + Vite UI
- `backend/`: FastAPI API (OTP send/verify)

## Run Locally

### 1) Frontend (React/Vite)

Prereqs: Node.js

1. Install deps: `npm --prefix frontend install`
2. Configure env: `frontend/.env.local`
   - `VITE_API_BASE_URL=http://localhost:8000`
   - `GEMINI_API_KEY=...` (optional; used by the existing Gemini features)
3. Start dev server: `npm run dev:frontend`

### 2) Backend (FastAPI)

Prereqs: Python 3.10+

1. Create env file: copy `backend/.env.example` to `backend/.env`
2. Install deps: `pip install -r backend/requirements.txt`
3. Start API:
   - `python -m uvicorn backend.app.main:app --reload --port 8000`

If you prefer, you can also run it from the `backend/` folder:

- `cd backend`
- `python -m uvicorn app.main:app --reload --port 8000`

On Windows, if you have a repo-root venv at `.venv/`, you can run:

- `backend\\run.ps1` (PowerShell)
- `backend\\run.bat` (CMD)

If you want the backend to keep running even while you run other commands in the same terminal, use:

- `backend\\run_detached.ps1` (starts Uvicorn detached; writes logs to `backend\\uvicorn.log`)
- `backend\\stop_detached.ps1` (stops the detached process)

To run with auto-reload:

- `backend\\run_detached.ps1 -Reload`

### MongoDB

Auth and OTP are stored in MongoDB. Start MongoDB locally or set `MONGODB_URI` to an Atlas connection string in `backend/.env`.

The OTP endpoints are:

- `POST /auth/send-otp`
- `POST /auth/verify-otp`

### Optional: Groq-assisted matching (no scraping)

The realtime opportunity extractor can optionally use Groq to generate better short search queries based on a student's profile.
This improves relevance for fresher/intern roles, but it does **not** crawl/scrape websites.

Set in `backend/.env`:

- `GROQ_API_KEY=...`
- `GROQ_MODEL=llama-3.1-8b-instant` (or any Groq-supported chat model)
