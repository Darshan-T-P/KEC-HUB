
import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  hideNav?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, hideNav }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const userInitials = useMemo(() => {
    const parts = (user?.name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    return parts
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase())
      .join('');
  }, [user?.name]);

  const userBadge = useMemo(() => {
    const handle = (user?.email || '').split('@')[0] || 'KEC';
    return handle.toUpperCase().slice(0, 12);
  }, [user?.email]);

  const menuItems = (() => {
    if (user.role === 'alumni') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
        { id: 'alumni_posts', label: 'My Posts', icon: '🧾', path: '/alumni-posts' },
        { id: 'alumni_requests', label: 'Referrals', icon: '✅', path: '/referrals' },
        { id: 'ai-coach', label: 'AI Coach', icon: '🤖', path: '/ai-coach' },
        { id: 'chat', label: 'Chats', icon: '💬', path: '/chat' },
        { id: 'profile', label: 'My Profile', icon: '👤', path: '/profile' },
      ];
    }

    if (user.role === 'event_manager') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
        { id: 'events_manage', label: 'Events', icon: '📣', path: '/events-manage' },
        { id: 'profile', label: 'My Profile', icon: '👤', path: '/profile' },
      ];
    }

    if (user.role === 'student') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
        { id: 'opportunities', label: 'Explore Hub', icon: '🔍', path: '/opportunities' },
        { id: 'ai-coach', label: 'AI Coach', icon: '🤖', path: '/ai-coach' },
        { id: 'ai-advantage', label: 'AI Advantage', icon: '🚀', path: '/ai-advantage' },
        { id: 'placements', label: 'Placements', icon: '🏢', path: '/placements' },
        { id: 'student_instructions', label: 'Instructions', icon: '🧭', path: '/instructions' },
        { id: 'student_notes', label: 'Notes', icon: '📚', path: '/notes' },
        { id: 'resume_analyzer', label: 'Resume Analyzer', icon: '📄', path: '/resume-analyzer' },
        { id: 'events', label: 'Events', icon: '📅', path: '/events' },
        { id: 'alumni', label: 'Alumni', icon: '🎓', path: '/alumni' },
        { id: 'chat', label: 'Chats', icon: '💬', path: '/chat' },
        { id: 'tracking', label: 'My Applications', icon: '📑', path: '/applications' },
        { id: 'profile', label: 'My Profile', icon: '👤', path: '/profile' },
      ];
    }

    if (user.role === 'management') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
        { id: 'placements_manage', label: 'Placements', icon: '📌', path: '/placements-manage' },
        { id: 'mgmt_instructions', label: 'Instructions', icon: '🧾', path: '/mgmt-instructions' },
        { id: 'mgmt_notes', label: 'Notes Upload', icon: '📎', path: '/mgmt-notes' },
        { id: 'profile', label: 'My Profile', icon: '👤', path: '/profile' },
      ];
    }

    return [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
      { id: 'opportunities', label: 'Explore Hub', icon: '🔍', path: '/opportunities' },
      { id: 'chat', label: 'Chats', icon: '💬', path: '/chat' },
      { id: 'profile', label: 'My Profile', icon: '👤', path: '/profile' },
    ];
  })();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!hideNav && (
        <aside className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
              <div
                className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white cursor-pointer relative overflow-hidden group"
                onClick={() => navigate('/dashboard')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-6 h-6 z-10">
                  <path d="M4 4v16m0-8h4m0 0l4-4m-4 4l4 4m6-8v8m0-4h4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="absolute inset-0 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div className="cursor-pointer" onClick={() => navigate('/dashboard')}>
                <h1 className="font-extrabold text-slate-800 leading-none tracking-tight">KEC <span className="text-indigo-600">Hub</span></h1>
                <p className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-widest">Career Gateway</p>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {menuItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) => `
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                  ${isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                      : 'text-slate-600 hover:bg-slate-100'}
                `}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.department}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-10">
          {!hideNav && (
            <button
              className="lg:hidden p-2 -ml-2 text-slate-600"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <div className="flex items-center gap-4">
            {!hideNav && (
              <div className="relative hidden md:block">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search anything..."
                  className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-64"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-full hover:bg-slate-100 text-slate-600 relative">
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="flex items-center gap-4 border-l border-slate-100 pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-slate-800 leading-tight">{user.name}</p>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{user.role.replace('_', ' ')}</p>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-black text-xs uppercase tracking-widest group border border-slate-100"
              >
                <span>Logout</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 group-hover:translate-x-1 transition-transform">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
