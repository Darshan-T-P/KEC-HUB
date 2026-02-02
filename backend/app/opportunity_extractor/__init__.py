"""Deterministic (non-AI) opportunity extraction.

Goal:
- Fetch opportunities from configured sources
- Filter out closed/expired/old items
- Rank by student profile (department/skills/interests)

This module intentionally avoids LLM prompting/search.
"""
