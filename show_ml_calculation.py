import sys
import os

# Add backend to path so we can import ml
sys.path.append(os.path.join(os.getcwd(), 'backend'))

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

    print("--- ML RECOMMENDATION CALCULATION DEMO ---")
    print(f"\nStudent Profile:")
    print(f"  Skills: {', '.join(student['skills'])}")
    print(f"  Branch: {student['branch']}")
    print(f"  Year: {student['year']}")
    print(f"  Resume Score: {student['resume_score']}")

    print("\nCalculations per Opportunity:")
    
    # Process them manually to show steps
    results = []
    for opp in opportunities:
        features = build_features(student, opp)
        print(f"\nOpportunity: {opp['title']}")
        print(f"  Required Skills: {', '.join(opp['required_skills'])}")
        print(f"  Feature Vector [SkillMatch, BranchMatch, YearEligible, ResumeScore]:")
        print(f"  {features}")
        
        # Get score from recommendation engine
        # recommend() handles the model prediction
        rec_list = recommend(student, [opp])
        score = rec_list[0]['score']
        reasons = rec_list[0]['why_recommended']
        
        print(f"  FINAL SCORE: {score * 100}%")
        print(f"  REASONS: {', '.join(reasons)}")
        results.append((opp['title'], score))

    print("\n--- FINAL RANKING ---")
    results.sort(key=lambda x: x[1], reverse=True)
    for title, score in results:
        print(f"{score*100:5.1f}% | {title}")

if __name__ == "__main__":
    run_demo()
