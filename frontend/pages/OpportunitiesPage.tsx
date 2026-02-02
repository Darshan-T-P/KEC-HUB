import React from 'react';
import { Opportunity, User, Application } from '../types';

interface OpportunitiesPageProps {
  user: User;
  discoveredOpps: Opportunity[];
  mockOpportunities: Opportunity[];
  onRefresh: () => void;
  onSelectOpp: (opp: Opportunity) => void;
}

const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({
  discoveredOpps,
  mockOpportunities,
  onRefresh,
  onSelectOpp,
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-800">Unified Discovery Hub</h2>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="px-6 py-2 bg-indigo-600 text-white font-black text-xs rounded-xl shadow-lg">
            Refresh Live Data
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...mockOpportunities, ...discoveredOpps].map(opp => {
          const isLive = discoveredOpps.some(d => d.id === opp.id);
          return (
            <div
              key={opp.id}
              onClick={() => onSelectOpp(opp)}
              className={`p-6 rounded-[2rem] border transition-all cursor-pointer group hover:-translate-y-1 ${
                isLive ? 'bg-indigo-50/20 border-indigo-100 shadow-sm' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${isLive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                  {opp.type === 'Internship' ? '💼' : '🎓'}
                </div>
                {isLive && <span className="text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm">LIVE WEB</span>}
              </div>
              <h4 className="font-black text-slate-800 text-lg mb-1 group-hover:text-indigo-600 leading-snug">{opp.title}</h4>
              <p className="text-xs font-bold text-slate-400 mb-4">{opp.company}</p>
              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                {opp.tags.map(tag => (
                  <span key={tag} className="text-[10px] font-black text-slate-400">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OpportunitiesPage;
