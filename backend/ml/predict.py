
import joblib
import os
from .features import build_features
from .model import MODEL_PATH, ensure_model_exists

# Ensure the model exists before loading
ensure_model_exists()
model = joblib.load(MODEL_PATH)

def recommend(student, opportunities):
    ranked = []

    for opp in opportunities:
        # Expected student: {skills: [], branch: "", year: 0, resume_score: 0.0}
        # Expected opp: {id: "", required_skills: [], branch: "", min_year: 0}
        features = build_features(student, opp)
        
        # predict_proba returns [prob_0, prob_1]
        try:
            score = model.predict_proba([features])[0][1]
        except Exception:
            # Fallback if prediction fails
            score = 0.5

        ranked.append({
            "opportunity_id": opp["id"],
            "score": round(float(score), 3),
            "why_recommended": [
                "High skill match" if features[0] > 0.6 else "Profile relevance",
                "Eligible year" if features[2] == 1 else "Growth potential"
            ]
        })

    # Sort by score descending
    return sorted(ranked, key=lambda x: x["score"], reverse=True)
