import { User, UserRole } from "../types";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

export type AlumniPublic = {
  name: string;
  email: string;
  department: string;
  role: UserRole;
};

export type AlumniPost = {
  id: string;
  alumniEmail: string;
  title: string;
  description: string;
  tags: string[];
  link?: string | null;
  createdAt: string;
};

export const alumniService = {
  listAlumni: async (): Promise<AlumniPublic[]> => {
    const res = await fetch(`${API_BASE_URL}/alumni/list`);
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.alumni) ? (data.alumni as AlumniPublic[]) : [];
  },

  listAllPosts: async (): Promise<AlumniPost[]> => {
    const res = await fetch(`${API_BASE_URL}/alumni/posts`);
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.posts) ? (data.posts as AlumniPost[]) : [];
  },

  listPostsByAlumni: async (alumniEmail: string): Promise<AlumniPost[]> => {
    const res = await fetch(`${API_BASE_URL}/alumni/${encodeURIComponent(alumniEmail)}/posts?role=alumni`);
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.posts) ? (data.posts as AlumniPost[]) : [];
  },

  createPost: async (
    user: Pick<User, "email" | "role">,
    title: string,
    description: string,
    tags: string[],
    link?: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanedLink = (link ?? "").trim();
    const res = await fetch(`${API_BASE_URL}/alumni/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alumniEmail: user.email,
        role: user.role,
        title,
        description,
        tags,
        link: cleanedLink ? cleanedLink : undefined,
      }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok) {
      return (data || { success: true, message: "Created" }) as any;
    }

    // FastAPI validation errors are usually: { detail: [{ loc, msg, type }, ...] }
    const detail = (data as any)?.detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      const loc = Array.isArray(first?.loc) ? first.loc.join(".") : "request";
      const msg = typeof first?.msg === "string" ? first.msg : "Validation error";
      return { success: false, message: `${loc}: ${msg}` };
    }

    const message = typeof (data as any)?.message === "string" ? (data as any).message : `Request failed (${res.status})`;
    return { success: false, message };
  },

  updatePost: async (
    user: Pick<User, "email" | "role">,
    postId: string,
    title: string,
    description: string,
    tags: string[],
    link?: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanedLink = (link ?? "").trim();
    const res = await fetch(`${API_BASE_URL}/alumni/posts/${encodeURIComponent(postId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alumniEmail: user.email,
        role: user.role,
        title,
        description,
        tags,
        link: cleanedLink ? cleanedLink : undefined,
      }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok) {
      return (data || { success: true, message: "Updated" }) as any;
    }

    const detail = (data as any)?.detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      const loc = Array.isArray(first?.loc) ? first.loc.join(".") : "request";
      const msg = typeof first?.msg === "string" ? first.msg : "Validation error";
      return { success: false, message: `${loc}: ${msg}` };
    }

    const message = typeof (data as any)?.message === "string" ? (data as any).message : `Request failed (${res.status})`;
    return { success: false, message };
  },
};
