import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { EventItem } from '../../services/events';

interface EventManagerDashboardProps {
  user: User;
  managerEvents: EventItem[];
  managerRegsByEvent: Record<string, number>;
  managerLoading: boolean;
  managerLastUpdated: string | null;
  loadManagerDashboard: () => void;
  handleLogout: () => void;
}

export default function EventManagerDashboard({
  user,
  managerEvents,
  managerRegsByEvent,
  managerLoading,
  managerLastUpdated,
  loadManagerDashboard,
  handleLogout,
}: EventManagerDashboardProps) {
  const navigate = useNavigate();

  return (
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
            onClick={() => navigate('/events_manage')}
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
                        onClick={() => navigate('/events_manage')}
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
                  onClick={() => navigate('/events_manage')}
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
  );
}
