import React from "react";
import { User } from "../types";
import { managementContentService, NoteItem } from "../services/managementContent";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

const toAbsoluteUrl = (url: string): string => {
  try {
    return new URL(String(url), API_BASE_URL).toString();
  } catch {
    return String(url);
  }
};

export default function ManagementNotesPage({ user }: { user: User }) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [departmentsCsv, setDepartmentsCsv] = React.useState("all");
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<NoteItem[]>([]);

  const load = async () => {
    const list = await managementContentService.listMyNotes({ email: user.email, role: user.role });
    setItems(list);
  };

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email, user.role]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title.trim()) {
      setMessage("Please enter a title.");
      return;
    }
    if (!file) {
      setMessage("Please choose a file (PDF or image).");
      return;
    }

    setLoading(true);
    const res = await managementContentService.uploadNote(
      { email: user.email, role: user.role },
      {
        title: title.trim(),
        description: description.trim(),
        allowedDepartmentsCsv: departmentsCsv,
        file,
      }
    );
    setLoading(false);

    setMessage(res.message);
    if (res.success) {
      setTitle("");
      setDescription("");
      setDepartmentsCsv("all");
      setFile(null);
      await load();
    }
  };

  return (
    <div style={{ maxWidth: 920 }}>
      <h2 style={{ marginTop: 0 }}>Upload Notes (PDF / Images)</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g., Aptitude Notes - Unit 1)"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
        />

        <input
          value={departmentsCsv}
          onChange={(e) => setDepartmentsCsv(e.target.value)}
          placeholder="Departments (comma-separated) or 'all'"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ display: "none" }}
        />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#f8fafc",
              color: "#111",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {file ? "Change file" : "Choose file"}
          </button>
          <div style={{ color: "#444", fontSize: 13, fontWeight: 700, wordBreak: "break-all" }}>
            {file ? file.name : "No file selected"}
          </div>
          {file ? (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
                color: "#111",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Remove
            </button>
          ) : null}
        </div>

        <button
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            width: "fit-content",
          }}
        >
          {loading ? "Uploading..." : "Upload"}
        </button>

        {message && <div style={{ color: "#444" }}>{message}</div>}
      </form>

      <h3 style={{ margin: "14px 0 8px" }}>My Uploaded Notes</h3>
      {items.length === 0 ? (
        <div style={{ color: "#666" }}>No notes uploaded yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                border: "1px solid #e7e7e7",
                borderRadius: 14,
                padding: 12,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>{it.title}</div>
                <div style={{ color: "#666", fontSize: 12 }}>{(() => {
                  const d = new Date(it.createdAt);
                  const day = String(d.getDate()).padStart(2, '0');
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const year = d.getFullYear();
                  return `${day}-${month}-${year}`;
                })()}</div>
              </div>

              {it.description ? <div style={{ marginTop: 6, color: "#444" }}>{it.description}</div> : null}

              <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <a href={toAbsoluteUrl(it.file.url)} target="_blank" rel="noreferrer">
                  Open / Download
                </a>
                <div style={{ color: "#666", fontSize: 12 }}>{it.file.originalName}</div>
                <div style={{ color: "#666", fontSize: 12 }}>
                  Visible to: {it.allowedDepartments.length > 0 ? it.allowedDepartments.join(", ") : "All"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
