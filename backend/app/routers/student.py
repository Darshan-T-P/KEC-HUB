import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query
from ..models import (
    OpportunitiesResponse, 
    OpportunityItem, 
    UserRole, 
    ResumeAnalysisResponse, 
    ResumeAnalysisResult, 
    ResumeImprovement,
    StudentPlacementStatusResponse,
    StudentRoundStatus
)
from ..deps import get_user_repo, get_opportunity_extractor, get_resume_analyzer, get_current_user, get_placement_repo
from ..database.db import mongodb_ok
from ..opportunity_extractor.types import ProfileSignals
from ml.predict import recommend

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

try:
    from pdfminer.high_level import extract_text as _pdfminer_extract_text
except Exception:
    _pdfminer_extract_text = None

router = APIRouter(tags=["student"])

def _is_allowed_domain(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in {"kongu.edu", "kongu.ac.in"}

def _to_opportunity_item(op) -> OpportunityItem:
    deadline = op.deadline.isoformat() if op.deadline else None
    posted = op.published_at.date().isoformat() if op.published_at else None

    return OpportunityItem(
        id=f"rt-{op.id}",
        title=op.title,
        company=op.company or "",
        type=op.kind,
        source=getattr(op, "source", ""),
        matchMethod=getattr(op, "match_method", None),
        deadline=deadline,
        description=op.excerpt or "",
        tags=op.tags or [],
        location=op.location or "",
        postedDate=posted,
        eligibility="See source page",
        requirements=[],
        sourceUrl=op.source_url,
        score=op.score,
        reasons=op.reasons or [],
    )

def _extract_resume_text_pdf(data: bytes) -> str:
    if not data:
        return ""

    def _clean(text: str) -> str:
        text = (text or "").replace("\x00", " ")
        text = "\n".join([line.rstrip() for line in text.splitlines()])
        return text.strip()

    extracted = ""
    if PdfReader is not None:
        try:
            reader = PdfReader(io.BytesIO(data))
            parts: list[str] = []
            for page in reader.pages:
                try:
                    txt = page.extract_text() or ""
                except Exception:
                    txt = ""
                if txt:
                    parts.append(txt)
            extracted = _clean("\n\n".join(parts))
        except Exception:
            extracted = ""

    if (not extracted or len(extracted) < 30) and _pdfminer_extract_text is not None:
        try:
            extracted2 = _pdfminer_extract_text(io.BytesIO(data)) or ""
            extracted2 = _clean(extracted2)
            if len(extracted2) > len(extracted):
                extracted = extracted2
        except Exception:
            pass
    return extracted

def _safe_str_list(v) -> list[str]:
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for item in v:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out

def _to_resume_analysis_result(obj: dict) -> ResumeAnalysisResult:
    improvements_raw = obj.get("improvements")
    improvements: list[ResumeImprovement] = []
    if isinstance(improvements_raw, list):
        for it in improvements_raw:
            if not isinstance(it, dict):
                continue
            area = (it.get("area") or "").strip()
            rec = (it.get("recommendation") or "").strip()
            ex = it.get("example")
            ex_s = ex.strip() if isinstance(ex, str) and ex.strip() else None
            if area and rec:
                improvements.append(ResumeImprovement(area=area, recommendation=rec, example=ex_s))

    score = obj.get("overallFitScore")
    try:
        score_i = int(score)
    except Exception:
        score_i = 0
    score_i = max(0, min(100, score_i))

    suggested_summary = obj.get("suggestedSummary")
    if not isinstance(suggested_summary, str):
        suggested_summary = None
    else:
        suggested_summary = suggested_summary.strip() or None

    final_feedback = obj.get("finalFeedback")
    if not isinstance(final_feedback, str):
        final_feedback = None
    else:
        final_feedback = final_feedback.strip() or None

    return ResumeAnalysisResult(
        overallFitScore=score_i,
        strengths=_safe_str_list(obj.get("strengths")),
        gaps=_safe_str_list(obj.get("gaps")),
        improvements=improvements,
        missingKeywords=_safe_str_list(obj.get("missingKeywords")),
        suggestedSummary=suggested_summary,
        suggestedBullets=_safe_str_list(obj.get("suggestedBullets")),
        atsWarnings=_safe_str_list(obj.get("atsWarnings")),
        finalFeedback=final_feedback,
    )

@router.get("/opportunities/realtime/{email}", response_model=OpportunitiesResponse)
async def realtime_opportunities(
    email: str, 
    role: UserRole = "student", 
    user_repo=Depends(get_user_repo),
    extractor=Depends(get_opportunity_extractor),
    current_user: dict = Depends(get_current_user)
) -> OpportunitiesResponse:
    if current_user.get("email") != email:
        raise HTTPException(status_code=403, detail="Not authorized to access these opportunities.")
    if not _is_allowed_domain(email):
        return OpportunitiesResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return OpportunitiesResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    user_doc = await user_repo.find_public_by_email_and_role(email, role)
    if user_doc is None:
        return OpportunitiesResponse(success=False, message="User not found.")

    profile = user_doc.get("profile") or {}
    signals = ProfileSignals(
        email=user_doc.get("email"),
        department=user_doc.get("department", "Computer Science"),
        skills=list(profile.get("skills") or []),
        interests=list(profile.get("interests") or []),
    )

    try:
        ops, meta = await extractor.extract_with_meta(signals)
        groq_enabled = bool(getattr(extractor, "groq_enabled", False))
        groq_used = any("groq" in str(getattr(o, "match_method", "") or "").lower() for o in ops)

        web_meta = (meta or {}).get("web") or {}

        # Integrate ML Recommendation with real profile data
        profile = user_doc.get("profile") or {}
        student_data = {
            "skills": profile.get("skills") or signals.skills,
            "branch": signals.department,
            "year": profile.get("year", 3), 
            "resume_score": profile.get("resume_score", 0.7)
        }
        
        opp_data = [{
            "id": f"rt-{o.id}",
            "required_skills": o.tags or [],
            "branch": signals.department,
            "min_year": 1
        } for o in ops]
        
        recommendations = recommend(student_data, opp_data)
        recommendations_map = {r["opportunity_id"]: r for r in recommendations}

        def _enhance_with_ml(item: OpportunityItem):
            rec = recommendations_map.get(item.id)
            if rec:
                item.score = rec["score"]
                item.reasons = list(set((item.reasons or []) + rec["why_recommended"]))
            return item

        print(f"Extractor found {len(ops)} opportunities.")
        enhanced_ops = [_enhance_with_ml(_to_opportunity_item(o)) for o in ops]
        print(f"Enhanced {len(enhanced_ops)} opportunities.")
        # Re-sort based on new ML score
        enhanced_ops.sort(key=lambda x: x.score, reverse=True)

        return OpportunitiesResponse(
            success=True,
            message="ok",
            opportunities=enhanced_ops,
            generatedAt=datetime.now(timezone.utc).isoformat(),
            groqEnabled=groq_enabled,
            groqUsed=groq_used,
            webSearchEnabled=bool(web_meta.get("enabled")),
            webSearchProvider=str(web_meta.get("provider")) if web_meta.get("provider") else None,
            webSearchUsed=bool(web_meta.get("used")),
            webSearchError=str(web_meta.get("error")) if web_meta.get("error") else None,
        )
    except Exception as e:
        print(f"Extraction error: {str(e)}")
        # Log stack trace if possible
        import traceback
        traceback.print_exc()
        return OpportunitiesResponse(success=False, message=f"Extraction error: {str(e)}")

@router.post("/resume/analyze", response_model=ResumeAnalysisResponse)
async def analyze_resume(
    email: str = Query(...),
    role: UserRole = Query("student"),
    jobDescription: str = Form(...),
    file: UploadFile = File(...),
    user_repo=Depends(get_user_repo),
    analyzer=Depends(get_resume_analyzer),
    current_user: dict = Depends(get_current_user)
) -> ResumeAnalysisResponse:
    if current_user.get("email") != email:
        raise HTTPException(status_code=403, detail="Not authorized to analyze resume for this profile.")
    if role != "student":
        return ResumeAnalysisResponse(success=False, message="Only students can use resume analysis.")

    user_doc = await user_repo.find_public_by_email_and_role(email, role)
    if not user_doc:
        return ResumeAnalysisResponse(success=False, message="User not found.")

    if analyzer is None:
        return ResumeAnalysisResponse(success=False, message="Groq is not configured on the server.", groqEnabled=False)

    jd = (jobDescription or "").strip()
    if len(jd) < 20:
        return ResumeAnalysisResponse(success=False, message="Please provide a longer job description (at least 20 characters).", groqEnabled=True, model=analyzer.model)

    raw = await file.read()
    if raw is None:
        raw = b""

    max_bytes = 5 * 1024 * 1024
    if len(raw) > max_bytes:
        return ResumeAnalysisResponse(success=False, message="Resume too large (max 5MB).", groqEnabled=True, model=analyzer.model)

    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()

    resume_text = ""
    if filename.endswith(".pdf") or content_type == "application/pdf":
        if PdfReader is None and _pdfminer_extract_text is None:
            return ResumeAnalysisResponse(
                success=False,
                message="PDF text extraction is not available on the server. Install 'pypdf' or 'pdfminer.six' and restart the backend.",
                groqEnabled=True,
                model=analyzer.model,
            )
        resume_text = _extract_resume_text_pdf(raw)
    else:
        try:
            resume_text = raw.decode("utf-8", errors="ignore").strip()
        except Exception:
            resume_text = ""

    if not resume_text or len(resume_text) < 30:
        return ResumeAnalysisResponse(
            success=False,
            message="Could not extract readable text from the resume. Please upload a text-based PDF (not scanned) or a .txt resume.",
            groqEnabled=True,
            model=analyzer.model,
        )

    obj = await analyzer.analyze(resume_text=resume_text, job_description=jd)
    if not obj:
        return ResumeAnalysisResponse(success=False, message="Resume analysis failed. Try again later.", groqEnabled=True, model=analyzer.model)

    result = _to_resume_analysis_result(obj)

    return ResumeAnalysisResponse(
        success=True,
        message="Resume analysis generated.",
        groqEnabled=True,
        model=analyzer.model,
        result=result,
    )

@router.get("/placements/status/{email}", response_model=StudentPlacementStatusResponse)
async def get_student_placement_status(
    email: str,
    role: UserRole = "student",
    placement_repo=Depends(get_placement_repo),
    current_user: dict = Depends(get_current_user)
) -> StudentPlacementStatusResponse:
    if current_user.get("email") != email:
        raise HTTPException(status_code=403, detail="Unauthorized")
    if role != "student":
        return StudentPlacementStatusResponse(success=False, message="Only students have placement status.")
    
    # Efficiently find all placements where this student is selected in any round
    # We look for students in rounds.selectedStudents
    cur = placement_repo.col.find({"rounds.selectedStudents": email})
    all_selections = []
    
    async for notice in cur:
        for round_item in (notice.get("rounds") or []):
            if email in (round_item.get("selectedStudents") or []):
                all_selections.append(StudentRoundStatus(
                    placementId=str(notice["_id"]),
                    companyName=notice.get("companyName", "Unknown"),
                    title=notice.get("title", "Position"),
                    roundNumber=round_item.get("roundNumber", 0),
                    roundName=round_item.get("name", "Round"),
                    notifiedAt=str(round_item.get("uploadedAt") or notice.get("createdAt"))
                ))
    
    return StudentPlacementStatusResponse(success=True, message="ok", selections=all_selections)
