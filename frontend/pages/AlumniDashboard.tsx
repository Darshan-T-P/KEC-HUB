import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { AlumniPost } from '../services/alumni';
import { ReferralRequestItem } from '../services/referrals';

interface AlumniDashboardProps {
    user: User;
    alumniLoading: boolean;
    alumniLastUpdated: string | null;
    alumniPosts: AlumniPost[];
    alumniRequests: ReferralRequestItem[];
    loadAlumniDashboard: () => Promise<void>;
    handleLogout: () => void;
}

const AlumniDashboard: React.FC<AlumniDashboardProps> = ({
    user,
    alumniLoading,
    alumniLastUpdated,
    alumniPosts,
    alumniRequests,
    loadAlumniDashboard,
    handleLogout
}) => {
    const navigate = useNavigate();
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

    return (
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
                        onClick={() => navigate('/alumni-posts')}
                        className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all group"
                    >
                        Create / Manage Posts
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {cards.map((stat, i) => (
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
                            <span className="p-2 bg-amber-100 rounded-xl text-amber-700 text-sm">📥</span>
                            Pending Referral Requests
                        </h3>
                        <button
                            onClick={() => navigate('/referrals')}
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
                                                    onClick={() => navigate('/referrals')}
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
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200">
                        <h4 className="font-black text-xl mb-3">AI Coach 🤖</h4>
                        <p className="text-sm text-indigo-100 font-bold mb-6 leading-relaxed">
                            Need help preparing students or for your own senior interviews? Try our AI Coach.
                        </p>
                        <button
                            onClick={() => navigate('/ai-coach')}
                            className="w-full py-4 bg-white text-indigo-600 font-black rounded-2xl text-sm shadow-xl hover:bg-indigo-50 transition-all active:scale-95"
                        >
                            Start Coaching
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                <span className="p-2 bg-indigo-100 rounded-xl text-indigo-600 text-xs">🗂️</span>
                                Recent Posts
                            </h3>
                            <button
                                onClick={() => navigate('/alumni-posts')}
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
                                onClick={() => navigate('/alumni-posts')}
                                className="w-full py-4 bg-white text-slate-900 font-black rounded-2xl text-sm hover:bg-slate-100 transition-all"
                            >
                                Post Opportunity
                            </button>
                            <button
                                onClick={() => navigate('/referrals')}
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
    );
};

export default AlumniDashboard;
