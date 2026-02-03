import React, { useEffect, useMemo, useState } from "react";
import { User } from "../types";
import {
  placementService,
  PlacementCreatePayload,
  PlacementItem,
  PlacementResourceItem,
} from "../services/placements";

type Props = {
  user: User;
};

const splitDepartments = (raw: string): string[] => {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ManagementPlacementsPage: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [mine, setMine] = useState<PlacementItem[]>([]);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [location, setLocation] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [allowedDepartmentsRaw, setAllowedDepartmentsRaw] = useState("all");
  const [minCgpa, setMinCgpa] = useState<string>("");
  const [maxArrears, setMaxArrears] = useState<string>("");

  const [resources, setResources] = useState<PlacementResourceItem[]>([]);
  const [resLabel, setResLabel] = useState("");
  const [resUrl, setResUrl] = useState("");

  const [rounds, setRounds] = useState<Array<{ name: string; description: string }>>([]);
  const [roundName, setRoundName] = useState("");
  const [roundDesc, setRoundDesc] = useState("");

  const [uploadingRound, setUploadingRound] = useState<{ noticeId: string; roundNumber: number } | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const sortedMine = useMemo(() => {
    return [...mine].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [mine]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await placementService.listMine({ email: user.email, role: user.role });
      setMine(items);
    } catch (e: any) {
      setError(e?.message || "Failed to load your notices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email, user.role]);

  const addResource = () => {
    const label = resLabel.trim();
    const url = resUrl.trim();
    if (!label || !url) return;
    setResources((prev) => [...prev, { label, url }]);
    setResLabel("");
    setResUrl("");
  };

  const removeResource = (idx: number) => {
    setResources((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRound = () => {
    const name = roundName.trim();
    if (!name) return;
    setRounds((prev) => [...prev, { name, description: roundDesc.trim() }]);
    setRoundName("");
    setRoundDesc("");
  };

  const removeRound = (idx: number) => {
    setRounds((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setCompanyName("");
    setTitle("");
    setDescription("");
    setInstructions("");
    setVisitDate("");
    setApplicationDeadline("");
    setLocation("");
    setApplyUrl("");
    setAllowedDepartmentsRaw("all");
    setMinCgpa("");
    setMaxArrears("");
    setResources([]);
    setResLabel("");
    setResUrl("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const allowedDepartments = splitDepartments(allowedDepartmentsRaw);
    const payload: PlacementCreatePayload = {
      companyName: companyName.trim(),
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim() || "",
      visitDate: visitDate.trim() || "",
      applicationDeadline: applicationDeadline.trim() || "",
      location: location.trim() || "",
      applyUrl: applyUrl.trim() || "",
      allowedDepartments,
      minCgpa: minCgpa.trim() ? Number(minCgpa) : undefined,
      maxArrears: maxArrears.trim() ? Number(maxArrears) : undefined,
      resources,
      rounds,
    };

    setSaving(true);
    try {
      const res = await placementService.createNotice({ email: user.email, role: user.role }, payload);
      if (!res.success) {
        setError(res.message);
        return;
      }
      setSuccessMsg(res.message || "Created.");
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleUploadStudents = (noticeId: string, roundNumber: number) => {
    setError(null);
    setSuccessMsg(null);
    setUploadingRound({ noticeId, roundNumber });
  };

  const handleFileUpload = async () => {
    if (!uploadFile || !uploadingRound) return;
    
    setError(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      const res = await placementService.uploadRoundStudents(
        { email: user.email, role: user.role },
        uploadingRound.noticeId,
        uploadingRound.roundNumber,
        uploadFile
      );
      
      if (res.success) {
        setSuccessMsg(res.message || "Students uploaded successfully");
        setUploadFile(null);
        setUploadingRound(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await load();
      } else {
        setError(res.message || "Failed to upload students");
      }
    } finally {
      setSaving(false);
    }
  };

  const exportEligible = async (notice: PlacementItem) => {
    setError(null);
    setSuccessMsg(null);
    setExportingId(notice.id);
    try {
      const res = await placementService.exportEligibleCsv({ email: user.email, role: user.role }, notice.id);
      if (!res.success || !res.blob) {
        setError(res.message || "Export failed.");
        return;
      }

      const url = URL.createObjectURL(res.blob);
      const a = document.createElement("a");
      a.href = url;
      const safeCompany = (notice.companyName || "company").replace(/[^a-z0-9_-]+/gi, "_");
      a.download = `eligible_students_${safeCompany}_${notice.id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccessMsg("Export started.");
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Placements (Management)</h2>
          <p className="text-sm font-bold text-slate-500 mt-2">Post notices/resources and set eligibility criteria.</p>
          {error ? <p className="text-sm font-black text-rose-600 mt-2">{error}</p> : null}
          {successMsg ? <p className="text-sm font-black text-emerald-700 mt-2">{successMsg}</p> : null}
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

      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-xl font-black text-slate-800">Create Notice</h3>
        <p className="text-sm font-bold text-slate-500 mt-2">Select dates using the calendar picker. Only current and future dates are allowed.</p>

        <form onSubmit={submit} className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Company Name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
          </div>

          <div className="lg:col-span-2 space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={5} className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
          </div>

          <div className="lg:col-span-2 space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Instructions (optional)</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Visit Date (optional)</label>
            <input type="date" min={getTodayString()} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Application Deadline (optional)</label>
            <input type="date" min={getTodayString()} value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Location (optional)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Apply URL (optional)</label>
            <input value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://..." className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
          </div>

          <div className="lg:col-span-2 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <h4 className="text-sm font-black text-slate-800">Eligibility</h4>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2 lg:col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Allowed Departments</label>
                <input
                  value={allowedDepartmentsRaw}
                  onChange={(e) => setAllowedDepartmentsRaw(e.target.value)}
                  placeholder="all or CSE,ECE,IT"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white font-bold"
                />
                <p className="text-xs font-bold text-slate-400">Tip: use "all" to make it visible to everyone.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Min CGPA</label>
                <input
                  value={minCgpa}
                  onChange={(e) => setMinCgpa(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 7.5"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Arrears</label>
                <input
                  value={maxArrears}
                  onChange={(e) => setMaxArrears(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 0"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white font-bold"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <h4 className="text-sm font-black text-slate-800">Resources</h4>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Label</label>
                <input value={resLabel} onChange={(e) => setResLabel(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white font-bold" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">URL</label>
                <div className="flex gap-3">
                  <input value={resUrl} onChange={(e) => setResUrl(e.target.value)} className="flex-1 px-5 py-4 rounded-2xl border border-slate-200 bg-white font-bold" />
                  <button type="button" onClick={addResource} className="px-6 py-4 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all">Add</button>
                </div>
              </div>
            </div>

            {resources.length ? (
              <div className="mt-5 grid gap-2">
                {resources.map((r, idx) => (
                  <div key={`res-${idx}`} className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-slate-100 bg-white">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{r.label}</p>
                      <p className="text-xs font-bold text-slate-400 truncate">{r.url}</p>
                    </div>
                    <button type="button" onClick={() => removeResource(idx)} className="px-4 py-2 text-xs font-black bg-rose-50 text-rose-700 rounded-xl border border-rose-100 hover:bg-rose-100">Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-400 mt-4">No resources added.</p>
            )}
          </div>

          <div className="lg:col-span-2 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <h4 className="text-sm font-black text-slate-800">Placement Rounds</h4>
            <p className="text-xs font-bold text-slate-400 mt-1">Define the rounds for this placement. Students can be uploaded later for each round.</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Round Name</label>
                <input value={roundName} onChange={(e) => setRoundName(e.target.value)} placeholder="e.g. Technical Interview" className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description (optional)</label>
                <div className="flex gap-3">
                  <input value={roundDesc} onChange={(e) => setRoundDesc(e.target.value)} placeholder="e.g. Coding round"  className="flex-1 px-5 py-4 rounded-2xl border border-slate-200 bg-white font-bold" />
                  <button type="button" onClick={addRound} className="px-6 py-4 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all">Add</button>
                </div>
              </div>
            </div>

            {rounds.length ? (
              <div className="mt-5 grid gap-2">
                {rounds.map((r, idx) => (
                  <div key={`round-${idx}`} className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-slate-100 bg-white">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800">Round {idx + 1}: {r.name}</p>
                      {r.description ? <p className="text-xs font-bold text-slate-500">{r.description}</p> : null}
                    </div>
                    <button type="button" onClick={() => removeRound(idx)} className="px-4 py-2 text-xs font-black bg-rose-50 text-rose-700 rounded-xl border border-rose-100 hover:bg-rose-100">Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-400 mt-4">No rounds added. Students will see this as a single-round placement.</p>
            )}
          </div>

          <div className="lg:col-span-2 flex items-center justify-end gap-3">
            <button type="button" onClick={resetForm} className="px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm hover:bg-slate-200 transition-all">
              Clear
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl text-sm shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-60"
            >
              {saving ? "Posting…" : "Post Notice"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-800">My Notices</h3>
          <p className="text-xs font-black text-slate-400">Total: {mine.length}</p>
        </div>

        {sortedMine.length === 0 && !loading ? (
          <div className="p-16 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-sm mb-6">📌</div>
            <h4 className="text-xl font-black text-slate-800">No notices yet</h4>
            <p className="text-slate-400 font-bold mt-2 max-w-xl mx-auto">Create your first placement notice using the form above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedMine.map((n) => (
              <div key={n.id} className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{n.companyName}</p>
                <h4 className="text-lg font-black text-slate-900 mt-2">{n.title}</h4>

                <div className="mt-4 flex flex-wrap gap-2">
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

                {n.rounds && n.rounds.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Rounds ({n.rounds.length})</p>
                    <div className="space-y-2">
                      {n.rounds.map((round) => (
                        <div key={round.roundNumber} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-slate-800">
                                Round {round.roundNumber}: {round.name}
                              </p>
                              {round.description && (
                                <p className="text-xs font-bold text-slate-500 mt-1">{round.description}</p>
                              )}
                              <p className="text-xs font-bold text-slate-600 mt-2">
                                {round.selectedStudents?.length || 0} student(s) selected
                              </p>
                              {round.uploadedAt && (
                                <p className="text-[10px] font-bold text-slate-400 mt-1">
                                  Uploaded: {(() => {
                                    const d = new Date(round.uploadedAt);
                                    const day = String(d.getDate()).padStart(2, '0');
                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                    const year = d.getFullYear();
                                    return `${day}-${month}-${year}`;
                                  })()}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleUploadStudents(n.id, round.roundNumber)}
                              className="px-4 py-2 bg-indigo-600 text-white font-black rounded-xl text-xs hover:bg-indigo-700 transition-all shrink-0"
                            >
                              Upload CSV
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-sm font-bold text-slate-700 mt-4 whitespace-pre-wrap">{(n.description || "").slice(0, 280)}{(n.description || "").length > 280 ? "…" : ""}</p>

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400">Posted: {formatMaybeDate(n.createdAt)}</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => exportEligible(n)}
                      disabled={exportingId === n.id}
                      className="px-5 py-3 bg-indigo-600 text-white font-black rounded-2xl text-sm hover:bg-indigo-700 transition-all disabled:opacity-60"
                    >
                      {exportingId === n.id ? "Exporting…" : "Export Eligible CSV"}
                    </button>
                    {n.applyUrl ? (
                      <button
                        onClick={() => window.open(n.applyUrl as string, "_blank")}
                        className="px-5 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
                      >
                        Open Apply
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {uploadingRound && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-2xl w-full p-8">
            <h3 className="text-2xl font-black text-slate-800">Upload Students for Round</h3>
            <p className="text-sm font-bold text-slate-500 mt-2">
              Upload a CSV file with student identifiers. Supported columns: email, roll_number, or name.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-4 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
                  >
                    {uploadFile ? "Change file" : "Choose CSV/Excel file"}
                  </button>

                  <div className="flex-1 px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 break-all">
                    {uploadFile ? uploadFile.name : "No file selected"}
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-2xl border bg-rose-50 border-rose-100 text-rose-700 font-bold text-sm">{error}</div>
              )}

              {successMsg && (
                <div className="p-4 rounded-2xl border bg-emerald-50 border-emerald-100 text-emerald-700 font-bold text-sm">{successMsg}</div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setUploadingRound(null);
                    setUploadFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={!uploadFile || saving}
                  className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl text-sm shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {saving ? "Uploading..." : "Upload & Notify Students"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagementPlacementsPage;
