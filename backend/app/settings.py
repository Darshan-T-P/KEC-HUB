from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_DIR = Path(__file__).resolve().parents[1]
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # Load backend/.env no matter where uvicorn is launched from.
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    cors_origins: str = "http://localhost:3000"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "kec_opportunities_hub"

    otp_ttl_seconds: int = 600
    otp_min_resend_seconds: int = 60
    otp_max_sends_per_hour: int = 5

    otp_provider: str = "console"  # console | smtp

    # General notification emails (referral requests etc)
    notify_provider: str = "console"  # console | smtp

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "KEC Opportunities Hub <no-reply@localhost>"
    smtp_use_tls: bool = True

    # Deterministic opportunity extraction (non-AI)
    opp_max_results: int = 25
    opp_max_age_days: int = 21
    opp_rss_feeds: str = ""  # comma-separated RSS/Atom feed URLs

    # India job source (Adzuna) - optional
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    opp_country: str = "IN"  # IN | any
    opp_include_remote: bool = True
    opp_exclude_senior: bool = True

    # Company career pages via common ATS public APIs
    lever_companies: str = ""  # comma-separated Lever company shortnames
    greenhouse_boards: str = ""  # comma-separated Greenhouse board tokens
    smartrecruiters_companies: str = ""  # comma-separated SmartRecruiters company ids

    # Optional Groq (AI-assisted query expansion; does not scrape)
    groq_api_key: str = ""
    groq_model: str = ""
    groq_timeout_s: float = 8.0
    groq_max_queries: int = 6

    # Optional: Web search (to discover exact job links)
    # NOTE: API keys must stay on the backend (never in the frontend).
    # Provider values: "none" | "serpapi" | "google_cse"
    web_search_provider: str = "none"
    serpapi_api_key: str = ""
    google_cse_api_key: str = ""
    google_cse_cx: str = ""
    opp_web_search_max_queries: int = 3
    opp_web_search_results_per_query: int = 8
    # Optional allowlist of domains (comma-separated). Empty means allow all (minus basic spam filters).
    opp_web_search_allowed_domains: str = ""

    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def opp_rss_feed_list(self) -> List[str]:
        return [u.strip() for u in self.opp_rss_feeds.split(",") if u.strip()]

    def lever_company_list(self) -> List[str]:
        return [c.strip() for c in self.lever_companies.split(",") if c.strip()]

    def greenhouse_board_list(self) -> List[str]:
        return [b.strip() for b in self.greenhouse_boards.split(",") if b.strip()]

    def smartrecruiters_company_list(self) -> List[str]:
        return [c.strip() for c in self.smartrecruiters_companies.split(",") if c.strip()]

    def opp_web_search_allowed_domain_list(self) -> List[str]:
        return [d.strip().lower() for d in self.opp_web_search_allowed_domains.split(",") if d.strip()]


settings = Settings()
