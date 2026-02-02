
import React, { useState, useEffect } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import Layout from './components/Layout';
import AuthPage from './components/AuthPage';
import { MOCK_OPPORTUNITIES, MOCK_APPLICATIONS, MOCK_INTERVIEWS } from './constants';
import { CrawlMeta, Opportunity, Application, Interview, User } from './types';
import OpportunityDetail from './components/OpportunityDetail';
import { crawlActiveOpportunitiesWithMeta } from './services/opportunityCrawler';
import ProfilePage from './components/ProfilePage';
import AlumniHub from './components/AlumniHub';
import AlumniPostsPage from './components/AlumniPostsPage';
import ReferralInboxPage from './components/ReferralInboxPage';
import ChatPage from './components/ChatPage';
import StudentEventsPage from './components/StudentEventsPage';
import EventManagerEventsPage from './components/EventManagerEventsPage';
import StudentPlacementsPage from './components/StudentPlacementsPage';
import ManagementPlacementsPage from './components/ManagementPlacementsPage';
import ManagementInstructionsPage from './components/ManagementInstructionsPage';
import ManagementNotesPage from './components/ManagementNotesPage';
import StudentInstructionsPage from './components/StudentInstructionsPage';
import StudentNotesPage from './components/StudentNotesPage';
import StudentResumeAnalysisPage from './components/StudentResumeAnalysisPage';
import { eventService, EventItem } from './services/events';
import { alumniService, AlumniPost } from './services/alumni';
import { referralService, ReferralRequestItem } from './services/referrals';
import { placementService, PlacementItem } from './services/placements';
import { managementContentService, InstructionItem, NoteItem } from './services/managementContent';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [applications, setApplications] = useState<Application[]>(MOCK_APPLICATIONS);
  const [interviews, setInterviews] = useState<Interview[]>(MOCK_INTERVIEWS);
  const [discoveredOpps, setDiscoveredOpps] = useState<Opportunity[]>([]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [lastCrawlTime, setLastCrawlTime] = useState<string | null>(null);
  const [crawlMeta, setCrawlMeta] = useState<CrawlMeta | null>(null);

  const [managerEvents, setManagerEvents] = useState<EventItem[]>([]);
  const [managerRegsByEvent, setManagerRegsByEvent] = useState<Record<string, number>>({});
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerLastUpdated, setManagerLastUpdated] = useState<string | null>(null);

  const [alumniPosts, setAlumniPosts] = useState<AlumniPost[]>([]);
  const [alumniRequests, setAlumniRequests] = useState<ReferralRequestItem[]>([]);
  const [alumniLoading, setAlumniLoading] = useState(false);
  const [alumniLastUpdated, setAlumniLastUpdated] = useState<string | null>(null);

  const [mgmtPlacements, setMgmtPlacements] = useState<PlacementItem[]>([]);
  const [mgmtInstructions, setMgmtInstructions] = useState<InstructionItem[]>([]);
  const [mgmtNotes, setMgmtNotes] = useState<NoteItem[]>([]);
  const [mgmtLoading, setMgmtLoading] = useState(false);
  const [mgmtLastUpdated, setMgmtLastUpdated] = useState<string | null>(null);

  const groqBoostedCount = discoveredOpps.filter(o => String(o.matchMethod || '').toLowerCase().includes('groq')).length;

  const AUTO_CRAWL_KEY = 'kec_auto_crawl_last_at';
  const AUTO_CRAWL_MIN_INTERVAL_MS = 60_000;

  // Persistence check
  useEffect(() => {
    const savedUser = localStorage.getItem('kec_current_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (activeTab !== 'dashboard') return;

    if (user.role === 'event_manager') {
      // Event manager dashboard uses event stats; discovery stats are not relevant.
      setSelectedOpp(null);
      loadManagerDashboard();
      return;
    }

    if (user.role === 'alumni') {
      setSelectedOpp(null);
      loadAlumniDashboard();
      return;
    }

    if (user.role === 'management') {
      setSelectedOpp(null);
      loadManagementDashboard();
      return;
    }

    if (user.role === 'student') {
      // Auto-scan live web whenever student lands on Dashboard (including reload).
      // Throttle to avoid repeated scans from rapid re-renders.
      if (isCrawling) return;
      try {
        const last = Number(sessionStorage.getItem(AUTO_CRAWL_KEY) || '0');
        const now = Date.now();
        if (!Number.isFinite(last) || now - last >= AUTO_CRAWL_MIN_INTERVAL_MS) {
          sessionStorage.setItem(AUTO_CRAWL_KEY, String(now));
          setSelectedOpp(null);
          handleDeepDiscovery();
        }
      } catch {
        setSelectedOpp(null);
        handleDeepDiscovery();
      }
      return;
    }
  }, [user?.email, user?.role, activeTab, isCrawling]);

  const handleLoginSuccess = (userData: any) => {
    const skills = Array.isArray(userData?.skills) ? userData.skills : ['React', 'TypeScript'];
    const fullUser: User = {
      ...userData,
      id: `u-${Date.now()}`,
      role: userData?.role || 'student',
      department: userData?.department || 'Computer Science',
      skills // Defaults if backend doesn't provide
    };
    setUser(fullUser);
    localStorage.setItem('kec_current_user', JSON.stringify(fullUser));
  };

  const handleUserUpdated = (updated: User) => {
    setUser(updated);
    localStorage.setItem('kec_current_user', JSON.stringify(updated));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('kec_current_user');
  };

  if (!user) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  const loadManagerDashboard = async () => {
    if (user.role !== 'event_manager') return;
    setManagerLoading(true);
    try {
      const events = await eventService.listMine({ email: user.email, role: user.role });
      setManagerEvents(events);

      // Aggregate registrations count per event (best-effort; keep UI responsive)
      const regsEntries = await Promise.all(
        events.map(async (e) => {
          const regs = await eventService.listRegistrations({ email: user.email, role: user.role }, e.id);
          return [e.id, regs.length] as const;
        })
      );
      setManagerRegsByEvent(Object.fromEntries(regsEntries));
      setManagerLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setManagerLoading(false);
    }
  };

  const loadAlumniDashboard = async () => {
    if (user.role !== 'alumni') return;
    setAlumniLoading(true);
    try {
      const [posts, requests] = await Promise.all([
        alumniService.listPostsByAlumni(user.email),
        referralService.inbox({ email: user.email, role: user.role }),
      ]);
      setAlumniPosts(posts);
      setAlumniRequests(requests);
      setAlumniLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setAlumniLoading(false);
    }
  };

  const loadManagementDashboard = async () => {
    if (user.role !== 'management') return;
    setMgmtLoading(true);
    try {
      const [placements, instructions, notes] = await Promise.all([
        placementService.listMine({ email: user.email, role: user.role }),
        managementContentService.listMyInstructions({ email: user.email, role: user.role }),
        managementContentService.listMyNotes({ email: user.email, role: user.role }),
      ]);

      setMgmtPlacements(placements);
      setMgmtInstructions(instructions);
      setMgmtNotes(notes);
      setMgmtLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setMgmtLoading(false);
    }
  };

  const stats = [
    { label: 'Live Discoveries', value: discoveredOpps.length, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: '📡' },
    { label: 'Applied', value: applications.length, color: 'text-blue-600', bg: 'bg-blue-50', icon: '📝' },
    { label: 'Interviews', value: interviews.filter(i => i.status === 'Upcoming').length, color: 'text-rose-600', bg: 'bg-rose-50', icon: '🤝' },
    { label: 'KEC Notices', value: MOCK_OPPORTUNITIES.length, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '🏛️' },
  ];

  const handleDeepDiscovery = async () => {
    setIsCrawling(true);
    const { opportunities, meta } = await crawlActiveOpportunitiesWithMeta(user);
    setDiscoveredOpps(opportunities);
    setCrawlMeta(meta);
    setLastCrawlTime(new Date().toLocaleTimeString());
    setIsCrawling(false);
  };

  const handleApply = (opp: Opportunity) => {
    if (applications.some(a => a.opportunityId === opp.id)) return;
    
    const newApp: Application = {
      id: `a${Date.now()}`,
      opportunityId: opp.id,
      studentId: user.id,
      appliedDate: new Date().toISOString().split('T')[0],
      status: 'Applied'
    };
    setApplications([...applications, newApp]);

    if (opp.sourceUrl && opp.sourceUrl !== "#") {
      window.open(opp.sourceUrl, '_blank');
    }
  };

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {user.role === 'alumni' ? (
        <>
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-3xl shadow-lg shadow-indigo-100">🎓</div>
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Alumni Dashboard</h2>
                <p className="text-slate-500 font-bold mt-1">
                  {alumniLoading ? (
                    <span className="flex items-center gap-2 text-indigo-600 animate-pulse">
                      <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                      Loading your posts and referrals...
                    </span>
                  ) : (
                    `Logged in as ${user.name} • Updated: ${alumniLastUpdated || 'Just now'}`
                  )}
                </p>
                <p className="text-xs font-bold text-slate-400 mt-1">Manage your posts and respond to student referral requests.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadAlumniDashboard}
                disabled={alumniLoading}
                className="px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                onClick={() => setActiveTab('alumni_posts')}
                className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all group"
              >
                Create / Manage Posts
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {(() => {
              const totalPosts = alumniPosts.length;
              const pending = alumniRequests.filter(r => r.status === 'pending').length;
              const approved = alumniRequests.filter(r => r.status === 'approved').length;
              const rejected = alumniRequests.filter(r => r.status === 'rejected').length;
              const decided = approved + rejected;
              const totalReq = alumniRequests.length;
              const responseRate = totalReq > 0 ? Math.round((decided / totalReq) * 100) : 0;

              const cards = [
                { label: 'Posts Uploaded', value: totalPosts, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: '🧾' },
                { label: 'Pending Requests', value: pending, color: 'text-amber-700', bg: 'bg-amber-50', icon: '⏳' },
                { label: 'Approved', value: approved, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '✅' },
                { label: 'Response Rate', value: `${responseRate}%`, color: 'text-blue-700', bg: 'bg-blue-50', icon: '📈' },
              ];

              return cards.map((stat, i) => (
                <div key={i} className={`${stat.bg} p-6 rounded-3xl border border-white shadow-sm flex flex-col justify-between h-32`}>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{stat.icon}</span>
                    <p className={`text-xs font-black uppercase tracking-widest ${stat.color} opacity-60`}>{stat.label}</p>
                  </div>
                  <p className="text-4xl font-black text-slate-900">{stat.value}</p>
                </div>
              ));
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <span className="p-2 bg-amber-100 rounded-xl text-amber-700 text-sm">📥</span>
                  Pending Referral Requests
                </h3>
                <button
                  onClick={() => setActiveTab('alumni_requests')}
                  className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-2 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-all"
                >
                  Open Referrals →
                </button>
              </div>

              {(() => {
                const pending = alumniRequests.filter(r => r.status === 'pending');
                if (pending.length === 0) {
                  return (
                    <div className="p-16 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
                      <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-sm mb-6">✅</div>
                      <h4 className="text-xl font-black text-slate-800">No pending requests</h4>
                      <p className="text-slate-400 font-bold mt-2 max-w-xs mx-auto">Approved/rejected requests are available in the Referrals tab (Seen section).</p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-4">
                    {pending.slice(0, 6).map(r => (
                      <div key={r.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase rounded-lg border border-amber-100">PENDING</span>
                              {r.postId ? (
                                <span className="px-3 py-1 bg-slate-50 text-slate-600 text-[10px] font-black uppercase rounded-lg border border-slate-100">POST</span>
                              ) : null}
                            </div>
                            <h4 className="text-lg font-black text-slate-800 break-all">{r.studentEmail}</h4>
                            <p className="text-slate-600 font-bold text-sm mt-2 whitespace-pre-wrap">{(r.message || '').slice(0, 220)}{(r.message || '').length > 220 ? '…' : ''}</p>
                            <p className="text-xs font-bold text-slate-400 mt-3">Requested: {new Date(r.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setActiveTab('alumni_requests')}
                              className="px-6 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                    <span className="p-2 bg-indigo-100 rounded-xl text-indigo-600 text-xs">🗂️</span>
                    Recent Posts
                  </h3>
                  <button
                    onClick={() => setActiveTab('alumni_posts')}
                    className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-2 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-all uppercase tracking-widest"
                  >
                    Open
                  </button>
                </div>

                {alumniPosts.length ? (
                  <div className="space-y-3">
                    {alumniPosts.slice(0, 5).map(p => (
                      <div key={p.id} className="p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-all">
                        <h5 className="font-black text-slate-800 text-sm leading-snug">{p.title}</h5>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{new Date(p.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-slate-500">No posts yet. Create one to help students.</p>
                )}
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                <h4 className="font-black text-xl mb-3">Quick Actions</h4>
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveTab('alumni_posts')}
                    className="w-full py-4 bg-white text-slate-900 font-black rounded-2xl text-sm hover:bg-slate-100 transition-all"
                  >
                    Post Opportunity
                  </button>
                  <button
                    onClick={() => setActiveTab('alumni_requests')}
                    className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl text-sm hover:bg-slate-700 transition-all"
                  >
                    Review Referrals
                  </button>
                </div>
              </div>

              <button onClick={handleLogout} className="w-full py-4 bg-slate-100 text-slate-400 hover:text-rose-500 font-black rounded-2xl text-xs uppercase tracking-widest transition-all">
                Sign Out
              </button>
            </div>
          </div>
        </>
      ) : null}

      {user.role === 'management' ? (
        <>
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-3xl shadow-lg shadow-indigo-100">🏢</div>
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Management Dashboard</h2>
                <p className="text-slate-500 font-bold mt-1">
                  {mgmtLoading ? (
                    <span className="flex items-center gap-2 text-indigo-600 animate-pulse">
                      <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                      Loading placements and resources...
                    </span>
                  ) : (
                    `Logged in as ${user.name} • Updated: ${mgmtLastUpdated || 'Just now'}`
                  )}
                </p>
                <p className="text-xs font-bold text-slate-400 mt-1">Post placement notices, instructions, and share notes by department.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadManagementDashboard}
                disabled={mgmtLoading}
                className="px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                onClick={() => setActiveTab('placements_manage')}
                className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all group"
              >
                Manage Placements
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {(() => {
              const totalPlacements = mgmtPlacements.length;
              const now = Date.now();
              const activePlacements = mgmtPlacements.filter(p => {
                const dl = p.applicationDeadline ? Date.parse(p.applicationDeadline) : NaN;
                if (!Number.isFinite(dl)) return true; // no deadline => treat as active
                return dl >= now;
              }).length;
              const totalInstructions = mgmtInstructions.length;
              const totalNotes = mgmtNotes.length;

              const cards = [
                { label: 'Placement Notices', value: totalPlacements, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: '📌' },
                { label: 'Active Notices', value: activePlacements, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '⏳' },
                { label: 'Instructions Posted', value: totalInstructions, color: 'text-blue-700', bg: 'bg-blue-50', icon: '🧾' },
                { label: 'Notes Uploaded', value: totalNotes, color: 'text-amber-700', bg: 'bg-amber-50', icon: '📎' },
              ];

              return cards.map((stat, i) => (
                <div key={i} className={`${stat.bg} p-6 rounded-3xl border border-white shadow-sm flex flex-col justify-between h-32`}>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{stat.icon}</span>
                    <p className={`text-xs font-black uppercase tracking-widest ${stat.color} opacity-60`}>{stat.label}</p>
                  </div>
                  <p className="text-4xl font-black text-slate-900">{stat.value}</p>
                </div>
              ));
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <span className="p-2 bg-indigo-100 rounded-xl text-indigo-600 text-sm">📌</span>
                  Recent Placement Notices
                </h3>
                <button
                  onClick={() => setActiveTab('placements_manage')}
                  className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-2 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-all"
                >
                  Open Placements →
                </button>
              </div>

              {mgmtPlacements.length ? (
                <div className="grid gap-4">
                  {mgmtPlacements
                    .slice()
                    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
                    .slice(0, 6)
                    .map((p) => (
                      <div key={p.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="text-xl font-black text-slate-800">{p.companyName} • {p.title}</h4>
                            <p className="text-slate-500 font-bold text-sm mt-1">
                              {p.applicationDeadline ? `Deadline: ${new Date(p.applicationDeadline).toLocaleString()}` : 'No deadline set'}
                            </p>
                            <p className="text-xs font-bold text-slate-400 mt-2">
                              Visibility: {Array.isArray(p.allowedDepartments) && p.allowedDepartments.length ? p.allowedDepartments.join(', ') : 'All Departments'}
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveTab('placements_manage')}
                            className="px-5 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-16 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
                  <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-sm mb-6">📌</div>
                  <h4 className="text-xl font-black text-slate-800">No placement notices yet</h4>
                  <p className="text-slate-400 font-bold mt-2 max-w-xs mx-auto">Create your first notice to start sharing eligible opportunities.</p>
                  <button
                    onClick={() => setActiveTab('placements_manage')}
                    className="mt-6 px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all"
                  >
                    Create Placement Notice
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100">
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-3">
                  <span className="p-2 bg-emerald-100 rounded-xl text-emerald-700 text-xs">⚡</span>
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveTab('mgmt_instructions')}
                    className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
                  >
                    Post Instructions
                  </button>
                  <button
                    onClick={() => setActiveTab('mgmt_notes')}
                    className="w-full py-4 bg-slate-100 text-slate-800 font-black rounded-2xl text-sm hover:bg-slate-200 transition-all"
                  >
                    Upload Notes
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100">
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-3">
                  <span className="p-2 bg-blue-100 rounded-xl text-blue-700 text-xs">🕒</span>
                  Recent Content
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Latest Instruction</p>
                    <p className="mt-1 font-black text-slate-800">
                      {mgmtInstructions.length ? mgmtInstructions.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0].title : '—'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Latest Note</p>
                    <p className="mt-1 font-black text-slate-800">
                      {mgmtNotes.length ? mgmtNotes.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0].title : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <button onClick={handleLogout} className="w-full py-4 bg-slate-100 text-slate-400 hover:text-rose-500 font-black rounded-2xl text-xs uppercase tracking-widest transition-all">
                Sign Out
              </button>
            </div>
          </div>
        </>
      ) : null}

      {user.role === 'event_manager' ? (
        <>
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-3xl shadow-lg shadow-indigo-100">📅</div>
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Events Dashboard</h2>
                <p className="text-slate-500 font-bold mt-1">
                  {managerLoading ? (
                    <span className="flex items-center gap-2 text-indigo-600 animate-pulse">
                      <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                      Loading your events...
                    </span>
                  ) : (
                    `Logged in as ${user.name} • Updated: ${managerLastUpdated || 'Just now'}`
                  )}
                </p>
                <p className="text-xs font-bold text-slate-400 mt-1">Track events you uploaded and student registrations.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadManagerDashboard}
                disabled={managerLoading}
                className="px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                onClick={() => setActiveTab('events_manage')}
                className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all group"
              >
                Manage Events
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {(() => {
              const totalEvents = managerEvents.length;
              const totalRegs = (Object.values(managerRegsByEvent) as number[]).reduce((a, b) => a + (b || 0), 0);
              const now = Date.now();
              const upcoming = managerEvents.filter(e => {
                const t = Date.parse(e.startAt);
                return Number.isFinite(t) ? t >= now : false;
              }).length;
              const avg = totalEvents > 0 ? Math.round((totalRegs / totalEvents) * 10) / 10 : 0;
              const cards = [
                { label: 'Events Uploaded', value: totalEvents, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: '📌' },
                { label: 'Total Registrations', value: totalRegs, color: 'text-blue-600', bg: 'bg-blue-50', icon: '🧾' },
                { label: 'Upcoming Events', value: upcoming, color: 'text-rose-600', bg: 'bg-rose-50', icon: '⏳' },
                { label: 'Avg / Event', value: avg, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '📈' },
              ];
              return cards.map((stat, i) => (
                <div key={i} className={`${stat.bg} p-6 rounded-3xl border border-white shadow-sm flex flex-col justify-between h-32`}>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{stat.icon}</span>
                    <p className={`text-xs font-black uppercase tracking-widest ${stat.color} opacity-60`}>{stat.label}</p>
                  </div>
                  <p className="text-4xl font-black text-slate-900">{stat.value}</p>
                </div>
              ));
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <span className="p-2 bg-indigo-100 rounded-xl text-indigo-600 text-sm">🗓️</span>
                  Recent Events
                </h3>
                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 uppercase tracking-widest">
                  {managerEvents.length} total
                </span>
              </div>

              <div className="grid gap-4">
                {managerEvents.length ? (
                  managerEvents.slice(0, 8).map((e) => (
                    <div key={e.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-xl font-black text-slate-800">{e.title}</h4>
                          <p className="text-slate-500 font-bold text-sm mt-1">{e.venue ? `${e.venue} • ` : ''}{new Date(e.startAt).toLocaleString()}</p>
                          <p className="text-xs font-bold text-slate-400 mt-2">
                            Visibility: {Array.isArray(e.allowedDepartments) && e.allowedDepartments.length ? e.allowedDepartments.join(', ') : 'All Departments'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registrations</p>
                            <p className="text-2xl font-black text-slate-900">{managerRegsByEvent[e.id] ?? '—'}</p>
                          </div>
                          <button
                            onClick={() => setActiveTab('events_manage')}
                            className="px-5 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-16 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-sm mb-6">🧩</div>
                    <h4 className="text-xl font-black text-slate-800">No events yet</h4>
                    <p className="text-slate-400 font-bold mt-2 max-w-xs mx-auto">Create your first event to start collecting registrations.</p>
                    <button
                      onClick={() => setActiveTab('events_manage')}
                      className="mt-6 px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all"
                    >
                      Create Event
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100">
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-3">
                  <span className="p-2 bg-emerald-100 rounded-xl text-emerald-700 text-xs">✅</span>
                  Quick Tips
                </h3>
                <ul className="space-y-3 text-sm font-bold text-slate-600">
                  <li className="p-4 rounded-2xl bg-slate-50 border border-slate-100">Add department visibility to avoid irrelevant registrations.</li>
                  <li className="p-4 rounded-2xl bg-slate-50 border border-slate-100">Use a poster (PNG/JPG) to improve click-through.</li>
                  <li className="p-4 rounded-2xl bg-slate-50 border border-slate-100">Keep form fields minimal to reduce drop-offs.</li>
                </ul>
              </div>

              <button onClick={handleLogout} className="w-full py-4 bg-slate-100 text-slate-400 hover:text-rose-500 font-black rounded-2xl text-xs uppercase tracking-widest transition-all">
                Sign Out
              </button>
            </div>
          </div>
        </>
      ) : null}

      {user.role === 'student' ? (
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
              {MOCK_OPPORTUNITIES.map(opp => (
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
      ) : null}
    </div>
  );

  return (
    <Router>
      <Layout user={user} activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'placements' && user.role === 'student' && (
          <StudentPlacementsPage user={user} />
        )}
        {activeTab === 'placements_manage' && user.role === 'management' && (
          <ManagementPlacementsPage user={user} />
        )}
        {activeTab === 'events' && user.role === 'student' && (
          <StudentEventsPage user={user} />
        )}
        {activeTab === 'alumni' && user.role === 'student' && (
          <AlumniHub user={user} />
        )}
        {activeTab === 'events_manage' && user.role === 'event_manager' && (
          <EventManagerEventsPage user={user} />
        )}
        {activeTab === 'mgmt_instructions' && user.role === 'management' && (
          <ManagementInstructionsPage user={user} />
        )}
        {activeTab === 'mgmt_notes' && user.role === 'management' && (
          <ManagementNotesPage user={user} />
        )}
        {activeTab === 'student_instructions' && user.role === 'student' && (
          <StudentInstructionsPage user={user} />
        )}
        {activeTab === 'student_notes' && user.role === 'student' && (
          <StudentNotesPage user={user} />
        )}
        {activeTab === 'resume_analyzer' && user.role === 'student' && (
          <StudentResumeAnalysisPage user={user} />
        )}
        {activeTab === 'chat' && (user.role === 'student' || user.role === 'alumni') && (
          <ChatPage user={user} />
        )}
        {activeTab === 'alumni_posts' && user.role === 'alumni' && (
          <AlumniPostsPage user={user} />
        )}
        {activeTab === 'alumni_requests' && user.role === 'alumni' && (
          <ReferralInboxPage user={user} />
        )}
        {activeTab === 'opportunities' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex justify-between items-center">
               <h2 className="text-3xl font-black text-slate-800">Unified Discovery Hub</h2>
               <div className="flex gap-2">
                 <button onClick={handleDeepDiscovery} className="px-6 py-2 bg-indigo-600 text-white font-black text-xs rounded-xl shadow-lg">Refresh Live Data</button>
               </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...MOCK_OPPORTUNITIES, ...discoveredOpps].map(opp => {
                  const isLive = discoveredOpps.some(d => d.id === opp.id);
                  return (
                    <div key={opp.id} onClick={() => setSelectedOpp(opp)} className={`p-6 rounded-[2rem] border transition-all cursor-pointer group hover:-translate-y-1 ${isLive ? 'bg-indigo-50/20 border-indigo-100 shadow-sm' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${isLive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                          {opp.type === 'Internship' ? '💼' : '🎓'}
                        </div>
                        {isLive && <span className="text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm">LIVE WEB</span>}
                      </div>
                      <h4 className="font-black text-slate-800 text-lg mb-1 group-hover:text-indigo-600 leading-snug">{opp.title}</h4>
                      <p className="text-xs font-bold text-slate-400 mb-4">{opp.company}</p>
                      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                        {opp.tags.map(tag => <span key={tag} className="text-[10px] font-black text-slate-400">#{tag}</span>)}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}
        {activeTab === 'tracking' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-black text-slate-800">Application Pipeline</h2>
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                      <th className="px-8 py-6">Opportunity</th>
                      <th className="px-8 py-6">Source Type</th>
                      <th className="px-8 py-6">Status</th>
                      <th className="px-8 py-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {applications.map(app => {
                      const opp = [...MOCK_OPPORTUNITIES, ...discoveredOpps].find(o => o.id === app.opportunityId);
                      const isLive = discoveredOpps.some(d => d.id === opp?.id);
                      return (
                        <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <p className="font-black text-slate-800">{opp?.title}</p>
                            <p className="text-xs font-bold text-slate-400">{opp?.company}</p>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${isLive ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {isLive ? 'Web Scraped' : 'KEC Portal'}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-full">{app.status}</span>
                          </td>
                          <td className="px-8 py-6">
                            <button onClick={() => opp && setSelectedOpp(opp)} className="text-indigo-600 font-black text-xs hover:underline">Track Process</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
            </div>
          </div>
        )}
        {activeTab === 'profile' && (
          <ProfilePage user={user} onUserUpdated={handleUserUpdated} onSignOut={handleLogout} />
        )}

        {selectedOpp && (
          <OpportunityDetail 
            opportunity={selectedOpp} 
            user={user}
            onClose={() => setSelectedOpp(null)}
            onApply={() => { handleApply(selectedOpp); setSelectedOpp(null); }}
            isApplied={applications.some(a => a.opportunityId === selectedOpp.id)}
          />
        )}
      </Layout>
    </Router>
  );
};

export default App;
