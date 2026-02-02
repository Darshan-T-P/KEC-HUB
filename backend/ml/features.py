
def clean_skills(skills):
    if not skills:
        return []
    return list(set(s.lower().strip() for s in skills))

def skill_match(student_skills, opp_skills):
    if not student_skills or not opp_skills:
        return 0.0
    s_set = set(clean_skills(student_skills))
    o_set = set(clean_skills(opp_skills))
    if not o_set:
        return 0.0
    return len(s_set & o_set) / len(o_set)

def build_features(student, opportunity):
    # Mapping branches to match simplified logic or exact
    # Expecting student: {skills, branch, year, resume_score}
    # Expecting opportunity: {required_skills, branch, min_year}
    
    return [
        skill_match(student.get("skills", []), opportunity.get("required_skills", [])),
        int(str(student.get("branch", "")).lower() == str(opportunity.get("branch", "")).lower()),
        int(int(student.get("year", 0)) >= int(opportunity.get("min_year", 0))),
        float(student.get("resume_score", 0.5))
    ]
