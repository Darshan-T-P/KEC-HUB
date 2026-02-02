
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import ExperienceSharing from './components/ExperienceSharing';
import { eventService, EventItem } from './services/events';
import { alumniService, AlumniPost } from './services/alumni';
import { referralService, ReferralRequestItem } from './services/referrals';
import { placementService, PlacementItem } from './services/placements';
import { managementContentService, InstructionItem, NoteItem } from './services/managementContent';

// Pages
import { 
  AlumniDashboard, 
  EventManagerDashboard, 
  ManagementDashboard, 
  StudentDashboard, 
  OpportunitiesPage, 
  TrackingPage 
} from './pages';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
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

  // Auto-load dashboard data when user changes
  useEffect(() => {
    if (!user) return;

    if (user.role === 'event_manager') {
      loadManagerDashboard();
    } else if (user.role === 'alumni') {
      loadAlumniDashboard();
    } else if (user.role === 'management') {
      loadManagementDashboard();
    }
  }, [user?.email, user?.role]);

  const handleLoginSuccess = async (userData: any) => {
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

    // If registration included roll_number or phone_number, update profile
    if (userData?.roll_number || userData?.phone_number) {
      try {
        const { profileService } = await import('./services/profile');
        const updateData: any = {};
        if (userData.roll_number) updateData.roll_number = userData.roll_number;
        if (userData.phone_number) updateData.phone_number = userData.phone_number;
        await profileService.updateProfile(fullUser.email, fullUser.role, updateData);
      } catch (error) {
        console.error('Failed to update profile with additional fields:', error);
      }
    }
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

  // Dashboard component based on user role
  const DashboardPage = () => {
    if (!user) return null;

    const handleLogout = () => {
      localStorage.removeItem('kec_current_user');
      setUser(null);
    };

    switch (user.role) {
      case 'alumni':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AlumniDashboard
              user={user}
              alumniPosts={alumniPosts}
              alumniRequests={alumniRequests}
              alumniLoading={alumniLoading}
              alumniLastUpdated={alumniLastUpdated}
              loadAlumniDashboard={loadAlumniDashboard}
              handleLogout={handleLogout}
            />
          </div>
        );

      case 'event_manager':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <EventManagerDashboard
              user={user}
              managerEvents={managerEvents}
              managerRegsByEvent={managerRegsByEvent}
              managerLoading={managerLoading}
              managerLastUpdated={managerLastUpdated}
              loadManagerDashboard={loadManagerDashboard}
              handleLogout={handleLogout}
            />
          </div>
        );

      case 'management':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ManagementDashboard
              user={user}
              mgmtPlacements={mgmtPlacements}
              mgmtInstructions={mgmtInstructions}
              mgmtNotes={mgmtNotes}
              mgmtLoading={mgmtLoading}
              mgmtLastUpdated={mgmtLastUpdated}
              loadManagementDashboard={loadManagementDashboard}
              handleLogout={handleLogout}
            />
          </div>
        );

      case 'student':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StudentDashboard
              user={user}
              discoveredOpps={discoveredOpps}
              mockOpportunities={MOCK_OPPORTUNITIES}
              stats={[
                { label: 'Live Opportunities', value: discoveredOpps.length, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: '🔥' },
                { label: 'Applications', value: applications.length, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '📩' },
                { label: 'Interviews', value: interviews.length, color: 'text-rose-600', bg: 'bg-rose-50', icon: '🗓️' },
                { label: 'Offers', value: applications.filter(a => a.status === 'Offer').length, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', icon: '🎉' },
              ]}
              isCrawling={isCrawling}
              lastCrawlTime={lastCrawlTime}
              crawlMeta={crawlMeta}
              groqBoostedCount={discoveredOpps.filter(o => String(o.matchMethod || '').toLowerCase().includes('groq')).length}
              handleDeepDiscovery={handleDeepDiscovery}
              setSelectedOpp={setSelectedOpp}
              handleLogout={handleLogout}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('kec_current_user');
    setUser(null);
  };

  // Route-specific page wrappers
  const OpportunitiesPageWrapper = () => (
    <OpportunitiesPage
      user={user!}
      discoveredOpps={discoveredOpps}
      mockOpportunities={MOCK_OPPORTUNITIES}
      onRefresh={handleDeepDiscovery}
      onSelectOpp={setSelectedOpp}
    />
  );

  const TrackingPageWrapper = () => (
    <TrackingPage
      user={user!}
      applications={applications}
      allOpportunities={[...MOCK_OPPORTUNITIES, ...discoveredOpps]}
      discoveredOpps={discoveredOpps}
      onSelectOpp={setSelectedOpp}
    />
  );

  return (
    <>
      <Routes>
        <Route path="/" element={!user ? <Navigate to="/login" replace /> : <Navigate to="/dashboard" replace />} />
        <Route path="/login" element={!user ? <AuthPage onLoginSuccess={handleLoginSuccess} mode="login" /> : <Navigate to="/dashboard" replace />} />
        <Route path="/register" element={!user ? <AuthPage onLoginSuccess={handleLoginSuccess} mode="register" /> : <Navigate to="/dashboard" replace />} />
        
        {user && (
        <>
          <Route path="/dashboard" element={<Layout user={user} onSignOut={handleSignOut}><DashboardPage /></Layout>} />
          <Route path="/profile" element={<Layout user={user} onSignOut={handleSignOut}><ProfilePage user={user} onUserUpdated={handleUserUpdated} onSignOut={handleLogout} /></Layout>} />
            
            {/* Student Routes */}
            {user.role === 'student' && (
              <>
                <Route path="/opportunities" element={<Layout user={user} onSignOut={handleSignOut}><OpportunitiesPageWrapper /></Layout>} />
                <Route path="/tracking" element={<Layout user={user} onSignOut={handleSignOut}><TrackingPageWrapper /></Layout>} />
                <Route path="/placements" element={<Layout user={user} onSignOut={handleSignOut}><StudentPlacementsPage user={user} /></Layout>} />
                <Route path="/experiences" element={<Layout user={user} onSignOut={handleSignOut}><ExperienceSharing user={user} /></Layout>} />
                <Route path="/student_instructions" element={<Layout user={user} onSignOut={handleSignOut}><StudentInstructionsPage user={user} /></Layout>} />
                <Route path="/student_notes" element={<Layout user={user} onSignOut={handleSignOut}><StudentNotesPage user={user} /></Layout>} />
                <Route path="/resume_analyzer" element={<Layout user={user} onSignOut={handleSignOut}><StudentResumeAnalysisPage user={user} /></Layout>} />
                <Route path="/events" element={<Layout user={user} onSignOut={handleSignOut}><StudentEventsPage user={user} /></Layout>} />
                <Route path="/alumni" element={<Layout user={user} onSignOut={handleSignOut}><AlumniHub user={user} /></Layout>} />
                <Route path="/chat" element={<Layout user={user} onSignOut={handleSignOut}><ChatPage user={user} /></Layout>} />
              </>
            )}
            
            {/* Alumni Routes */}
            {user.role === 'alumni' && (
              <>
                <Route path="/alumni_posts" element={<Layout user={user} onSignOut={handleSignOut}><AlumniPostsPage user={user} /></Layout>} />
                <Route path="/alumni_requests" element={<Layout user={user} onSignOut={handleSignOut}><ReferralInboxPage user={user} /></Layout>} />
                <Route path="/chat" element={<Layout user={user} onSignOut={handleSignOut}><ChatPage user={user} /></Layout>} />
              </>
            )}
            
            {/* Event Manager Routes */}
            {user.role === 'event_manager' && (
              <>
                <Route path="/events_manage" element={<Layout user={user} onSignOut={handleSignOut}><EventManagerEventsPage user={user} /></Layout>} />
              </>
            )}
            
            {/* Management Routes */}
            {user.role === 'management' && (
              <>
                <Route path="/placements_manage" element={<Layout user={user} onSignOut={handleSignOut}><ManagementPlacementsPage user={user} /></Layout>} />
                <Route path="/mgmt_instructions" element={<Layout user={user} onSignOut={handleSignOut}><ManagementInstructionsPage user={user} /></Layout>} />
                <Route path="/mgmt_notes" element={<Layout user={user} onSignOut={handleSignOut}><ManagementNotesPage user={user} /></Layout>} />
              </>
            )}
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
        
        {!user && <Route path="*" element={<Navigate to="/login" replace />} />}
      </Routes>

      {/* Global Modal for Opportunity Detail */}
      {selectedOpp && (
        <OpportunityDetail 
          opportunity={selectedOpp} 
          user={user!}
          onClose={() => setSelectedOpp(null)}
          onApply={() => { handleApply(selectedOpp); setSelectedOpp(null); }}
          isApplied={applications.some(a => a.opportunityId === selectedOpp.id)}
        />
      )}
    </>
  );
};

const App: React.FC = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;

