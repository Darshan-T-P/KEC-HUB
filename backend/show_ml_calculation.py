import sys
import os

# Ensure we can import from the current directory (backend)
sys.path.append(os.getcwd())

from ml.features import build_features
from ml.features import build_features
from ml.predict import recommend

def run_demo():
    # Demo Student Profile
    student = {
        "skills": ["Python", "Machine Learning", "FastAPI", "React"],
        "branch": "Computer Science",
        "year": 3,
        "resume_score": 0.85
    }

    # Demo Opportunities
    opportunities = [
        {
            "id": "job-1",
            "title": "ML Engineer Intern",
            "required_skills": ["Python", "Machine Learning"],
            "branch": "Computer Science",
            "min_year": 3
        },
        {
            "id": "job-2",
            "title": "Frontend Developer",
            "required_skills": ["React", "CSS"],
            "branch": "Computer Science",
            "min_year": 2
        },
        {
            "id": "job-3",
            "title": "Civil Site Engineer",
            "required_skills": ["AutoCAD"],
            "branch": "Civil Engineering",
            "min_year": 4
        }
    ]

    print("\n" + "="*50)
    print("      KEC Hub - ML Recommendation Engine Demo")
    print("="*50)
    
    print(f"\n[1] Student Profile (Computer Science, Year 3):")
    print(f"    - Skills: {', '.join(student['skills'])}")
    print(f"    - Resume Score: {student['resume_score'] * 100}%")

    print(f"\n[2] Feature Extraction & Scoring:")
    
    results = []
    for opp in opportunities:
        features = build_features(student, opp)
        rec_list = recommend(student, [opp])
        score = rec_list[0]['score']
        reasons = rec_list[0]['why_recommended']
        
        results.append((opp['title'], score, features, reasons))
        
        print(f"\n    > Job: {opp['title']}")
        print(f"      Matched Features: {features}")
        print(f"      Calculated Score: {score * 100}%")
        print(f"      ML Reasons: {', '.join(reasons)}")

    print("\n" + "="*50)
    print("      FINAL RANKED SMART FEED")
    print("="*50)
    results.sort(key=lambda x: x[1], reverse=True)
    for i, (title, score, _, _) in enumerate(results):
        badge = "🔥 BEST MATCH" if score > 0.8 else "✅ RECOMMENDED"
        print(f"{i+1}. {score*100:5.1f}% | {title} [{badge}]")
    print("="*50 + "\n")

if __name__ == "__main__":
    run_demo()
