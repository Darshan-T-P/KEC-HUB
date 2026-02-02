import { User } from "../types";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

export type ReferralStatus = "pending" | "approved" | "rejected";

export type ReferralRequestItem = {
  id: string;
  studentEmail: string;
  alumniEmail: string;
  postId?: string | null;
  message: string;
  status: ReferralStatus;
  createdAt: string;
  decidedAt?: string | null;
  alumniNote?: string | null;
};

export const referralService = {
  requestReferral: async (
    student: Pick<User, "email" | "role">,
    alumniEmail: string,
    message: string,
    postId?: string
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE_URL}/referrals/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentEmail: student.email,
        studentRole: student.role,
        alumniEmail,
        message,
        postId: postId || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    return (data || { success: false, message: "Failed" }) as any;
  },

  inbox: async (alumni: Pick<User, "email" | "role">): Promise<ReferralRequestItem[]> => {
    const res = await fetch(`${API_BASE_URL}/referrals/inbox/${encodeURIComponent(alumni.email)}?role=${encodeURIComponent(alumni.role)}`);
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.requests) ? (data.requests as ReferralRequestItem[]) : [];
  },

  outbox: async (student: Pick<User, "email" | "role">): Promise<ReferralRequestItem[]> => {
    const res = await fetch(`${API_BASE_URL}/referrals/outbox/${encodeURIComponent(student.email)}?role=${encodeURIComponent(student.role)}`);
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.requests) ? (data.requests as ReferralRequestItem[]) : [];
  },

  decide: async (
    alumni: Pick<User, "email" | "role">,
    requestId: string,
    decision: "approved" | "rejected",
    note?: string
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE_URL}/referrals/${encodeURIComponent(requestId)}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alumniEmail: alumni.email,
        alumniRole: alumni.role,
        decision,
        note: note || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    return (data || { success: false, message: "Failed" }) as any;
  },
};
