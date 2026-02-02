import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { experienceService, PlacementExperience, InterviewRound } from '../services/experiences';

interface ExperienceSharingProps {
  user: User;
}

const ExperienceSharing: React.FC<ExperienceSharingProps> = ({ user }) => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [experiences, setExperiences] = useState<PlacementExperience[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchCompany, setSearchCompany] = useState('');

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState(3);
  const [overallExperience, setOverallExperience] = useState('');
  const [rounds, setRounds] = useState<InterviewRound[]>([{ roundName: '', description: '' }]);

  useEffect(() => {
    loadExperiences();
  }, []);

  const loadExperiences = async () => {
    setLoading(true);
    const data = await experienceService.listAll();
    setExperiences(data);
    setLoading(false);
  };

  const addRound = () => {
    setRounds([...rounds, { roundName: '', description: '' }]);
  };

  const removeRound = (index: number) => {
    setRounds(rounds.filter((_, i) => i !== index));
  };

  const updateRound = (index: number, field: keyof InterviewRound, value: string) => {
    const updated = [...rounds];
    updated[index] = { ...updated[index], [field]: value };
    setRounds(updated);
  };

  const resetForm = () => {
    setCompanyName('');
    setJobRole('');
    setInterviewDate('');
    setDifficultyLevel(3);
    setOverallExperience('');
    setRounds([{ roundName: '', description: '' }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    const validRounds = rounds.filter(r => r.roundName.trim() && r.description.trim());
    
    if (validRounds.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one interview round' });
      setSubmitting(false);
      return;
    }

    const result = await experienceService.submit(user, {
      companyName,
      jobRole,
      interviewDate,
      rounds: validRounds,
      difficultyLevel,
      overallExperience,
    });

    if (result.success) {
      setMessage({ type: 'success', text: result.message });
      resetForm();
      loadExperiences();
      setTimeout(() => setView('list'), 2000);
    } else {
      setMessage({ type: 'error', text: result.message });
    }
    setSubmitting(false);
  };

  const filteredExperiences = searchCompany
    ? experiences.filter(exp =>
        exp.companyName.toLowerCase().includes(searchCompany.toLowerCase())
      )
    : experiences;

  const getDifficultyColor = (level: number) => {
    if (level <= 2) return 'text-green-600 bg-green-50';
    if (level <= 3) return 'text-yellow-600 bg-yellow-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getDifficultyLabel = (level: number) => {
    if (level === 1) return 'Very Easy';
    if (level === 2) return 'Easy';
    if (level === 3) return 'Moderate';
    if (level === 4) return 'Hard';
    return 'Very Hard';
  };

  return (
    <div className="h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-4xl font-black text-slate-800 mb-2">Placement Experiences 💼</h1>
        <p className="text-slate-500 font-bold">Share and learn from placement interview experiences</p>
      </header>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setView('list')}
          className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${
            view === 'list'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          📚 Browse Experiences
        </button>
        <button
          onClick={() => setView('create')}
          className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${
            view === 'create'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          ✍️ Share Experience
        </button>
      </div>

      {view === 'list' ? (
        <div className="flex-1 overflow-auto">
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by company name..."
              value={searchCompany}
              onChange={(e) => setSearchCompany(e.target.value)}
              className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 font-bold">Loading experiences...</div>
          ) : filteredExperiences.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-slate-500 font-bold">No experiences found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredExperiences.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-white border border-slate-200 rounded-3xl p-8 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 mb-1">{exp.companyName}</h3>
                      <p className="text-indigo-600 font-bold">{exp.jobRole}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-xl text-xs font-black ${getDifficultyColor(exp.difficultyLevel)}`}>
                      {getDifficultyLabel(exp.difficultyLevel)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-500 font-bold mb-6">
                    <span>📅 {(() => {
                      const d = new Date(exp.interviewDate);
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = d.getFullYear();
                      return `${day}-${month}-${year}`;
                    })()}</span>
                    <span>👤 {exp.studentName || 'Anonymous'}</span>
                    {exp.studentDepartment && <span>🎓 {exp.studentDepartment}</span>}
                  </div>

                  <div className="mb-6">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3">Interview Rounds</h4>
                    <div className="space-y-3">
                      {exp.rounds.map((round, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-2xl p-4">
                          <p className="font-black text-slate-700 mb-1">{round.roundName}</p>
                          <p className="text-sm text-slate-600">{round.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-2">Overall Experience</h4>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{exp.overallExperience}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-8">
            {message && (
              <div
                className={`mb-6 p-4 rounded-2xl font-bold ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Company Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    placeholder="e.g., Google"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Job Role <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    placeholder="e.g., Software Engineer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Interview Date <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Difficulty Level <span className="text-rose-500">*</span></label>
                  <select
                    value={difficultyLevel}
                    onChange={(e) => setDifficultyLevel(Number(e.target.value))}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  >
                    <option value={1}>1 - Very Easy</option>
                    <option value={2}>2 - Easy</option>
                    <option value={3}>3 - Moderate</option>
                    <option value={4}>4 - Hard</option>
                    <option value={5}>5 - Very Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Interview Rounds <span className="text-rose-500">*</span></label>
                  <button
                    type="button"
                    onClick={addRound}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all"
                  >
                    + Add Round
                  </button>
                </div>
                <div className="space-y-4">
                  {rounds.map((round, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-black text-slate-700">Round {idx + 1}</h4>
                        {rounds.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRound(idx)}
                            className="text-rose-600 hover:text-rose-700 font-black text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Round name (e.g., Technical Round 1)"
                          value={round.roundName}
                          onChange={(e) => updateRound(idx, 'roundName', e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                        />
                        <textarea
                          placeholder="Describe this round (questions asked, topics covered, etc.)"
                          value={round.description}
                          onChange={(e) => updateRound(idx, 'description', e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Overall Experience <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  value={overallExperience}
                  onChange={(e) => setOverallExperience(e.target.value)}
                  rows={6}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold resize-none"
                  placeholder="Share your overall experience, tips, and advice for future candidates..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : '✓ Submit Experience'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setView('list');
                  }}
                  className="px-8 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ExperienceSharing;
