import { User } from "../types";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

const parseApiError = async (res: Response): Promise<string> => {
  const data = await res.json().catch(() => null);

  const detail = (data as any)?.detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    const loc = Array.isArray(first?.loc) ? first.loc.join(".") : "request";
    const msg = typeof first?.msg === "string" ? first.msg : "Validation error";
    return `${loc}: ${msg}`;
  }

  const message = typeof (data as any)?.message === "string" ? (data as any).message : `Request failed (${res.status})`;
  return message;
};

export type ResumeImprovement = {
  area: string;
  recommendation: string;
  example?: string | null;
};

export type ResumeAnalysisResult = {
  overallFitScore: number;
  strengths: string[];
  gaps: string[];
  improvements: ResumeImprovement[];
  missingKeywords: string[];
  suggestedSummary?: string | null;
  suggestedBullets: string[];
  atsWarnings: string[];
  finalFeedback?: string | null;
};

export type ResumeAnalysisResponse = {
  success: boolean;
  message: string;
  groqEnabled?: boolean;
  model?: string | null;
  result?: ResumeAnalysisResult | null;
};

export const resumeAnalysisService = {
  analyze: async (
    student: Pick<User, "email" | "role">,
    payload: { jobDescription: string; resumeFile: File }
  ): Promise<ResumeAnalysisResponse> => {
    const form = new FormData();
    form.append("jobDescription", payload.jobDescription);
    form.append("file", payload.resumeFile);

    const res = await fetch(
      `${API_BASE_URL}/resume/analyze?email=${encodeURIComponent(student.email)}&role=${encodeURIComponent(student.role)}`,
      { method: "POST", body: form }
    );

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return (data || { success: true, message: "ok" }) as any;
    }

    return { success: false, message: await parseApiError(res) };
  },
};
