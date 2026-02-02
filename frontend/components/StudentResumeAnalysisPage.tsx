import React from "react";
import { User } from "../types";
import { resumeAnalysisService, ResumeAnalysisResult } from "../services/resumeAnalysis";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
    <h3 className="text-lg font-black text-slate-800 mb-4">{title}</h3>
    {children}
  </div>
);

const List = ({ items }: { items: string[] }) => (
  <ul className="space-y-2">
    {items.map((t, i) => (
      <li key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700">
        {t}
      </li>
    ))}
  </ul>
);

export default function StudentResumeAnalysisPage({ user }: { user: User }) {
  const [jobDescription, setJobDescription] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<{ model?: string | null } | null>(null);
  const [result, setResult] = React.useState<ResumeAnalysisResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setMeta(null);

    if (!file) {
      setError("Please upload your resume (PDF recommended).");
      return;
    }
    if (jobDescription.trim().length < 20) {
      setError("Please paste a job description (at least 20 characters).");
      return;
    }

    setLoading(true);
    try {
      const res = await resumeAnalysisService.analyze(
        { email: user.email, role: user.role },
        { jobDescription: jobDescription.trim(), resumeFile: file }
      );

      if (!res.success) {
        setError(res.message || "Analysis failed");
        return;
      }

      setMeta({ model: res.model || null });
      setResult((res.result as any) || null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Resume Analyzer</h2>
            <p className="text-slate-500 font-bold mt-2">
              Upload your resume and a job description to get strengths, improvements, and ATS-focused feedback.
            </p>
            {meta?.model ? (
              <p className="text-xs font-bold text-slate-400 mt-2">Model: {meta.model}</p>
            ) : null}
          </div>
        </div>
      </header>

      <Section title="Upload & Analyze">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Resume (PDF recommended)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
              >
                {file ? "Change file" : "Choose file"}
              </button>

              <div className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 break-all">
                {file ? file.name : "No file selected"}
              </div>

              {file ? (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-5 py-3 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm border border-slate-200 hover:bg-slate-200 transition-all"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Job Description</p>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={10}
              placeholder="Paste the job description here..."
              className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {error ? (
            <div className="p-4 rounded-2xl border bg-rose-50 border-rose-100 text-rose-700 font-bold">{error}</div>
          ) : null}

          <button
            disabled={loading}
            className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze Resume"}
          </button>
        </form>
      </Section>

      {result ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2rem] p-6 text-white shadow-2xl shadow-indigo-200">
              <p className="text-xs font-black uppercase tracking-widest text-indigo-100">Overall Fit Score</p>
              <p className="text-5xl font-black mt-3">{result.overallFitScore}</p>
              <p className="text-sm font-bold text-indigo-100 mt-2">out of 100</p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Suggested Summary</p>
              <p className="mt-3 text-slate-800 font-bold whitespace-pre-wrap">
                {result.suggestedSummary || "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Strengths">
              {result.strengths?.length ? <List items={result.strengths} /> : <p className="text-sm font-bold text-slate-500">—</p>}
            </Section>

            <Section title="Gaps / Missing Info">
              {result.gaps?.length ? <List items={result.gaps} /> : <p className="text-sm font-bold text-slate-500">—</p>}
            </Section>
          </div>

          <Section title="Improvements (Actionable)">
            {result.improvements?.length ? (
              <div className="space-y-3">
                {result.improvements.map((it, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-sm font-black text-slate-900">{it.area}</p>
                    <p className="mt-2 text-sm font-bold text-slate-700">{it.recommendation}</p>
                    {it.example ? (
                      <p className="mt-3 text-xs font-bold text-slate-500 whitespace-pre-wrap">Example: {it.example}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-bold text-slate-500">—</p>
            )}
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Missing Keywords">
              {result.missingKeywords?.length ? <List items={result.missingKeywords} /> : <p className="text-sm font-bold text-slate-500">—</p>}
            </Section>

            <Section title="ATS Warnings">
              {result.atsWarnings?.length ? <List items={result.atsWarnings} /> : <p className="text-sm font-bold text-slate-500">—</p>}
            </Section>
          </div>

          <Section title="Suggested Bullet Points">
            {result.suggestedBullets?.length ? <List items={result.suggestedBullets} /> : <p className="text-sm font-bold text-slate-500">—</p>}
          </Section>

          <Section title="Final Feedback">
            <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{result.finalFeedback || "—"}</p>
          </Section>
        </>
      ) : null}
    </div>
  );
}
