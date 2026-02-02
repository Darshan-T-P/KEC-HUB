import React, { useEffect, useMemo, useState } from "react";
import { User } from "../types";
import { placementService, PlacementItem, StudentRoundStatus } from "../services/placements";

type Props = {
  user: User;
};

const formatMaybeDate = (value?: string | null): string => {
  const v = (value || "").trim();
  if (!v) return "";
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return v;
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
};

const StudentPlacementsPage: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [notices, setNotices] = useState<PlacementItem[]>([]);
  const [selections, setSelections] = useState<StudentRoundStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...notices].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [notices]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, mySelections] = await Promise.all([
        placementService.listVisible({ email: user.email, role: user.role }),
        placementService.getMySelections({ email: user.email, role: user.role }),
      ]);
      setNotices(items);
      setSelections(mySelections);
    } catch (e: any) {
      setError(e?.message || "Failed to load placements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email, user.role]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Placements</h2>
          <p className="text-sm font-bold text-slate-500 mt-2">Only notices matching your profile (department, CGPA, arrears) are shown.</p>
          {error ? <p className="text-sm font-black text-rose-600 mt-2">{error}</p> : null}
        </div>
        <div className="flex gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {selections.length > 0 && (
        <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🎉</div>
            <div>
              <h3 className="text-2xl font-black text-white">Congratulations!</h3>
              <p className="text-sm font-bold text-indigo-100 mt-1">You've been selected for placement rounds</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selections.map((sel, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/20">
                <p className="text-xs font-black uppercase tracking-widest text-indigo-100">{sel.companyName}</p>
                <h4 className="text-lg font-black text-white mt-2">{sel.title}</h4>
                <p className="text-sm font-bold text-indigo-100 mt-3">
                  Round {sel.roundNumber}: {sel.roundName}
                </p>
                {sel.notifiedAt && (
                  <p className="text-xs font-bold text-indigo-200 mt-2">
                    Notified: {(() => {
                      const d = new Date(sel.notifiedAt);
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = d.getFullYear();
                      return `${day}-${month}-${year}`;
                    })()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {sorted.length === 0 && !loading ? (
        <div className="p-16 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
          <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-sm mb-6">🏢</div>
          <h4 className="text-xl font-black text-slate-800">No eligible notices yet</h4>
          <p className="text-slate-400 font-bold mt-2 max-w-xl mx-auto">
            Update your profile CGPA and arrears for better matching.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sorted.map((n) => (
            <div key={n.id} className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">{n.companyName}</p>
                  <h3 className="text-xl font-black text-slate-900 mt-2 leading-snug break-words">{n.title}</h3>
                  {n.location ? <p className="text-sm font-bold text-slate-500 mt-2">📍 {n.location}</p> : null}
                </div>
                {n.applyUrl ? (
                  <button
                    onClick={() => window.open(n.applyUrl as string, "_blank")}
                    className="shrink-0 px-6 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
                  >
                    Apply →
                  </button>
                ) : (
                  <span className="shrink-0 px-4 py-2 bg-slate-100 text-slate-600 text-xs font-black rounded-2xl">No Apply Link</span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {n.applicationDeadline ? (
                  <span className="px-3 py-1 bg-rose-50 text-rose-700 text-[10px] font-black uppercase rounded-lg border border-rose-100">
                    Deadline: {formatMaybeDate(n.applicationDeadline)}
                  </span>
                ) : null}
                {n.visitDate ? (
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100">
                    Visit: {formatMaybeDate(n.visitDate)}
                  </span>
                ) : null}
                {typeof n.minCgpa === "number" ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-100">
                    Min CGPA: {n.minCgpa}
                  </span>
                ) : null}
                {typeof n.maxArrears === "number" ? (
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase rounded-lg border border-amber-100">
                    Max Arrears: {n.maxArrears}
                  </span>
                ) : null}
                {Array.isArray(n.allowedDepartments) && n.allowedDepartments.length > 0 ? (
                  <span className="px-3 py-1 bg-slate-50 text-slate-700 text-[10px] font-black uppercase rounded-lg border border-slate-100">
                    Depts: {n.allowedDepartments.join(", ")}
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-slate-50 text-slate-700 text-[10px] font-black uppercase rounded-lg border border-slate-100">
                    Depts: All
                  </span>
                )}
              </div>

              <p className="text-sm font-bold text-slate-700 mt-5 whitespace-pre-wrap">{n.description}</p>

              {n.instructions ? (
                <div className="mt-5 p-5 rounded-3xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Instructions</p>
                  <p className="text-sm font-bold text-slate-700 mt-2 whitespace-pre-wrap">{n.instructions}</p>
                </div>
              ) : null}

              {Array.isArray(n.resources) && n.resources.length > 0 ? (
                <div className="mt-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resources</p>
                  <div className="mt-3 grid gap-2">
                    {n.resources.map((r, idx) => (
                      <a
                        key={`${n.id}-res-${idx}`}
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-5 py-3 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-all flex items-center justify-between"
                      >
                        <span className="text-sm font-black text-slate-800">{r.label}</span>
                        <span className="text-xs font-black text-indigo-600">Open →</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="text-xs font-bold text-slate-400 mt-6">Posted: {formatMaybeDate(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentPlacementsPage;
