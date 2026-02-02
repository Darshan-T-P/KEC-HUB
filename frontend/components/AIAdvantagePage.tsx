import React, { useState } from 'react';
import { User } from '../types';

interface AIAdvantagePageProps {
  user: User;
  initialRole?: string;
  initialCompany?: string;
}

interface StrategicPrepResult {
  company_insights?: {
    culture?: string;
    interview_process?: string;
    key_focus_areas?: string[];
  };
  technical_roadmap?: {
    priority_topics?: string[];
    timeline?: string;
  };
  interview_patterns?: string[];
  portfolio_projects?: Array<{ title: string; description: string }>;
  study_timeline?: {
    week1?: string[];
    week2?: string[];
    week3?: string[];
    week4?: string[];
  };
  resources?: Array<{ title: string; url?: string; type?: string }>;
  grounding_sources?: any[];
  web_search_queries?: string[];
  error?: string;
}

interface CoverLetterResult {
  cover_letter?: string;
  key_highlights?: string[];
  customization_tips?: string[];
  grounding_sources?: any[];
  error?: string;
}

const AIAdvantagePage: React.FC<AIAdvantagePageProps> = ({ user, initialRole = '', initialCompany = '' }) => {
  const [activeTab, setActiveTab] = useState<'strategic' | 'cover'>('strategic');

  // Strategic Prep state
  const [loading, setLoading] = useState(false);
  const [targetRole, setTargetRole] = useState(initialRole);
  const [company, setCompany] = useState(initialCompany);
  const [experienceLevel, setExperienceLevel] = useState<'entry-level' | 'mid-level' | 'senior'>('entry-level');
  const [strategicResult, setStrategicResult] = useState<StrategicPrepResult | null>(null);

  // Cover Letter state
  const [loadingCover, setLoadingCover] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [coverCompany, setCoverCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [coverLetterResult, setCoverLetterResult] = useState<CoverLetterResult | null>(null);

  const API_BASE_URL = 'http://localhost:8000';

  const generateStrategicPrep = async () => {
    if (!targetRole) {
      alert('Please enter a target role');
      return;
    }

    setLoading(true);
    setStrategicResult(null);

    try {
      const formData = new FormData();
      formData.append('target_role', targetRole);
      formData.append('experience_level', experienceLevel);
      if (company) {
        formData.append('company', company);
      }

      const params = new URLSearchParams({
        email: user.email,
        role: user.role,
      });

      const response = await fetch(`${API_BASE_URL}/ai-advantage/strategic-prep?${params}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setStrategicResult(data);
    } catch (error) {
      console.error('Failed to generate strategic prep:', error);
      setStrategicResult({ error: 'Failed to generate strategic preparation plan' });
    } finally {
      setLoading(false);
    }
  };

  const generateCoverLetter = async () => {
    if (!jobTitle || !coverCompany || !jobDescription) {
      alert('Please fill in all fields');
      return;
    }

    setLoadingCover(true);
    setCoverLetterResult(null);

    try {
      const formData = new FormData();
      formData.append('job_title', jobTitle);
      formData.append('company', coverCompany);
      formData.append('job_description', jobDescription);

      const params = new URLSearchParams({
        email: user.email,
        role: user.role,
      });

      const response = await fetch(`${API_BASE_URL}/ai-advantage/cover-letter?${params}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setCoverLetterResult(data);
    } catch (error) {
      console.error('Failed to generate cover letter:', error);
      setCoverLetterResult({ error: 'Failed to generate cover letter' });
    } finally {
      setLoadingCover(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 rounded-2xl p-6 sm:p-8 mb-4 sm:mb-6 shadow-2xl border border-purple-400/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl">
              <span className="text-3xl sm:text-4xl">🚀</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">AI Advantage</h1>
              <p className="text-purple-100 text-xs sm:text-sm font-semibold mt-1 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Powered by Groq AI • Llama 3.3 70B
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => setActiveTab('strategic')}
            className={`flex-1 py-3 px-4 sm:px-6 rounded-xl font-semibold transition text-sm sm:text-base ${activeTab === 'strategic'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
          >
            Strategic Preparation
          </button>
          <button
            onClick={() => setActiveTab('cover')}
            className={`flex-1 py-3 px-4 sm:px-6 rounded-xl font-semibold transition text-sm sm:text-base ${activeTab === 'cover'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
          >
            AI Cover Letter
          </button>
        </div>

        {/* Strategic Preparation Tab */}
        {activeTab === 'strategic' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold mb-4 text-white">Generate Strategic Prep Plan</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Target Role *
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g., Software Engineer, Data Scientist"
                    className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company (Optional)
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g., Google, Microsoft"
                    className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Experience Level
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    {(['entry-level', 'mid-level', 'senior'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setExperienceLevel(level)}
                        className={`flex-1 py-2 px-3 sm:px-4 rounded-lg font-medium transition text-sm ${experienceLevel === level
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                      >
                        {level.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateStrategicPrep}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-4 sm:px-6 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm sm:text-base"
                >
                  {loading ? '🔍 Researching with Gemini...' : '✨ Generate Strategic Plan'}
                </button>
              </div>
            </div>

            {/* Strategic Prep Results */}
            {strategicResult && !strategicResult.error && (
              <div className="space-y-4">
                {/* Company Insights */}
                {strategicResult.company_insights && (
                  <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 text-white">🏢 Company Insights</h3>
                    {strategicResult.company_insights.culture && (
                      <div className="mb-3">
                        <p className="text-xs sm:text-sm text-gray-400 mb-1">Culture:</p>
                        <p className="text-sm sm:text-base text-gray-200">{strategicResult.company_insights.culture}</p>
                      </div>
                    )}
                    {strategicResult.company_insights.key_focus_areas && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {strategicResult.company_insights.key_focus_areas.map((area, idx) => (
                          <span key={idx} className="bg-blue-900 text-blue-200 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                            {area}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Technical Roadmap */}
                {strategicResult.technical_roadmap?.priority_topics && (
                  <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 text-white">📚 Technical Roadmap</h3>
                    <ul className="space-y-2">
                      {strategicResult.technical_roadmap.priority_topics.map((topic, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-400 mt-1 text-sm">{idx + 1}.</span>
                          <span className="text-sm sm:text-base text-gray-200">{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Interview Patterns */}
                {strategicResult.interview_patterns && strategicResult.interview_patterns.length > 0 && (
                  <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 text-white">🎯 Common Interview Patterns</h3>
                    <ul className="space-y-2">
                      {strategicResult.interview_patterns.map((pattern, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400">•</span>
                          <span className="text-sm sm:text-base text-gray-200">{pattern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Resources */}
                {strategicResult.resources && strategicResult.resources.length > 0 && (
                  <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 text-white">🔗 Resources</h3>
                    <div className="space-y-2">
                      {strategicResult.resources.map((resource, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-700 p-3 rounded-lg gap-2">
                          <span className="text-sm sm:text-base text-gray-200 break-words">{resource.title}</span>
                          {resource.url && (
                            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm self-start sm:self-auto">
                              View →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grounding Info */}
                {strategicResult.web_search_queries && strategicResult.web_search_queries.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-600">
                    <p className="text-xs text-gray-400 mb-2">🔍 Web searches performed:</p>
                    <div className="flex flex-wrap gap-2">
                      {strategicResult.web_search_queries.map((query, idx) => (
                        <span key={idx} className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded break-all">
                          "{query}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {strategicResult?.error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-6 py-4 rounded-xl">
                Error: {strategicResult.error}
              </div>
            )}
          </div>
        )}

        {/* AI Cover Letter Tab */}
        {activeTab === 'cover' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold mb-4 text-white">Generate AI Cover Letter</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g., Frontend Developer"
                    className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company *
                  </label>
                  <input
                    type="text"
                    value={coverCompany}
                    onChange={(e) => setCoverCompany(e.target.value)}
                    placeholder="e.g., Amazon"
                    className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Job Description *
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={6}
                    placeholder="Paste the full job description here..."
                    className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <button
                  onClick={generateCoverLetter}
                  disabled={loadingCover}
                  className="w-full bg-purple-600 text-white py-3 px-4 sm:px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm sm:text-base"
                >
                  {loadingCover ? '✍️ Writing with Gemini...' : '✨ Generate Cover Letter'}
                </button>
              </div>
            </div>

            {/* Cover Letter Results */}
            {coverLetterResult && !coverLetterResult.error && (
              <div className="space-y-4">
                {coverLetterResult.cover_letter && (
                  <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                      <h3 className="text-base sm:text-lg font-semibold text-white">📝 Your Cover Letter</h3>
                      <button
                        onClick={() => copyToClipboard(coverLetterResult.cover_letter!)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm self-start sm:self-auto"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="bg-white p-4 sm:p-6 rounded-lg">
                      <pre className="whitespace-pre-wrap text-gray-800 font-sans text-xs sm:text-sm break-words">
                        {coverLetterResult.cover_letter}
                      </pre>
                    </div>
                  </div>
                )}

                {coverLetterResult.key_highlights && coverLetterResult.key_highlights.length > 0 && (
                  <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 text-white">⭐ Key Highlights</h3>
                    <ul className="space-y-2">
                      {coverLetterResult.key_highlights.map((highlight, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400">•</span>
                          <span className="text-sm sm:text-base text-gray-200">{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {coverLetterResult.customization_tips && coverLetterResult.customization_tips.length > 0 && (
                  <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-xl border border-gray-700">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 text-white">💡 Customization Tips</h3>
                    <ul className="space-y-2">
                      {coverLetterResult.customization_tips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-400">→</span>
                          <span className="text-sm sm:text-base text-gray-200">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {coverLetterResult?.error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-6 py-4 rounded-xl">
                Error: {coverLetterResult.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAdvantagePage;
