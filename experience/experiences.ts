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

export type InterviewRound = {
    roundName: string;
    description: string;
};

export type PlacementExperience = {
    id: string;
    studentEmail: string;
    studentName?: string;
    studentDepartment?: string;
    companyName: string;
    jobRole: string;
    interviewDate: string;
    rounds: InterviewRound[];
    difficultyLevel: number;
    overallExperience: string;
    createdAt: string;
};

export type ExperienceCreatePayload = {
    companyName: string;
    jobRole: string;
    interviewDate: string;
    rounds: InterviewRound[];
    difficultyLevel: number;
    overallExperience: string;
};

export const experienceService = {
    submit: async (
        student: Pick<User, "email" | "role">,
        payload: ExperienceCreatePayload
    ): Promise<{ success: boolean; message: string }> => {
        const res = await fetch(`${API_BASE_URL}/api/experiences`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                studentEmail: student.email,
                studentRole: student.role,
                ...payload,
            }),
        });

        if (res.ok) {
            const data = await res.json().catch(() => null);
            return (data || { success: true, message: "Experience submitted successfully!" }) as any;
        }

        return { success: false, message: await parseApiError(res) };
    },

    getByCompany: async (companyName: string): Promise<PlacementExperience[]> => {
        const res = await fetch(
            `${API_BASE_URL}/api/experiences/${encodeURIComponent(companyName)}`
        );
        const data = await res.json().catch(() => null);
        if (!data?.success) return [];
        return Array.isArray(data?.experiences) ? (data.experiences as PlacementExperience[]) : [];
    },

    listAll: async (): Promise<PlacementExperience[]> => {
        const res = await fetch(`${API_BASE_URL}/api/experiences`);
        const data = await res.json().catch(() => null);
        if (!data?.success) return [];
        return Array.isArray(data?.experiences) ? (data.experiences as PlacementExperience[]) : [];
    },
};
