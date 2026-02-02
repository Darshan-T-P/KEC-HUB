import React, { useEffect, useMemo, useState } from "react";
import { User } from "../types";
import { alumniService, AlumniPost, AlumniPublic } from "../services/alumni";
import { referralService } from "../services/referrals";
import { chatService } from "../services/chat";

type Props = {
  user: User;
};

const AlumniHub: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [alumni, setAlumni] = useState<AlumniPublic[]>([]);
  const [posts, setPosts] = useState<AlumniPost[]>([]);
  const [selectedAlumni, setSelectedAlumni] = useState<AlumniPublic | null>(null);
  const [message, setMessage] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visiblePosts = useMemo(() => {
    if (!selectedAlumni) return posts;
    return posts.filter(p => p.alumniEmail === selectedAlumni.email);
  }, [posts, selectedAlumni]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [a, p] = await Promise.all([alumniService.listAlumni(), alumniService.listAllPosts()]);
      if (cancelled) return;
      setAlumni(a);
      setPosts(p);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestReferral = async (alumniEmail: string, postId?: string) => {
    setError(null);
    setToast(null);
    if (!message.trim()) {
      setError("Please type a message for the alumni.");
      return;
    }
    const res = await referralService.requestReferral(user, alumniEmail, message.trim(), postId);
    if (res.success) {
      setToast("Referral request sent. Alumni will be notified.");
      setMessage("");
    } else {
      setError(res.message || "Failed to request referral");
    }
  };

  const startChat = async (alumniEmail: string) => {
    setError(null);
    setToast(null);
    const res = await chatService.send(user, alumniEmail, "alumni", "Hi! Can we connect regarding referrals?");
    if (res.success) {
      setToast("Chat started. Open Chats tab to continue.");
    } else {
      setError(res.message || "Failed to start chat");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black text-slate-800">Alumni Hub</h2>
        <p className="mt-2 text-slate-500 font-bold">Browse alumni and their shared opportunities. Ask for referrals via chat or referral request.</p>

        {(toast || error) && (
          <div className={`mt-5 p-4 rounded-2xl border font-bold ${error ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
            {error || toast}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-slate-800">Alumni</h3>
              <span className="text-xs font-black text-slate-500">{alumni.length}</span>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500 font-bold">Loading…</p>
            ) : alumni.length === 0 ? (
              <p className="text-sm text-slate-500 font-bold">No alumni found yet.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                <button
                  onClick={() => setSelectedAlumni(null)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider border ${
                    !selectedAlumni ? "bg-white border-indigo-200 text-indigo-700" : "bg-slate-50 border-slate-100 text-slate-600"
                  }`}
                >
                  All Alumni
                </button>
                {alumni.map(a => (
                  <button
                    key={a.email}
                    onClick={() => setSelectedAlumni(a)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                      selectedAlumni?.email === a.email
                        ? "bg-white border-indigo-200"
                        : "bg-slate-50 border-slate-100 hover:bg-white"
                    }`}
                  >
                    <p className="font-black text-slate-800 text-sm truncate">{a.name}</p>
                    <p className="text-xs font-bold text-slate-500 truncate">{a.email}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{a.department}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h3 className="font-black text-slate-800">Send Referral Request</h3>
              <p className="text-sm font-bold text-slate-500 mt-1">Write a short note; alumni will receive an email notification.</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-4 w-full min-h-[120px] p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                placeholder="Hi! I'm interested in this opportunity. Could you please refer me? My profile and resume are updated."
              />
            </div>

            <div className="grid gap-4">
              {loading ? (
                <div className="p-10 text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                  <p className="font-bold text-slate-500">Loading posts…</p>
                </div>
              ) : visiblePosts.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                  <p className="font-black text-slate-800">No alumni posts yet.</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">Ask an alumni to post an opportunity or start a chat.</p>
                </div>
              ) : (
                visiblePosts.map(p => (
                  <div key={p.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                        Alumni Post
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                        {p.alumniEmail}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{(() => {
                        const d = new Date(p.createdAt);
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        return `${day}-${month}-${year}`;
                      })()}</span>
                    </div>
                    <h4 className="mt-3 text-xl font-black text-slate-800">{p.title}</h4>
                    <p className="mt-2 text-slate-600 font-bold whitespace-pre-wrap">{p.description}</p>
                    {p.tags?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {p.tags.map((t, idx) => (
                          <span key={idx} className="text-[10px] font-black text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 uppercase tracking-widest">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => requestReferral(p.alumniEmail, p.id)}
                        className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all"
                      >
                        Request Referral
                      </button>
                      <button
                        onClick={() => startChat(p.alumniEmail)}
                        className="px-5 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-sm border border-slate-200 hover:bg-slate-200 transition-all"
                      >
                        Chat
                      </button>
                      {p.link ? (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noreferrer"
                          className="px-5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-sm border border-emerald-100 hover:bg-emerald-100 transition-all"
                        >
                          Open Link
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlumniHub;
