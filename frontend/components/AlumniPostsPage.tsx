import React, { useEffect, useMemo, useState } from "react";
import { User } from "../types";
import { alumniService, AlumniPost } from "../services/alumni";

type Props = {
  user: User;
};

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

const AlumniPostsPage: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<AlumniPost[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [link, setLink] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tagList = useMemo(() => splitTags(tags), [tags]);

  const refresh = async () => {
    setLoading(true);
    const data = await alumniService.listPostsByAlumni(user.email);
    setPosts(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email]);

  const create = async () => {
    setError(null);
    setToast(null);
    if (user.role !== "alumni") {
      setError("Only alumni can create posts.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }

    setSaving(true);
    let res;
    if (editingPostId) {
      res = await alumniService.updatePost(user, editingPostId, title.trim(), description.trim(), tagList, link.trim() || undefined);
    } else {
      res = await alumniService.createPost(user, title.trim(), description.trim(), tagList, link.trim() || undefined);
    }
    setSaving(false);

    if (res.success) {
      setToast(editingPostId ? "Post updated" : "Post created");
      setTitle("");
      setDescription("");
      setTags("");
      setLink("");
      setEditingPostId(null);
      refresh();
    } else {
      setError(res.message || `Failed to ${editingPostId ? 'update' : 'create'} post`);
    }
  };

  const startEdit = (post: AlumniPost) => {
    setEditingPostId(post.id);
    setTitle(post.title);
    setDescription(post.description);
    setTags(post.tags.join(", "));
    setLink(post.link || "");
    setError(null);
    setToast(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setTitle("");
    setDescription("");
    setTags("");
    setLink("");
    setError(null);
    setToast(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black text-slate-800">Alumni Home • Post Opportunities</h2>
        <p className="mt-2 text-slate-500 font-bold">Share opportunities you know. Students can request referrals and chat with you.</p>

        {(toast || error) && (
          <div className={`mt-5 p-4 rounded-2xl border font-bold ${error ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
            {error || toast}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-50 rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800">{editingPostId ? "Edit Post" : "Create Post"}</h3>
              {editingPostId && (
                <button onClick={cancelEdit} className="text-xs font-black text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (e.g. SDE Intern @ Company)"
                className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 outline-none font-bold focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description / eligibility / how to apply"
                className="w-full min-h-[140px] px-4 py-3 rounded-2xl bg-white border border-slate-200 outline-none font-bold focus:ring-2 focus:ring-indigo-500"
              />
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags (comma separated)"
                className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 outline-none font-bold focus:ring-2 focus:ring-indigo-500"
              />
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Link (optional)"
                className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 outline-none font-bold focus:ring-2 focus:ring-indigo-500"
              />
              <button
                disabled={saving}
                onClick={create}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {saving ? (editingPostId ? "Updating…" : "Posting…") : (editingPostId ? "Update Post" : "Post Opportunity")}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-slate-800">My Posts</h3>
              <button onClick={refresh} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200">
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="p-10 text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                <p className="font-bold text-slate-500">Loading…</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                <p className="font-black text-slate-800">No posts yet.</p>
                <p className="mt-2 text-sm font-bold text-slate-500">Create your first post to help students.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {posts.map(p => (
                  <div key={p.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                          POST
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{(() => {
                          const d = new Date(p.createdAt);
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const year = d.getFullYear();
                          return `${day}-${month}-${year}`;
                        })()}</span>
                      </div>
                      <button
                        onClick={() => startEdit(p)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black border border-slate-200 transition-all"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                    <h4 className="mt-3 text-xl font-black text-slate-800">{p.title}</h4>
                    <p className="mt-2 text-slate-600 font-bold whitespace-pre-wrap">{p.description}</p>
                    {p.tags?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {p.tags.map((t, idx) => (
                          <span key={idx} className="text-[10px] font-black text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 uppercase tracking-widest">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {p.link ? (
                      <div className="mt-5">
                        <a href={p.link} target="_blank" rel="noreferrer" className="text-indigo-700 font-black hover:underline">
                          Open Link →
                        </a>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlumniPostsPage;
