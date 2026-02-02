import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { profileService, ProfileUpdate, ProjectItem, UserProfile } from '../services/profile';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function joinLines(value?: string[]): string {
  return (value || []).join('\n');
}

function splitComma(value: string): string[] {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

type Props = {
  user: User;
  onUserUpdated: (user: User) => void;
  onSignOut: () => void;
};

const ProfilePage: React.FC<Props> = ({ user, onUserUpdated, onSignOut }) => {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ProfileUpdate>({});
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);

  const displayName = useMemo(() => user.name || 'Student', [user.name]);

  const profile = (user as any) as UserProfile;

  const resumeUrl = useMemo(() => {
    const url = profile.resume?.url;
    if (!url) return null;
    try {
      return new URL(String(url), API_BASE_URL).toString();
    } catch {
      return String(url);
    }
  }, [profile.resume?.url]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const res = await profileService.getProfile(user.email, user.role);
      if (cancelled) return;

      if (res.success && res.profile) {
        const merged = {
          ...user,
          name: res.profile.name,
          email: res.profile.email,
          department: res.profile.department,
          skills: Array.isArray(res.profile.skills) ? res.profile.skills : user.skills,
          ...(res.profile as any),
        } as User;
        onUserUpdated(merged);
        setProjects(res.profile.projects || []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user.email, user.role]);

  useEffect(() => {
    setForm({
      name: profile.name,
      department: profile.department,
      roll_number: (profile as any).roll_number,
      dob: profile.dob,
      personal_email: profile.personal_email,
      phone_number: (profile as any).phone_number,
      cgpa: profile.cgpa,
      arrears_history: profile.arrears_history,
      interests: profile.interests || [],
      skills: profile.skills || user.skills,
      achievements: profile.achievements || [],
      blogs: profile.blogs || [],
      linkedin_url: profile.linkedin_url,
      github_url: profile.github_url,
      leetcode_url: profile.leetcode_url,
      portfolio_url: profile.portfolio_url,
      projects: profile.projects || [],
    });
  }, [user.email]);

  const initials = useMemo(() => (displayName.trim()[0] || 'U').toUpperCase(), [displayName]);

  const setField = (key: keyof ProfileUpdate, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    const payload: ProfileUpdate = {
      ...form,
      projects,
    };

    const res = await profileService.updateProfile(user.email, user.role, payload);
    if (res.success && res.profile) {
      const merged = {
        ...user,
        name: res.profile.name,
        email: res.profile.email,
        department: res.profile.department,
        skills: Array.isArray(res.profile.skills) ? res.profile.skills : user.skills,
        ...(res.profile as any),
      } as User;
      onUserUpdated(merged);
      setMessage('Profile updated');
      setEditing(false);
    } else {
      setError(res.message || 'Failed to update profile');
    }

    setSaving(false);
  };

  const uploadResume = async () => {
    if (!resumeFile) return;
    setUploadingResume(true);
    setMessage(null);
    setError(null);

    const res = await profileService.uploadResume(user.email, user.role, resumeFile);
    if (res.success && res.profile) {
      const merged = {
        ...user,
        ...(res.profile as any),
      } as User;
      onUserUpdated(merged);
      setMessage('Resume uploaded');
      setResumeFile(null);
    } else {
      setError(res.message || 'Resume upload failed');
    }

    setUploadingResume(false);
  };

  return (
    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-10">
        <div className="w-32 h-32 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-5xl font-black text-white shadow-2xl shadow-indigo-100">
          {initials}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-4xl font-black text-slate-800 mb-2">{profile.name || user.name}</h2>
          <p className="text-xl font-bold text-indigo-600 mb-4">{profile.department} • Engineering</p>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{profile.email}</p>
          {loading && <p className="mt-3 text-xs font-bold text-slate-400">Loading profile…</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setEditing(e => !e)}
            className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
          >
            {editing ? 'Close Edit' : 'Edit Profile'}
          </button>
          <button
            onClick={onSignOut}
            className="px-8 py-4 bg-rose-50 text-rose-600 font-black rounded-2xl text-sm border border-rose-100 hover:bg-rose-100 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      {(message || error) && (
        <div className={`p-5 rounded-2xl border font-bold ${error ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-800">Profile Details</h3>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 uppercase tracking-widest">
              {projects.length} projects
            </span>
          </div>

          {!editing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(profile as any).role === 'student' ? (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roll No</p>
                    <p className="font-bold text-slate-700">{(profile as any).roll_number || '—'}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">DOB</p>
                  <p className="font-bold text-slate-700">{profile.dob || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Personal Email (Gmail)</p>
                  <p className="font-bold text-slate-700">{profile.personal_email || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</p>
                  <p className="font-bold text-slate-700">{(profile as any).phone_number || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">CGPA</p>
                  <p className="font-bold text-slate-700">{typeof profile.cgpa === 'number' ? profile.cgpa.toFixed(2) : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">History of arrears</p>
                  <p className="font-bold text-slate-700">{typeof profile.arrears_history === 'number' ? profile.arrears_history : '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interests</p>
                <p className="font-bold text-slate-700">{(profile.interests || []).join(', ') || '—'}</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Skills</p>
                <p className="font-bold text-slate-700">{(profile.skills || user.skills || []).join(', ') || '—'}</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Achievements</p>
                <ul className="mt-2 space-y-2">
                  {(profile.achievements || []).length ? (profile.achievements || []).map((a, i) => (
                    <li key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700">
                      {a}
                    </li>
                  )) : (
                    <li className="text-slate-400 font-bold">—</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blogs</p>
                <ul className="mt-2 space-y-2">
                  {(profile.blogs || []).length ? (profile.blogs || []).map((b, i) => (
                    <li key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700">
                      {b}
                    </li>
                  )) : (
                    <li className="text-slate-400 font-bold">—</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Links</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {([
                    ['LinkedIn', profile.linkedin_url],
                    ['GitHub', profile.github_url],
                    ['LeetCode', profile.leetcode_url],
                    ['Portfolio', profile.portfolio_url],
                  ] as Array<[string, any]>).map(([label, url]) => (
                    <div key={label} className="p-4 rounded-2xl border border-slate-100 bg-white">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                      {url ? (
                        <a className="font-black text-indigo-600 hover:underline break-all" href={String(url)} target="_blank" rel="noreferrer">
                          {String(url)}
                        </a>
                      ) : (
                        <p className="font-bold text-slate-400">—</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Projects</p>
                <div className="mt-2 space-y-3">
                  {projects.length ? (
                    projects.map((p, i) => (
                      <div key={i} className="p-5 rounded-2xl border border-slate-100 bg-slate-50">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-black text-slate-800">{p.title}</p>
                          {p.link ? (
                            <a className="text-indigo-600 font-black text-xs hover:underline break-all" href={p.link} target="_blank" rel="noreferrer">
                              Link
                            </a>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-600 whitespace-pre-wrap">{p.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 font-bold">—</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
                  <input
                    value={form.name || ''}
                    onChange={e => setField('name', e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Department</label>
                  <input
                    value={form.department || ''}
                    onChange={e => setField('department', e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                {(profile as any).role === 'student' ? (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roll No</label>
                    <input
                      value={(form as any).roll_number || ''}
                      onChange={e => setField('roll_number' as any, e.target.value || undefined)}
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                      placeholder="21CSR123"
                    />
                  </div>
                ) : null}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">DOB</label>
                  <input
                    type="date"
                    value={form.dob || ''}
                    onChange={e => setField('dob', e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Personal Email (Gmail)</label>
                  <input
                    type="email"
                    value={form.personal_email || ''}
                    onChange={e => setField('personal_email', e.target.value || undefined)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</label>
                  <input
                    inputMode="tel"
                    value={(form as any).phone_number || ''}
                    onChange={e => setField('phone_number' as any, e.target.value || undefined)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                    placeholder="+91XXXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">CGPA</label>
                  <input
                    type="number"
                    step="0.01"
                    value={typeof form.cgpa === 'number' ? form.cgpa.toFixed(2) : ''}
                    onChange={e => setField('cgpa', e.target.value === '' ? undefined : Number(e.target.value))}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">History of arrears</label>
                  <input
                    type="number"
                    value={typeof form.arrears_history === 'number' ? String(form.arrears_history) : ''}
                    onChange={e => setField('arrears_history', e.target.value === '' ? undefined : Number(e.target.value))}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interests (comma separated)</label>
                <input
                  value={(form.interests || []).join(', ')}
                  onChange={e => setField('interests', splitComma(e.target.value))}
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                  placeholder="AI, Web, Cloud"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Skills (comma separated)</label>
                <input
                  value={(form.skills || []).join(', ')}
                  onChange={e => setField('skills', splitComma(e.target.value))}
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                  placeholder="React, Python, MongoDB"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Achievements (one per line)</label>
                <textarea
                  value={joinLines(form.achievements)}
                  onChange={e => setField('achievements', splitLines(e.target.value))}
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold min-h-[120px]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blogs (one per line: URL or title)</label>
                <textarea
                  value={joinLines(form.blogs)}
                  onChange={e => setField('blogs', splitLines(e.target.value))}
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold min-h-[120px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">LinkedIn URL</label>
                  <input
                    value={form.linkedin_url || ''}
                    onChange={e => setField('linkedin_url', e.target.value || undefined)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">GitHub URL</label>
                  <input
                    value={form.github_url || ''}
                    onChange={e => setField('github_url', e.target.value || undefined)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                    placeholder="https://github.com/..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">LeetCode URL</label>
                  <input
                    value={form.leetcode_url || ''}
                    onChange={e => setField('leetcode_url', e.target.value || undefined)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                    placeholder="https://leetcode.com/..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Portfolio URL</label>
                  <input
                    value={form.portfolio_url || ''}
                    onChange={e => setField('portfolio_url', e.target.value || undefined)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Projects</label>
                  <button
                    type="button"
                    onClick={() => setProjects(prev => [...prev, { title: '', description: '' }])}
                    className="text-xs font-black text-indigo-600 hover:underline"
                  >
                    + Add project
                  </button>
                </div>
                <div className="mt-3 space-y-4">
                  {projects.map((p, idx) => (
                    <div key={idx} className="p-5 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-black text-slate-800">Project #{idx + 1}</p>
                        <button
                          type="button"
                          onClick={() => setProjects(prev => prev.filter((_, i) => i !== idx))}
                          className="text-xs font-black text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Title</label>
                          <input
                            value={p.title}
                            onChange={e => setProjects(prev => prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))}
                            className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Link (optional)</label>
                          <input
                            value={p.link || ''}
                            onChange={e => setProjects(prev => prev.map((x, i) => (i === idx ? { ...x, link: e.target.value || undefined } : x)))}
                            className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</label>
                        <textarea
                          value={p.description}
                          onChange={e => setProjects(prev => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))}
                          className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 font-bold min-h-[120px]"
                        />
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && <p className="text-slate-400 font-bold">No projects added yet.</p>}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl text-sm shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl text-sm border border-slate-200 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 space-y-6">
          <h3 className="text-xl font-black text-slate-800">Resume</h3>

          {profile.resume?.url ? (
            <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Current</p>
              <p className="mt-2 font-black text-slate-800 break-all">{profile.resume.originalName}</p>
              <a
                href={resumeUrl || undefined}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-indigo-600 font-black text-sm hover:underline"
              >
                View / Download
              </a>
            </div>
          ) : (
            <p className="text-slate-400 font-bold">No resume uploaded yet.</p>
          )}

          <div className="p-5 rounded-2xl border border-slate-200">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Upload Resume (PDF/DOC/DOCX, max 5MB)</label>
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={e => setResumeFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            <div className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-center">
              <button
                type="button"
                onClick={() => resumeInputRef.current?.click()}
                className="px-6 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all"
              >
                {resumeFile ? 'Change file' : 'Choose file'}
              </button>
              <div className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 break-all">
                {resumeFile ? resumeFile.name : 'No file selected'}
              </div>
              {resumeFile ? (
                <button
                  type="button"
                  onClick={() => {
                    setResumeFile(null);
                    if (resumeInputRef.current) resumeInputRef.current.value = '';
                  }}
                  className="px-5 py-3 bg-slate-100 text-slate-700 font-black rounded-2xl text-sm border border-slate-200 hover:bg-slate-200 transition-all"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <button
              onClick={uploadResume}
              disabled={!resumeFile || uploadingResume}
              className="mt-4 w-full py-3 bg-slate-900 text-white font-black rounded-2xl text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {uploadingResume ? 'Uploading…' : 'Upload'}
            </button>
          </div>

          <div className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700 font-bold text-sm">
            Tip: Keep your profile updated with skills, projects, and links.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
