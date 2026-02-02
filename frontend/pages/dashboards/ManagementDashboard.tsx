import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { PlacementItem } from '../../services/placements';
import { InstructionItem, NoteItem } from '../../services/managementContent';

interface ManagementDashboardProps {
  user: User;
  mgmtPlacements: PlacementItem[];
  mgmtInstructions: InstructionItem[];
  mgmtNotes: NoteItem[];
  mgmtLoading: boolean;
  mgmtLastUpdated: string | null;
  loadManagementDashboard: () => void;
  handleLogout: () => void;
}

export default function ManagementDashboard({
  user,
  mgmtPlacements,
  mgmtInstructions,
  mgmtNotes,
  mgmtLoading,
  mgmtLastUpdated,
  loadManagementDashboard,
  handleLogout,
}: ManagementDashboardProps) {
  const navigate = useNavigate();

  return (
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
            onClick={() => navigate('/placements_manage')}
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
              onClick={() => navigate('/')}
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
                        onClick={() => navigate('/')}
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
                onClick={() => navigate('/')}
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
                onClick={() => navigate('/')}
                className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
              >
                Post Instructions
              </button>
              <button
                onClick={() => navigate('/')}
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
  );
}
