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

export type EventFieldType = "text" | "textarea" | "select";

export type EventFormField = {
  key: string;
  label: string;
  type: EventFieldType;
  required: boolean;
  options?: string[] | null;
};

export type PosterMeta = {
  originalName: string;
  storedName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  url: string;
};

export type EventItem = {
  id: string;
  managerEmail: string;
  title: string;
  description: string;
  venue?: string | null;
  startAt: string;
  endAt?: string | null;
  allowedDepartments: string[];
  formFields: EventFormField[];
  poster?: PosterMeta | null;
  createdAt: string;
};

export type EventRegistrationItem = {
  id: string;
  eventId: string;
  studentEmail: string;
  studentDepartment?: string | null;
  answers: Record<string, string>;
  createdAt: string;
};

export const eventService = {
  createEvent: async (
    manager: Pick<User, "email" | "role">,
    payload: {
      title: string;
      description: string;
      venue?: string;
      startAt: string;
      endAt?: string;
      allowedDepartments: string[];
      formFields: EventFormField[];
    }
  ): Promise<{ success: boolean; message: string; eventId?: string | null }> => {
    const res = await fetch(`${API_BASE_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        managerEmail: manager.email,
        role: manager.role,
        ...payload,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return (data || { success: true, message: "Event created" }) as any;
    }

    return { success: false, message: await parseApiError(res) };
  },

  listMine: async (manager: Pick<User, "email" | "role">): Promise<EventItem[]> => {
    const res = await fetch(`${API_BASE_URL}/events/mine/${encodeURIComponent(manager.email)}?role=${encodeURIComponent(manager.role)}`);
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.events) ? (data.events as EventItem[]) : [];
  },

  listVisible: async (student: Pick<User, "email" | "role">): Promise<EventItem[]> => {
    const res = await fetch(`${API_BASE_URL}/events/visible/${encodeURIComponent(student.email)}?role=${encodeURIComponent(student.role)}`);
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.events) ? (data.events as EventItem[]) : [];
  },

  uploadPoster: async (
    manager: Pick<User, "email" | "role">,
    eventId: string,
    file: File
  ): Promise<{ success: boolean; message: string }> => {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(
      `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/poster?email=${encodeURIComponent(manager.email)}&role=${encodeURIComponent(manager.role)}`,
      {
        method: "POST",
        body: form,
      }
    );

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return (data || { success: true, message: "Poster uploaded" }) as any;
    }

    return { success: false, message: await parseApiError(res) };
  },

  register: async (
    student: Pick<User, "email" | "role">,
    eventId: string,
    answers: Record<string, string>
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentEmail: student.email,
        studentRole: student.role,
        answers,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return (data || { success: true, message: "Registered" }) as any;
    }

    return { success: false, message: await parseApiError(res) };
  },

  listRegistrations: async (
    manager: Pick<User, "email" | "role">,
    eventId: string
  ): Promise<EventRegistrationItem[]> => {
    const res = await fetch(
      `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/registrations?email=${encodeURIComponent(manager.email)}&role=${encodeURIComponent(manager.role)}`
    );
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.registrations) ? (data.registrations as EventRegistrationItem[]) : [];
  },
};
