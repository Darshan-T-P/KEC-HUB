
export interface AuthResponse {
  success: boolean;
  message: string;
  user?: any;
}

export type UserRole = 'student' | 'event_manager' | 'alumni' | 'management';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

export const validateKonguEmail = (email: string): boolean => {
  const allowedDomains = ['kongu.edu', 'kongu.ac.in'];
  const domain = email.split('@')[1];
  return allowedDomains && allowedDomains.includes(domain);
};

// Note: Register/Login are now handled by the backend (MongoDB).

export const authService = {
  /**
   * Request an OTP to be sent to the user's email.
   * Calls the FastAPI backend, which handles rate limiting + sending.
   */
  sendOTP: async (email: string): Promise<AuthResponse> => {
    if (!validateKonguEmail(email)) {
      return { success: false, message: "Only @kongu.edu or @kongu.ac.in emails are permitted." };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = (await res.json()) as AuthResponse;
      return data;
    } catch (e) {
      return { success: false, message: 'OTP service is unreachable. Start the backend and try again.' };
    }
  },

  /**
   * Verify the OTP provided by the user.
   * Calls the FastAPI backend for validation.
   */
  verifyOTP: async (email: string, otp: string): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const data = (await res.json()) as AuthResponse;
      return data;
    } catch (e) {
      return { success: false, message: 'OTP service is unreachable. Start the backend and try again.' };
    }
  },

  register: async (name: string, email: string, password: string, role: UserRole, department: string = 'Computer Science'): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, department })
      });
      const data = (await res.json()) as AuthResponse;
      return data;
    } catch (e) {
      return { success: false, message: 'Auth service is unreachable. Start the backend and try again.' };
    }
  },

  login: async (email: string, password: string, role: UserRole): Promise<AuthResponse> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      const data = (await res.json()) as AuthResponse;
      return data;
    } catch (e) {
      return { success: false, message: 'Auth service is unreachable. Start the backend and try again.' };
    }
  }
};
