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

export default function StudentNotesPage({ user }: { user: User }) {
  const [items, setItems] = React.useState<NoteItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = async () => {
    setLoading(true);
    const list = await managementContentService.listVisibleNotes({ email: user.email, role: user.role });
    setItems(list);
    setLoading(false);
  };

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email, user.role]);

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Notes</h2>
        <button
          onClick={load}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#666" }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ color: "#666" }}>No notes available for your department.</div>
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
                <div style={{ color: "#666", fontSize: 12 }}>{new Date(it.createdAt).toLocaleString()}</div>
              </div>

              {it.description ? <div style={{ marginTop: 6, color: "#444" }}>{it.description}</div> : null}

              <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <a href={toAbsoluteUrl(it.file.url)} target="_blank" rel="noreferrer">
                  Open / Download
                </a>
                <div style={{ color: "#666", fontSize: 12 }}>{it.file.originalName}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
