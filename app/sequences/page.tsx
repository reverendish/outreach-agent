"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../components/Shell";
import { db, newId } from "../../src/db";
import type { Sequence } from "../../src/types";

export default function Sequences() {
  const router = useRouter();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    db.sequences.toArray().then(setSequences);
  }, []);

  const createSequence = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const seq: Sequence = {
      id: newId(),
      name: newName.trim(),
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.sequences.add(seq);
    setSequences(prev => [...prev, seq]);
    setNewName("");
    setCreating(false);
    router.push(`/sequence/${seq.id}`);
  };

  return (
    <Shell>
      <div style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Sequences</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Reusable multi-step email sequences.</p>
          </div>
        </div>

        {/* Create new */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>New sequence</p>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createSequence()}
              placeholder="e.g. Initial outreach — 3 steps"
              style={{ flex: 1 }}
            />
            <button onClick={createSequence} disabled={!newName.trim() || creating} className="btn btn-primary">
              Create →
            </button>
          </div>
        </div>

        {/* List */}
        {sequences.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: "0.875rem", textAlign: "center", padding: 32 }}>
            No sequences yet. Create one above.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sequences.map(s => (
              <div
                key={s.id}
                onClick={() => router.push(`/sequence/${s.id}`)}
                className="card"
                style={{ padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{s.name}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {s.steps.length} step{s.steps.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <span style={{ color: "var(--faint)", fontSize: "0.9rem" }}>→</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
