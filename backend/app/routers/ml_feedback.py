
from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_user_repo
from ml.feedback import store_feedback
from pydantic import BaseModel

router = APIRouter(tags=["ml"])

class FeedbackRequest(BaseModel):
    email: str
    opportunity_id: str
    action: str

@router.post("/ml/feedback")
async def post_feedback(req: FeedbackRequest, user_repo=Depends(get_user_repo)):
    try:
        success = await store_feedback(user_repo, req.email, req.opportunity_id, req.action)
        if success:
            return {"status": "feedback saved"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save feedback")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
