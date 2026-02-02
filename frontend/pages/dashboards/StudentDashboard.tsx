import { useNavigate } from 'react-router-dom';
import { User, Opportunity, CrawlMeta } from '../../types';

interface StudentDashboardProps {
  user: User;
  discoveredOpps: Opportunity[];
  mockOpportunities: Opportunity[];
  stats: Array<{ label: string; value: number | string; color: string; bg: string; icon: string }>;
  isCrawling: boolean;
  lastCrawlTime: string | null;
  crawlMeta: CrawlMeta | null;
  groqBoostedCount: number;
  handleDeepDiscovery: () => void;
  setSelectedOpp: (opp: Opportunity) => void;
  handleLogout: () => void;
}

export default function StudentDashboard({
  user,
  discoveredOpps,
  mockOpportunities,
  stats,
  isCrawling,
  lastCrawlTime,
  crawlMeta,
  groqBoostedCount,
  handleDeepDiscovery,
  setSelectedOpp,
  handleLogout,
}: StudentDashboardProps) {
  const navigate = useNavigate();

  return (
    <>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-3xl shadow-lg shadow-indigo-100">🚀</div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">KEC Opportunities Hub</h2>
            <p className="text-slate-500 font-bold mt-1">
              {isCrawling ? (
                <span className="flex items-center gap-2 text-indigo-600 animate-pulse">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                  Crawling live for {user.department}...
                </span>
              ) : (
                `Logged in as ${user.name} • Updated: ${lastCrawlTime || 'Just now'}`
              )}
            </p>
            {crawlMeta && !isCrawling && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 uppercase tracking-widest">
                  Groq: {crawlMeta.groqEnabled ? (crawlMeta.groqUsed ? 'Used' : 'Enabled') : 'Off'}
                </span>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${crawlMeta.webSearchEnabled ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-slate-600 bg-slate-50 border-slate-100'}`}>
                  Web: {crawlMeta.webSearchEnabled ? (crawlMeta.webSearchProvider || 'On') : 'Off'}
                </span>
                {crawlMeta.groqEnabled && (
                  <span className="text-[10px] font-black text-fuchsia-700 bg-fuchsia-50 px-3 py-1 rounded-full border border-fuchsia-100 uppercase tracking-widest">
                    Groq Boost: {groqBoostedCount}
                  </span>
                )}
                {crawlMeta.webSearchError ? (
                  <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-100 uppercase tracking-widest">
                    Web Error
                  </span>
                ) : null}
              </div>
            )}
            {crawlMeta?.webSearchError && !isCrawling ? (
              <p className="mt-2 text-xs font-black text-rose-600">{crawlMeta.webSearchError}</p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDeepDiscovery}
            disabled={isCrawling}
            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50 group"
          >
            {isCrawling ? 'Crawling Web...' : 'Scan Live Web'}
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <div key={i} className={`${stat.bg} p-6 rounded-3xl border border-white shadow-sm flex flex-col justify-between h-32`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl">{stat.icon}</span>
              <p className={`text-xs font-black uppercase tracking-widest ${stat.color} opacity-60`}>{stat.label}</p>
            </div>
            <p className="text-4xl font-black text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <span className="p-2 bg-indigo-100 rounded-xl text-indigo-600 text-sm">🔥</span>
              Latest Discoveries
            </h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 uppercase tracking-widest">
              Realtime Extracted Results
            </span>
          </div>
          
          <div className="grid gap-4">
            {discoveredOpps.length > 0 ? discoveredOpps.map((opp) => (
              <div 
                key={opp.id} 
                onClick={() => setSelectedOpp(opp)}
                className="group bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-lg border border-indigo-100">
                        {opp.type}
                      </span>
                      {opp.source && (
                        <span className="px-3 py-1 bg-slate-50 text-slate-600 text-[10px] font-black uppercase rounded-lg border border-slate-100">
                          {opp.source}
                        </span>
                      )}
                      {String(opp.matchMethod || '').toLowerCase().includes('groq') && (
                        <span className="px-3 py-1 bg-fuchsia-50 text-fuchsia-700 text-[10px] font-black uppercase rounded-lg border border-fuchsia-100">
                          GROQ BOOST
                        </span>
                      )}
                      <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                        LIVE LISTING
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{opp.title}</h4>
                    <p className="text-slate-500 font-bold text-sm mt-1">{opp.company} • {opp.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                      Ends: {opp.deadline}
                    </span>
                    <button className="text-indigo-600 font-black text-sm group-hover:underline">Quick Apply →</button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-20 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
                <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-sm mb-6">🔍</div>
                <h4 className="text-xl font-black text-slate-800">Ready to discover?</h4>
                <p className="text-slate-400 font-bold mt-2 max-w-xs mx-auto">Click Scan Live Web to fetch realtime opportunities matching your profile. If you get 0 results, set WEB_SEARCH_PROVIDER=google_cse (or serpapi) and configure the keys in backend/.env.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-3">
              <span className="p-2 bg-amber-100 rounded-xl text-amber-600 text-xs">🏛️</span>
              KEC Notices
            </h3>
            <div className="space-y-4">
              {mockOpportunities.map(opp => (
                <div key={opp.id} onClick={() => setSelectedOpp(opp)} className="p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 cursor-pointer transition-all">
                  <h5 className="font-black text-slate-800 text-sm leading-snug">{opp.title}</h5>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{opp.company}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200">
            <h4 className="font-black text-xl mb-3">AI Coach 🤖</h4>
            <p className="text-sm text-indigo-100 font-bold mb-6 leading-relaxed">
              We found new technical roles in {user.department}. Start a specialized interview prep session?
            </p>
            <button className="w-full py-4 bg-white text-indigo-600 font-black rounded-2xl text-sm shadow-xl hover:bg-indigo-50 transition-all active:scale-95">
              Start Session
            </button>
          </div>

          <button onClick={handleLogout} className="w-full py-4 bg-slate-100 text-slate-400 hover:text-rose-500 font-black rounded-2xl text-xs uppercase tracking-widest transition-all">
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
