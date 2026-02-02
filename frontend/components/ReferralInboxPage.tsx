import React, { useEffect, useMemo, useState } from "react";
import { User } from "../types";
import { referralService, ReferralRequestItem } from "../services/referrals";
import { profileService } from "../services/profile";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

type Props = {
  user: User;
};

const ReferralInboxPage: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ReferralRequestItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedStudentEmail, setSelectedStudentEmail] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const pending = useMemo(() => requests.filter(r => r.status === "pending"), [requests]);
  const seen = useMemo(() => requests.filter(r => r.status !== "pending"), [requests]);
  const pendingCount = pending.length;

  const refresh = async () => {
    setLoading(true);
    const data = await referralService.inbox(user);
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email]);

  const loadStudentProfile = async (email: string) => {
    setSelectedStudentEmail(email);
    setStudentProfile(null);
    setLoadingProfile(true);
    const res = await profileService.getProfile(email, "student");
    if (res.success && res.profile) {
      setStudentProfile(res.profile);
    }
    setLoadingProfile(false);
  };

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setToast(null);
    setError(null);
    const res = await referralService.decide(user, id, decision);
    if (res.success) {
      setToast(`Marked as ${decision}`);
      refresh();
    } else {
      setError(res.message || "Failed to save decision");
    }
  };

  const resumeUrl = useMemo(() => {
    const url = studentProfile?.resume?.url;
    if (!url) return null;
    try {
      return new URL(String(url), API_BASE_URL).toString();
    } catch {
      return String(url);
    }
  }, [studentProfile?.resume?.url]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800">Alumni Home • Referral Requests</h2>
            <p className="mt-2 text-slate-500 font-bold">Review student profiles/resumes and approve or reject.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 uppercase tracking-widest">
              Pending: {pendingCount}
            </span>
            <button onClick={refresh} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200">
              Refresh
            </button>
          </div>
        </div>

        {(toast || error) && (
          <div className={`mt-5 p-4 rounded-2xl border font-bold ${error ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
            {error || toast}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
            <h3 className="font-black text-slate-800">Requests</h3>
            {loading ? (
              <p className="mt-4 text-sm text-slate-500 font-bold">Loading…</p>
            ) : pending.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 font-bold">No requests yet.</p>
            ) : (
              <div className="mt-4 space-y-2 max-h-[480px] overflow-auto pr-1">
                {pending.map(r => (
                  <button
                    key={r.id}
                    onClick={() => loadStudentProfile(r.studentEmail)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedStudentEmail === r.studentEmail ? "bg-white border-indigo-200" : "bg-slate-50 border-slate-100 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-black text-slate-800 text-sm truncate">{r.studentEmail}</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                        r.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-100" : r.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-600 line-clamp-2">{r.message}</p>
                    <p className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{(() => {
                      const d = new Date(r.createdAt);
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = d.getFullYear();
                      return `${day}-${month}-${year}`;
                    })()}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); decide(r.id, "approved"); }}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs"
                      >
                        Approve
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); decide(r.id, "rejected"); }}
                        className="px-3 py-2 bg-rose-600 text-white rounded-xl font-black text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <h3 className="mt-8 font-black text-slate-800">Seen</h3>
            {loading ? null : seen.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 font-bold">No approved/rejected items yet.</p>
            ) : (
              <div className="mt-4 space-y-2 max-h-[320px] overflow-auto pr-1">
                {seen.map(r => (
                  <button
                    key={r.id}
                    onClick={() => loadStudentProfile(r.studentEmail)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedStudentEmail === r.studentEmail ? "bg-white border-indigo-200" : "bg-slate-50 border-slate-100 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-black text-slate-800 text-sm truncate">{r.studentEmail}</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                        r.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-600 line-clamp-2">{r.message}</p>
                    <p className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {r.decidedAt ? `Decided: ${(() => {
                        const d = new Date(r.decidedAt);
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        return `${day}-${month}-${year}`;
                      })()}` : `Created: ${(() => {
                        const d = new Date(r.createdAt);
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        return `${day}-${month}-${year}`;
                      })()}`}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="font-black text-slate-800">Student Profile</h3>
            {!selectedStudentEmail ? (
              <p className="mt-3 text-sm font-bold text-slate-500">Select a request to view the student profile.</p>
            ) : loadingProfile ? (
              <p className="mt-3 text-sm font-bold text-slate-500">Loading profile…</p>
            ) : !studentProfile ? (
              <p className="mt-3 text-sm font-bold text-slate-500">Profile not found.</p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</p>
                    <p className="font-black text-slate-800">{studentProfile.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Department</p>
                    <p className="font-black text-slate-800">{studentProfile.department}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">CGPA</p>
                    <p className="font-black text-slate-800">{studentProfile.cgpa ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</p>
                    <p className="font-black text-slate-800">{studentProfile.phone_number ?? "—"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Skills</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(studentProfile.skills || []).slice(0, 30).map((s: string, idx: number) => (
                      <span key={idx} className="text-[10px] font-black text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 uppercase tracking-widest">
                        {s}
                      </span>
                    ))}
                    {(studentProfile.skills || []).length === 0 && <p className="text-sm font-bold text-slate-500">—</p>}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resume</p>
                  {resumeUrl ? (
                    <a href={resumeUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700">
                      Open Resume →
                    </a>
                  ) : (
                    <p className="mt-2 text-sm font-bold text-slate-500">No resume uploaded.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralInboxPage;
