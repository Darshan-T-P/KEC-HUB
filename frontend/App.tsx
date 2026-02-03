import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import AuthPage from './components/AuthPage';
import { authService, AuthResponse } from './services/auth';
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
import AIAdvantagePage from './components/AIAdvantagePage';
import AICoachPage from './components/AICoachPage';
import { eventService, EventItem } from './services/events';
import { alumniService, AlumniPost } from './services/alumni';
import { referralService, ReferralRequestItem } from './services/referrals';
import { placementService, PlacementItem } from './services/placements';
import { managementContentService, InstructionItem, NoteItem } from './services/managementContent';
import StudentDashboard from './pages/StudentDashboard';
import AlumniDashboard from './pages/AlumniDashboard';
import ManagementDashboard from './pages/ManagementDashboard';
import EventManagerDashboard from './pages/EventManagerDashboard';
import { mlService } from './services/ml';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [applications, setApplications] = useState<Application[]>(MOCK_APPLICATIONS);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [aiInitialData, setAiInitialData] = useState<{ role?: string, company?: string } | null>(null);
  const [discoveredOpps, setDiscoveredOpps] = useState<Opportunity[]>([]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [lastCrawlTime, setLastCrawlTime] = useState<string | null>(null);
  const [crawlMeta, setCrawlMeta] = useState<CrawlMeta | null>(null);
  const navigate = useNavigate();

  // ... (state for manager, alumni, mgmt) ...
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

  useEffect(() => {
    const savedUser = localStorage.getItem('kec_current_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Auto discovery for student on login/dashboard load
    if (user.role === 'student' && !isCrawling) {
      try {
        const last = Number(sessionStorage.getItem(AUTO_CRAWL_KEY) || '0');
        const now = Date.now();
        if (!Number.isFinite(last) || now - last >= AUTO_CRAWL_MIN_INTERVAL_MS) {
          sessionStorage.setItem(AUTO_CRAWL_KEY, String(now));
          handleDeepDiscovery();
        }
      } catch {
        handleDeepDiscovery();
      }
    }

    if (user.role === 'event_manager') loadManagerDashboard();
    if (user.role === 'alumni') loadAlumniDashboard();
    if (user.role === 'management') loadManagementDashboard();
  }, [user?.email, user?.role]);

  const handleLoginSuccess = (data: AuthResponse) => {
    if (data.user) {
      authService.saveAuth(data);
      setUser(data.user);
      navigate('/dashboard');
    }
  };

  const handleUserUpdated = (updated: User) => {
    setUser(updated);
    localStorage.setItem('kec_current_user', JSON.stringify(updated));
  };

  const handleLogout = () => {
    setUser(null);
    authService.clearAuth();
    navigate('/');
  };

  const isProfileComplete = (u: User) => {
    if (u.role === 'student') {
      return !!u.name && !!u.roll_number && !!u.phone_number;
    }
    return !!u.name && !!u.phone_number;
  };

  if (!user) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  const isComplete = isProfileComplete(user);

  const loadManagerDashboard = async () => {
    if (user.role !== 'event_manager') return;
    setManagerLoading(true);
    try {
      const events = await eventService.listMine({ email: user.email, role: user.role });
      setManagerEvents(events);
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
      studentId: user?.id || '',
      appliedDate: new Date().toISOString().split('T')[0],
      status: 'Applied'
    };
    setApplications([...applications, newApp]);
    if (user?.email) {
      mlService.sendFeedback(user.email, opp.id, 'applied');
    }
    if (opp.sourceUrl && opp.sourceUrl !== "#") {
      window.open(opp.sourceUrl, '_blank');
    }
  };

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {user.role === 'alumni' ? (
        <AlumniDashboard
          user={user}
          alumniLoading={alumniLoading}
          alumniLastUpdated={alumniLastUpdated}
          alumniPosts={alumniPosts}
          alumniRequests={alumniRequests}
          loadAlumniDashboard={loadAlumniDashboard}
          handleLogout={handleLogout}
        />
      ) : user.role === 'management' ? (
        <ManagementDashboard
          user={user}
          mgmtLoading={mgmtLoading}
          mgmtLastUpdated={mgmtLastUpdated}
          mgmtPlacements={mgmtPlacements}
          mgmtInstructions={mgmtInstructions}
          mgmtNotes={mgmtNotes}
          loadManagementDashboard={loadManagementDashboard}
          handleLogout={handleLogout}
        />
      ) : user.role === 'event_manager' ? (
        <EventManagerDashboard
          user={user}
          managerLoading={managerLoading}
          managerLastUpdated={managerLastUpdated}
          managerEvents={managerEvents}
          managerRegsByEvent={managerRegsByEvent}
          loadManagerDashboard={loadManagerDashboard}
          handleLogout={handleLogout}
        />
      ) : user.role === 'student' ? (
        <StudentDashboard
          user={user}
          isCrawling={isCrawling}
          discoveredOpps={discoveredOpps}
          crawlMeta={crawlMeta}
          lastCrawlTime={lastCrawlTime}
          handleDeepDiscovery={handleDeepDiscovery}
          setSelectedOpp={setSelectedOpp}
          applications={applications}
          interviews={interviews}
          handleLogout={handleLogout}
          groqBoostedCount={groqBoostedCount}
          handleApply={handleApply}
        />
      ) : null}
    </div>
  );

  return (
    <Layout user={user} onLogout={handleLogout} hideNav={!isComplete}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Profile is always accessible, but we might force it */}
        <Route path="/profile" element={<ProfilePage user={user} onUserUpdated={handleUserUpdated} onSignOut={handleLogout} isFirstTime={!isComplete} />} />

        {!isComplete ? (
          <Route path="*" element={<Navigate to="/profile" replace />} />
        ) : (
          <>
            <Route path="/dashboard" element={renderDashboard()} />

            {/* Student Routes */}
            {user.role === 'student' && (
              <>
                <Route path="/placements" element={<StudentPlacementsPage user={user} />} />
                <Route path="/events" element={<StudentEventsPage user={user} />} />
                <Route path="/alumni" element={<AlumniHub user={user} />} />
                <Route path="/instructions" element={<StudentInstructionsPage user={user} />} />
                <Route path="/notes" element={<StudentNotesPage user={user} />} />
                <Route path="/resume-analyzer" element={<StudentResumeAnalysisPage user={user} />} />
                <Route path="/ai-advantage" element={
                  <AIAdvantagePage
                    user={user}
                    initialRole={aiInitialData?.role}
                    initialCompany={aiInitialData?.company}
                  />
                } />
                <Route path="/applications" element={
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
                } />
              </>
            )}

            {/* Management Routes */}
            {user.role === 'management' && (
              <>
                <Route path="/placements-manage" element={<ManagementPlacementsPage user={user} />} />
                <Route path="/mgmt-instructions" element={<ManagementInstructionsPage user={user} />} />
                <Route path="/mgmt-notes" element={<ManagementNotesPage user={user} />} />
              </>
            )}

            {/* Alumni Routes */}
            {user.role === 'alumni' && (
              <>
                <Route path="/alumni-posts" element={<AlumniPostsPage user={user} />} />
                <Route path="/referrals" element={<ReferralInboxPage user={user} />} />
              </>
            )}

            {/* Event Manager Routes */}
            {user.role === 'event_manager' && (
              <>
                <Route path="/events-manage" element={<EventManagerEventsPage user={user} />} />
              </>
            )}

            {/* Shared/Common Routes */}
            <Route path="/opportunities" element={
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
            } />

            {(user.role === 'student' || user.role === 'alumni') && (
              <>
                <Route path="/ai-coach" element={<AICoachPage user={user} />} />
                <Route path="/chat" element={<ChatPage user={user} />} />
              </>
            )}

            <Route path="/profile" element={<ProfilePage user={user} onUserUpdated={handleUserUpdated} onSignOut={handleLogout} />} />

            {/* Fallback to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>

      {selectedOpp && (
        <OpportunityDetail
          opportunity={selectedOpp}
          user={user}
          onClose={() => setSelectedOpp(null)}
          onApply={() => { handleApply(selectedOpp); setSelectedOpp(null); }}
          isApplied={applications.some(a => a.opportunityId === selectedOpp.id)}
          onOpenAIAdvantage={(role, company) => {
            setAiInitialData({ role, company });
            navigate('/ai-advantage');
            setSelectedOpp(null);
          }}
        />
      )}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
