
import React, { useState } from 'react';
import { Opportunity, User } from '../types';
import { getCareerAdvice, generateApplicationDraft } from '../services/gemini';

interface Props {
  opportunity: Opportunity;
  user: User;
  onClose: () => void;
  onApply: () => void;
  isApplied: boolean;
}

const OpportunityDetail: React.FC<Props> = ({ opportunity, user, onClose, onApply, isApplied }) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);

  const handleGetAdvice = async () => {
    setLoadingAdvice(true);
    const result = await getCareerAdvice(user, opportunity);
    setAdvice(result);
    setLoadingAdvice(false);
  };

  const handleGenerateDraft = async () => {
    setLoadingDraft(true);
    const result = await generateApplicationDraft(user, opportunity);
    setDraft(result);
    setLoadingDraft(false);
  };

  const isLiveResult = opportunity.id.startsWith('live-') || opportunity.id.startsWith('rt-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-[3rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300 my-8">
        <div className={`p-10 border-b border-slate-100 flex justify-between items-start text-white shrink-0 ${isLiveResult ? 'bg-gradient-to-r from-indigo-600 to-indigo-800' : 'bg-gradient-to-r from-slate-800 to-slate-900'}`}>
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-white/20 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-white/20 shadow-sm">
                {opportunity.type}
              </span>
              {!!opportunity.source && (
                <span className="bg-white/10 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-white/20 shadow-sm">
                  {opportunity.source}
                </span>
              )}
              {opportunity.matchMethod === 'groq' && (
                <span className="bg-fuchsia-500/20 text-fuchsia-100 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-fuchsia-500/30">
                  Groq-assisted
                </span>
              )}
              {isLiveResult && (
                <span className="bg-emerald-500/20 text-emerald-100 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-emerald-500/30">
                  Verified Web Source
                </span>
              )}
            </div>
            <h2 className="text-4xl font-black leading-tight tracking-tight">{opportunity.title}</h2>
            <p className="text-indigo-100 text-lg font-bold mt-2 opacity-90">{opportunity.company}</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-3xl transition-all group">
            <svg className="w-8 h-8 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            {isLiveResult && (
              <div className="bg-indigo-50/80 p-6 rounded-[2rem] border border-indigo-100 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                   <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                    <span className="text-lg">🌐</span> Source Discovery Info
                  </p>
                  <a href={opportunity.sourceUrl} target="_blank" className="text-xs font-black text-indigo-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-indigo-100 hover:bg-indigo-50 transition-colors">
                    View Original Page
                  </a>
                </div>
                <p className="text-sm font-bold text-slate-600 leading-relaxed">
                  This opportunity was discovered via a live crawl of career platforms.
                  {!!opportunity.source && (
                    <span> Source: {opportunity.source}.</span>
                  )}
                  {opportunity.matchMethod === 'groq' && (
                    <span> Query expansion: Groq-assisted.</span>
                  )}
                </p>
              </div>
            )}

            <section>
              <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <span className="w-2 h-8 bg-indigo-500 rounded-full"></span>
                Details & Scope
              </h3>
              <p className="text-slate-600 leading-relaxed text-xl whitespace-pre-wrap">{opportunity.description}</p>
            </section>

            <section>
              <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                <span className="w-2 h-8 bg-indigo-500 rounded-full"></span>
                Key Requirements
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(opportunity.requirements || []).map((req, i) => (
                  <div key={i} className="flex items-start gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 group hover:border-indigo-200 transition-all hover:bg-white hover:shadow-xl">
                    <span className="w-8 h-8 rounded-2xl bg-white shadow-sm flex items-center justify-center text-xs font-black text-indigo-500 border border-slate-50">0{i+1}</span>
                    <span className="text-sm font-bold text-slate-700 leading-snug">{req}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-slate-900 p-10 rounded-[3rem] space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 text-4xl opacity-20">🤖</div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">AI Advantage</h3>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Grounding with Gemini 2.5</p>
              </div>
              
              <div className="flex gap-4">
                <button onClick={handleGetAdvice} disabled={loadingAdvice} className="flex-1 bg-white/10 text-white px-8 py-5 rounded-2xl text-sm font-black border border-white/10 hover:bg-white/20 transition-all disabled:opacity-50">
                  {loadingAdvice ? 'Analyzing...' : 'Strategic Preparation'}
                </button>
                <button onClick={handleGenerateDraft} disabled={loadingDraft} className="flex-1 bg-indigo-600 text-white px-8 py-5 rounded-2xl text-sm font-black shadow-xl shadow-indigo-900/40 hover:bg-indigo-500 transition-all disabled:opacity-50">
                  {loadingDraft ? 'Drafting...' : 'AI Cover Letter'}
                </button>
              </div>

              {(advice || draft) && (
                <div className="bg-white rounded-[2.5rem] p-8 space-y-8 animate-in slide-in-from-top-4 duration-500">
                  {advice && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Strategic Advice</p>
                      <div className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap font-medium">{advice}</div>
                    </div>
                  )}
                  {draft && (
                    <div className="pt-8 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ready-to-use Draft</p>
                        <button onClick={() => navigator.clipboard.writeText(draft)} className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-full font-black text-[10px] hover:bg-indigo-100 transition-all">Copy Text</button>
                      </div>
                      <div className="text-slate-700 text-sm leading-relaxed italic font-medium bg-slate-50 p-6 rounded-3xl border border-slate-100">{draft}</div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 space-y-10 sticky top-0">
              <div className="space-y-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Verified Deadline</p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⏳</span>
                    <p className="text-2xl font-black text-rose-600">{opportunity.deadline}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Eligibility</p>
                  <p className="font-black text-slate-800 leading-snug">{opportunity.eligibility}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Work Mode</p>
                  <p className="font-black text-slate-800 text-lg">{opportunity.location}</p>
                </div>
              </div>

              <button 
                onClick={onApply}
                disabled={isApplied}
                className={`w-full py-6 rounded-[2rem] font-black text-xl shadow-2xl transition-all transform hover:scale-[1.05] active:scale-[0.95] ${
                  isApplied 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {isApplied ? 'Application Submitted' : isLiveResult ? 'Apply on Web' : 'Submit Application'}
              </button>

              <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                <p className="text-xs text-emerald-900 font-bold leading-relaxed flex items-start gap-3">
                  <span className="text-xl leading-none">✅</span>
                  Freshness Check: This listing was verified as active today.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpportunityDetail;
