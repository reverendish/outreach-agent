"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Shell from "../../../components/Shell";
import { crmApi, type Prospect, type ProspectStatus, type ReplyStatus } from "../../lib/api";

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

const STATUS_OPTIONS: ProspectStatus[] = ["new", "contacted", "replied", "converted", "archived"];
const REPLY_OPTIONS: Array<{ value: ReplyStatus; label: string }> = [
  { value: "none",     label: "No reply" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
];

const STATUS_BADGE: Record<string, string> = {
  new: "badge-blue", contacted: "badge-amber", replied: "badge-amber",
  converted: "badge-green", archived: "badge-grey",
};

export default function ProspectPage() {
  const router = useRouter();
  const { number } = useParams<{ number: string }>();

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesTimer, setNotesTimer] = useState<NodeJS.Timeout | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { prospects } = await crmApi.list();
      const found = prospects.find(p => p.companyNumber === number) || null;
      setProspect(found);
      setNotes(found?.notes || "");
      if (!found) setError("Prospect not found.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => { load(); }, [load]);

  async function updateField(patch: Partial<Prospect>) {
    if (!prospect) return;
    setSaving(true);
    try {
      const { prospect: updated } = await crmApi.update(number, patch);
      setProspect(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  function handleNotesChange(val: string) {
    setNotes(val);
    if (notesTimer) clearTimeout(notesTimer);
    setNotesTimer(setTimeout(() => updateField({ notes: val }), 800));
  }

  async function handleDelete() {
    if (!confirm(`Remove ${prospect?.companyName} from your CRM?`)) return;
    setDeleting(true);
    try {
      await crmApi.delete(number);
      router.push("/prospects");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <span className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      </Shell>
    );
  }

  if (error || !prospect) {
    return (
      <Shell>
        <div style={{ maxWidth: 600 }}>
          <p style={{ color: "var(--status-red)", marginBottom: 16 }}>{error || "Not found."}</p>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push("/prospects")}>← Back</button>
        </div>
      </Shell>
    );
  }

  const ch = prospect.chData;

  return (
    <Shell>
      <div style={{ maxWidth: 720 }}>
        {/* Back */}
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 20 }}
          onClick={() => router.push("/prospects")}
        >
          ← Prospects
        </button>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              {toTitleCase(prospect.companyName)}
            </h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className={`badge ${STATUS_BADGE[prospect.status]}`}>{prospect.status}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--faint)" }}>{prospect.companyNumber}</span>
              {ch?.type && <span style={{ fontSize: "0.75rem", color: "var(--faint)" }}>{ch.type}</span>}
              {ch?.incorporated && <span style={{ fontSize: "0.75rem", color: "var(--faint)" }}>Inc. {ch.incorporated}</span>}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => router.push(`/compose?company=${prospect.companyNumber}`)}
          >
            Compose Email
          </button>
        </div>

        {/* Company info */}
        {ch && (
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Companies House
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {ch.address && (
                <div>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 2 }}>Address</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text)" }}>{ch.address}</p>
                </div>
              )}
              {ch.sic && (
                <div>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 2 }}>SIC</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text)" }}>{ch.sic}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status & reply */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
            Status
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: 6 }}>Pipeline</label>
              <select
                value={prospect.status}
                onChange={e => updateField({ status: e.target.value as ProspectStatus })}
                style={{ width: "100%" }}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: 6 }}>Reply</label>
              <select
                value={prospect.replyStatus || "none"}
                onChange={e => updateField({ replyStatus: e.target.value as ReplyStatus })}
                style={{ width: "100%" }}
              >
                {REPLY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: 6 }}>Emails sent</label>
              <p style={{ fontSize: "1.4rem", fontWeight: 700, color: prospect.emailsSent > 0 ? "var(--text)" : "var(--faint)", marginTop: 6 }}>
                {prospect.emailsSent || 0}
              </p>
            </div>
          </div>
          {saving && (
            <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 12 }}>Saving…</p>
          )}
        </div>

        {/* Notes */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Notes
          </p>
          <textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Add notes about this company…"
            style={{ width: "100%", minHeight: 100, resize: "vertical", lineHeight: 1.6 }}
          />
          <p style={{ fontSize: "0.7rem", color: "var(--faint)", marginTop: 6 }}>Auto-saves as you type.</p>
        </div>

        {/* Danger zone */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button
            className="btn btn-danger btn-sm"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? "Removing…" : "Remove from CRM"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
