import React, { useMemo, useState } from "react";
import { User } from "../types";
import { managementContentService } from "../services/managementContent";

const parseDepartmentsCsv = (csv: string): string[] => {
  const raw = (csv || "").trim();
  if (!raw || raw.toLowerCase() === "all") return [];
  return raw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
};

export default function ManagementInstructionsPage({ user }: { user: User }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [departmentsCsv, setDepartmentsCsv] = useState("all");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const allowedDepartments = useMemo(() => parseDepartmentsCsv(departmentsCsv), [departmentsCsv]);

  const load = async () => {
    const list = await managementContentService.listMyInstructions({ email: user.email, role: user.role });
    setItems(list as any);
  };

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email, user.role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title.trim() || !body.trim()) {
      setMessage("Please enter title and instructions.");
      return;
    }

    setLoading(true);
    const res = await managementContentService.createInstruction(
      { email: user.email, role: user.role },
      {
        title: title.trim(),
        body: body.trim(),
        allowedDepartments,
      }
    );
    setLoading(false);

    setMessage(res.message);
    if (res.success) {
      setTitle("");
      setBody("");
      await load();
    }
  };

  return (
    <div style={{ maxWidth: 920 }}>
      <h2 style={{ marginTop: 0 }}>Post Instructions</h2>

      <form onSubmit={submit} style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g., Placement registration instructions)"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write instructions..."
          rows={6}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
        />

        <input
          value={departmentsCsv}
          onChange={(e) => setDepartmentsCsv(e.target.value)}
          placeholder="Departments (comma-separated) or 'all'"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

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
          {loading ? "Posting..." : "Post"}
        </button>

        {message && <div style={{ color: "#444" }}>{message}</div>}
      </form>

      <h3 style={{ margin: "14px 0 8px" }}>My Instructions</h3>
      {items.length === 0 ? (
        <div style={{ color: "#666" }}>No instructions posted yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((it: any) => (
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
                <div style={{ color: "#666", fontSize: 12 }}>{new Date(it.createdAt).toLocaleString()}</div>
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{it.body}</div>
              <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
                Visible to: {Array.isArray(it.allowedDepartments) && it.allowedDepartments.length > 0 ? it.allowedDepartments.join(", ") : "All"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
