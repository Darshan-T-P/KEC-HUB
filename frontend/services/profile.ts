export interface ApiResponse<T> {
  success: boolean;
  message: string;
  profile?: T;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

export type ProjectItem = {
  title: string;
  description: string;
  link?: string;
};

export type ResumeMeta = {
  originalName: string;
  storedName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  url: string;
};

export type UserProfile = {
  name: string;
  email: string;
  department: string;
  role?: 'student' | 'event_manager' | 'alumni' | 'management';
  roll_number?: string;
  dob?: string;
  personal_email?: string;
  phone_number?: string;
  cgpa?: number;
  arrears_history?: number;
  interests?: string[];
  skills?: string[];
  achievements?: string[];
  blogs?: string[];
  linkedin_url?: string;
  github_url?: string;
  leetcode_url?: string;
  portfolio_url?: string;
  projects?: ProjectItem[];
  resume?: ResumeMeta;
};

export type ProfileUpdate = Partial<Omit<UserProfile, 'email' | 'resume'>>;

export const profileService = {
  getProfile: async (email: string, role: string): Promise<ApiResponse<UserProfile>> => {
    try {
      const res = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(email)}?role=${encodeURIComponent(role)}`);
      return (await res.json()) as ApiResponse<UserProfile>;
    } catch {
      return { success: false, message: 'Profile service is unreachable. Start the backend and try again.' };
    }
  },

  updateProfile: async (email: string, role: string, update: ProfileUpdate): Promise<ApiResponse<UserProfile>> => {
    try {
      const res = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(email)}?role=${encodeURIComponent(role)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) return (data || { success: false, message: 'Unknown response from server.' }) as ApiResponse<UserProfile>;

      // FastAPI validation errors look like: { detail: [{ loc, msg, type }, ...] }
      const detail = (data as any)?.detail;
      if (Array.isArray(detail) && detail.length) {
        const msgs = detail
          .map((d: any) => d?.msg)
          .filter(Boolean)
          .slice(0, 3);
        return { success: false, message: `Invalid profile data: ${msgs.join('; ')}` };
      }

      return (data || { success: false, message: 'Profile update failed.' }) as ApiResponse<UserProfile>;
    } catch {
      return { success: false, message: 'Profile service is unreachable. Start the backend and try again.' };
    }
  },

  uploadResume: async (email: string, role: string, file: File): Promise<ApiResponse<UserProfile>> => {
    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(
        `${API_BASE_URL}/profile/${encodeURIComponent(email)}/resume?role=${encodeURIComponent(role)}`,
        {
        method: 'POST',
        body: form,
        }
      );

      return (await res.json()) as ApiResponse<UserProfile>;
    } catch {
      return { success: false, message: 'Resume upload failed. Ensure backend is running and retry.' };
    }
  },
};
