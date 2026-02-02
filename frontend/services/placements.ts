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

export type PlacementResourceItem = {
  label: string;
  url: string;
};

export type PlacementRound = {
  roundNumber: number;
  name: string;
  description?: string | null;
  selectedStudents: string[];
  uploadedAt?: string | null;
  uploadedBy?: string | null;
};

export type PlacementItem = {
  id: string;
  staffEmail: string;
  companyName: string;
  title: string;
  description: string;
  instructions?: string | null;
  visitDate?: string | null;
  applicationDeadline?: string | null;
  location?: string | null;
  applyUrl?: string | null;
  allowedDepartments: string[];
  minCgpa?: number | null;
  maxArrears?: number | null;
  resources: PlacementResourceItem[];
  rounds: PlacementRound[];
  createdAt: string;
};

export type PlacementRoundInfo = {
  name: string;
  description?: string;
};

export type PlacementCreatePayload = {
  companyName: string;
  title: string;
  description: string;
  instructions?: string;
  visitDate?: string;
  applicationDeadline?: string;
  location?: string;
  applyUrl?: string;
  allowedDepartments: string[];
  minCgpa?: number;
  maxArrears?: number;
  resources: PlacementResourceItem[];
  rounds?: PlacementRoundInfo[];
};

export type StudentRoundStatus = {
  placementId: string;
  companyName: string;
  title: string;
  roundNumber: number;
  roundName: string;
  notifiedAt: string;
};

export const placementService = {
  createNotice: async (
    staff: Pick<User, "email" | "role">,
    payload: PlacementCreatePayload
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE_URL}/placements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffEmail: staff.email,
        role: staff.role,
        ...payload,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return (data || { success: true, message: "Placement notice created" }) as any;
    }

    return { success: false, message: await parseApiError(res) };
  },

  listMine: async (staff: Pick<User, "email" | "role">): Promise<PlacementItem[]> => {
    const res = await fetch(
      `${API_BASE_URL}/placements/mine/${encodeURIComponent(staff.email)}?role=${encodeURIComponent(staff.role)}`
    );
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.notices) ? (data.notices as PlacementItem[]) : [];
  },

  listVisible: async (student: Pick<User, "email" | "role">): Promise<PlacementItem[]> => {
    const res = await fetch(
      `${API_BASE_URL}/placements/visible/${encodeURIComponent(student.email)}?role=${encodeURIComponent(student.role)}`
    );
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.notices) ? (data.notices as PlacementItem[]) : [];
  },

  exportEligibleCsv: async (
    staff: Pick<User, "email" | "role">,
    noticeId: string
  ): Promise<{ success: boolean; message: string; blob?: Blob }> => {
    const res = await fetch(
      `${API_BASE_URL}/placements/${encodeURIComponent(noticeId)}/export?email=${encodeURIComponent(staff.email)}&role=${encodeURIComponent(staff.role)}`
    );

    if (!res.ok) {
      return { success: false, message: await parseApiError(res) };
    }

    const blob = await res.blob();
    return { success: true, message: "ok", blob };
  },

  uploadRoundStudents: async (
    staff: Pick<User, "email" | "role">,
    noticeId: string,
    roundNumber: number,
    file: File
  ): Promise<{ success: boolean; message: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `${API_BASE_URL}/placements/${encodeURIComponent(noticeId)}/round/${roundNumber}/upload-students?email=${encodeURIComponent(staff.email)}&role=${encodeURIComponent(staff.role)}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return (data || { success: true, message: "Students uploaded" }) as any;
    }

    return { success: false, message: await parseApiError(res) };
  },

  getMySelections: async (student: Pick<User, "email" | "role">): Promise<StudentRoundStatus[]> => {
    const res = await fetch(
      `${API_BASE_URL}/placements/my-selections/${encodeURIComponent(student.email)}?role=${encodeURIComponent(student.role)}`
    );
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.selections) ? (data.selections as StudentRoundStatus[]) : [];
  },
};
