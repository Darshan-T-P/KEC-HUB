import React from "react";
import { User } from "../types";
import { managementContentService, InstructionItem } from "../services/managementContent";

export default function StudentInstructionsPage({ user }: { user: User }) {
  const [items, setItems] = React.useState<InstructionItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = async () => {
    setLoading(true);
    const list = await managementContentService.listVisibleInstructions({ email: user.email, role: user.role });
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
        <h2 style={{ marginTop: 0 }}>Instructions</h2>
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
        <div style={{ color: "#666" }}>No instructions available for your department.</div>
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
              <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{it.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
