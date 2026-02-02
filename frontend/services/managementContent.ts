import { User } from "../types";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

const parseApiErrorFromData = (data: any, status?: number): string => {
  const detail = data?.detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    const loc = Array.isArray(first?.loc) ? first.loc.join(".") : "request";
    const msg = typeof first?.msg === "string" ? first.msg : "Validation error";
    return `${loc}: ${msg}`;
  }

  const message = typeof data?.message === "string" ? data.message : `Request failed (${status ?? ""})`;
  return message;
};

const parseApiError = async (res: Response): Promise<string> => {
  const data = await res.json().catch(() => null);
  return parseApiErrorFromData(data, res.status);
};

export type InstructionItem = {
  id: string;
  staffEmail: string;
  title: string;
  body: string;
  allowedDepartments: string[];
  createdAt: string;
};

export type NoteFileMeta = {
  originalName: string;
  storedName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  url: string;
};

export type NoteItem = {
  id: string;
  staffEmail: string;
  title: string;
  description?: string | null;
  allowedDepartments: string[];
  file: NoteFileMeta;
  createdAt: string;
};

export const managementContentService = {
  // Instructions
  createInstruction: async (
    staff: Pick<User, "email" | "role">,
    payload: { title: string; body: string; allowedDepartments: string[] }
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE_URL}/management/instructions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffEmail: staff.email,
        role: staff.role,
        ...payload,
      }),
    });

    const data = await res.json().catch(() => null);
    if (res.ok) return (data || { success: true, message: "Posted" }) as any;
    return { success: false, message: parseApiErrorFromData(data, res.status) };
  },

  listMyInstructions: async (staff: Pick<User, "email" | "role">): Promise<InstructionItem[]> => {
    const res = await fetch(
      `${API_BASE_URL}/management/instructions/mine/${encodeURIComponent(staff.email)}?role=${encodeURIComponent(staff.role)}`
    );
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.items) ? (data.items as InstructionItem[]) : [];
  },

  listVisibleInstructions: async (student: Pick<User, "email" | "role">): Promise<InstructionItem[]> => {
    const res = await fetch(
      `${API_BASE_URL}/management/instructions/visible/${encodeURIComponent(student.email)}?role=${encodeURIComponent(student.role)}`
    );
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.items) ? (data.items as InstructionItem[]) : [];
  },

  // Notes
  uploadNote: async (
    staff: Pick<User, "email" | "role">,
    payload: { title: string; description?: string; allowedDepartmentsCsv?: string; file: File }
  ): Promise<{ success: boolean; message: string }> => {
    const form = new FormData();
    form.append("title", payload.title);
    form.append("description", payload.description || "");
    form.append("allowedDepartments", payload.allowedDepartmentsCsv || "all");
    form.append("file", payload.file);

    const res = await fetch(
      `${API_BASE_URL}/management/notes/upload?email=${encodeURIComponent(staff.email)}&role=${encodeURIComponent(staff.role)}`,
      { method: "POST", body: form }
    );

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return (data || { success: true, message: "Uploaded" }) as any;
    }

    return { success: false, message: await parseApiError(res) };
  },

  listMyNotes: async (staff: Pick<User, "email" | "role">): Promise<NoteItem[]> => {
    const res = await fetch(
      `${API_BASE_URL}/management/notes/mine/${encodeURIComponent(staff.email)}?role=${encodeURIComponent(staff.role)}`
    );
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.items) ? (data.items as NoteItem[]) : [];
  },

  listVisibleNotes: async (student: Pick<User, "email" | "role">): Promise<NoteItem[]> => {
    const res = await fetch(
      `${API_BASE_URL}/management/notes/visible/${encodeURIComponent(student.email)}?role=${encodeURIComponent(student.role)}`
    );
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.items) ? (data.items as NoteItem[]) : [];
  },
};
