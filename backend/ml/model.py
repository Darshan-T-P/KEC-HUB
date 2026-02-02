
import joblib
import os
from sklearn.linear_model import LogisticRegression
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

def train_model(X, y):
    model = LogisticRegression()
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)
    return model

def ensure_model_exists():
    if not os.path.exists(MODEL_PATH):
        # Create a dummy model with some basic "common sense" data
        # Features: [skill_match, branch_match, year_match, resume_score]
        X = np.array([
            [1.0, 1, 1, 0.9], # Perfect match
            [0.0, 0, 0, 0.1], # No match
            [0.5, 1, 1, 0.6], # partial match
            [0.2, 0, 1, 0.4]  # weak match
        ])
        y = np.array([1, 0, 1, 0])
        train_model(X, y)
        print(f"Dummy model trained and saved to {MODEL_PATH}")

if __name__ == "__main__":
    ensure_model_exists()
