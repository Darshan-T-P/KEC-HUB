import React, { useEffect, useMemo, useState } from "react";
import { User, UserRole } from "../types";
import { chatService, ChatMessage, ChatThread } from "../services/chat";

type Props = {
  user: User;
};

const ChatPage: React.FC<Props> = ({ user }) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);

  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refreshThreads = async () => {
    setLoadingThreads(true);
    const data = await chatService.listThreads(user);
    setThreads(data);
    setLoadingThreads(false);
  };

  const loadMessages = async (t: ChatThread) => {
    setActiveThread(t);
    setLoadingMessages(true);
    const data = await chatService.listMessages(user, t.id);
    setMessages(data);
    setLoadingMessages(false);
  };

  useEffect(() => {
    refreshThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email, user.role]);

  useEffect(() => {
    if (!activeThread) return;
    loadMessages(activeThread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id]);

  const send = async () => {
    if (!activeThread) return;
    setError(null);
    const text = draft.trim();
    if (!text) return;

    const res = await chatService.send(user, activeThread.otherEmail, activeThread.otherRole as UserRole, text);
    if (!res.success) {
      setError(res.message || "Failed to send");
      return;
    }
    setDraft("");
    await loadMessages(activeThread);
    await refreshThreads();
  };

  const grouped = useMemo(() => messages, [messages]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black text-slate-800">Chats</h2>
        <p className="mt-2 text-slate-500 font-bold">Message alumni and students directly.</p>

        {error && (
          <div className="mt-5 p-4 rounded-2xl border font-bold bg-rose-50 text-rose-700 border-rose-100">{error}</div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800">Threads</h3>
              <button onClick={refreshThreads} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200">
                Refresh
              </button>
            </div>

            {loadingThreads ? (
              <p className="mt-4 text-sm text-slate-500 font-bold">Loading…</p>
            ) : threads.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 font-bold">No chats yet.</p>
            ) : (
              <div className="mt-4 space-y-2 max-h-[480px] overflow-auto pr-1">
                {threads.map(t => (
                  <button
                    key={t.id}
                    onClick={() => loadMessages(t)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      activeThread?.id === t.id ? "bg-white border-indigo-200" : "bg-slate-50 border-slate-100 hover:bg-white"
                    }`}
                  >
                    <p className="font-black text-slate-800 text-sm truncate">{t.otherEmail}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.otherRole}</p>
                    <p className="mt-2 text-xs font-bold text-slate-600 line-clamp-2">{t.lastMessage || "—"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 flex flex-col min-h-[520px]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800">Conversation</h3>
                {activeThread ? (
                  <p className="text-sm font-bold text-slate-500 mt-1">With {activeThread.otherEmail} ({activeThread.otherRole})</p>
                ) : (
                  <p className="text-sm font-bold text-slate-500 mt-1">Select a thread</p>
                )}
              </div>
              {activeThread && (
                <button onClick={() => loadMessages(activeThread)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200">
                  Reload
                </button>
              )}
            </div>

            <div className="mt-4 flex-1 overflow-auto bg-slate-50 rounded-2xl border border-slate-100 p-4">
              {loadingMessages ? (
                <p className="text-sm font-bold text-slate-500">Loading…</p>
              ) : !activeThread ? (
                <p className="text-sm font-bold text-slate-500">No thread selected.</p>
              ) : grouped.length === 0 ? (
                <p className="text-sm font-bold text-slate-500">No messages yet.</p>
              ) : (
                <div className="space-y-3">
                  {grouped.map(m => {
                    const mine = m.senderEmail.toLowerCase() === user.email.toLowerCase();
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl border font-bold whitespace-pre-wrap ${mine ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-800 border-slate-100"}`}>
                          <p className="text-sm">{m.text}</p>
                          <p className={`mt-2 text-[10px] font-black uppercase tracking-widest ${mine ? "text-indigo-100" : "text-slate-400"}`}>
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={activeThread ? "Type a message…" : "Select a thread to message"}
                disabled={!activeThread}
                className="flex-1 px-4 py-3 rounded-2xl bg-white border border-slate-200 outline-none font-bold focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                onClick={send}
                disabled={!activeThread}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
