
from datetime import datetime, timezone

async def store_feedback(user_repo, email: str, opportunity_id: str, action: str):
    # value = 1 if action in ["applied", "liked", "clicked"] else 0
    # For now, let's just store the interaction in a feedback collection
    # Assuming user_repo has access to the database or we use a direct db dependency
    
    db = user_repo.db
    value = 1 if action in ["applied", "liked", "clicked"] else 0
    
    feedback_doc = {
        "email": email,
        "opportunity_id": opportunity_id,
        "action": action,
        "value": value,
        "timestamp": datetime.now(timezone.utc)
    }
    
    await db.ml_feedback.insert_one(feedback_doc)
    return True
