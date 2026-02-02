import React from 'react';
import { Application, Opportunity, User } from '../types';

interface TrackingPageProps {
  user: User;
  applications: Application[];
  allOpportunities: Opportunity[];
  discoveredOpps: Opportunity[];
  onSelectOpp: (opp: Opportunity) => void;
}

const TrackingPage: React.FC<TrackingPageProps> = ({
  applications,
  allOpportunities,
  discoveredOpps,
  onSelectOpp,
}) => {
  return (
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
              const opp = allOpportunities.find(o => o.id === app.opportunityId);
              const isLive = discoveredOpps.some(d => d.id === opp?.id);
              return (
                <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-black text-slate-800">{opp?.title}</p>
                    <p className="text-xs font-bold text-slate-400">{opp?.company}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span
                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                        isLive ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {isLive ? 'Web Scraped' : 'KEC Portal'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-full">{app.status}</span>
                  </td>
                  <td className="px-8 py-6">
                    <button onClick={() => opp && onSelectOpp(opp)} className="text-indigo-600 font-black text-xs hover:underline">
                      Track Process
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TrackingPage;
