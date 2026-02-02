import { User, UserRole } from "../types";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

export type ChatThread = {
  id: string;
  otherEmail: string;
  otherRole: UserRole;
  lastMessage?: string | null;
  lastAt?: string | null;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderEmail: string;
  senderRole: UserRole;
  text: string;
  createdAt: string;
};

export const chatService = {
  listThreads: async (user: Pick<User, "email" | "role">): Promise<ChatThread[]> => {
    const res = await fetch(`${API_BASE_URL}/chat/threads/${encodeURIComponent(user.email)}?role=${encodeURIComponent(user.role)}`);
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.threads) ? (data.threads as ChatThread[]) : [];
  },

  listMessages: async (user: Pick<User, "email" | "role">, threadId: string): Promise<ChatMessage[]> => {
    const res = await fetch(
      `${API_BASE_URL}/chat/messages/${encodeURIComponent(threadId)}?email=${encodeURIComponent(user.email)}&role=${encodeURIComponent(user.role)}`
    );
    const data = await res.json().catch(() => null);
    if (!data?.success) return [];
    return Array.isArray(data?.messages) ? (data.messages as ChatMessage[]) : [];
  },

  send: async (
    sender: Pick<User, "email" | "role">,
    recipientEmail: string,
    recipientRole: UserRole,
    text: string
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE_URL}/chat/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderEmail: sender.email,
        senderRole: sender.role,
        recipientEmail,
        recipientRole,
        text,
      }),
    });
    const data = await res.json().catch(() => null);
    return (data || { success: false, message: "Failed" }) as any;
  },
};
