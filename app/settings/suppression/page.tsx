"use client";
import { useEffect, useState } from "react";
import Shell from "../../../components/Shell";
import { db } from "../../../src/db";
import type { SuppressionEntry } from "../../../src/types";

export default function SuppressionSettings() {
  const [entries, setEntries] = useState<SuppressionEntry[]>([]);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    db.suppression.orderBy("optedOutAt").reverse().toArray().then(setEntries);
  }, []);

  const remove = async (email: string) => {
    await db.suppression.delete(email);
    setEntries(prev => prev.filter(e => e.email !== email));
    setConfirmRemove(null);
  };

  const SOURCE_LABELS: Record<SuppressionEntry["source"], string> = {
    unsubscribe_reply: "Unsubscribe reply",
    manual: "Manually added",
    bounce: "Bounce",
  };

  return (
    <Shell>
      <div style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Suppression list</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            {entries.length} suppressed address{entries.length !== 1 ? "es" : ""}. Suppressed contacts cannot be emailed. Removal is permanent and irreversible.
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: "var(--faint)", fontSize: "0.875rem" }}>No suppressed addresses.</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                  {["Email", "Company", "Source", "Date", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--faint)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.email} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", fontSize: "0.875rem", color: "var(--text)", fontFamily: "var(--font-mono)" }}>{e.email}</td>
                    <td style={{ padding: "12px 16px", fontSize: "0.82rem", color: "var(--muted)" }}>{e.companyName ?? "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className="badge badge-grey">{SOURCE_LABELS[e.source]}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "0.78rem", color: "var(--faint)" }}>
                      {new Date(e.optedOutAt).toLocaleDateString("en-GB")}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {confirmRemove === e.email ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => remove(e.email)} className="btn btn-danger btn-sm">Confirm remove</button>
                          <button onClick={() => setConfirmRemove(null)} className="btn btn-ghost btn-sm">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmRemove(e.email)} className="btn btn-ghost btn-sm">Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
