"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../components/Shell";
import { db } from "../../src/db";
import type { Campaign, Sequence } from "../../src/types";

const STATUS_COLORS: Record<Campaign["status"], string> = {
  draft: "badge-grey",
  active: "badge-green",
  paused: "badge-amber",
  completed: "badge-blue",
};

const TYPE_LABELS: Record<Campaign["type"], string> = {
  initial_outreach: "Initial outreach",
  follow_up_sequence: "Follow-up sequence",
  re_engagement: "Re-engagement",
  partnership_outreach: "Partnership outreach",
  sector_campaign: "Sector campaign",
};

export default function Campaigns() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sequenceMap, setSequenceMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.campaigns.orderBy("createdAt").reverse().toArray(),
      db.sequences.toArray(),
    ]).then(([camps, seqs]) => {
      setCampaigns(camps);
      const m: Record<string, string> = {};
      seqs.forEach(s => { m[s.id] = s.name; });
      setSequenceMap(m);
      setLoading(false);
    });
  }, []);

  const totalStats = campaigns.reduce(
    (acc, c) => ({
      total: acc.total + c.stats.total,
      sent: acc.sent + c.stats.sent,
      replied: acc.replied + c.stats.replied,
      converted: acc.converted + c.stats.converted,
    }),
    { total: 0, sent: 0, replied: 0, converted: 0 }
  );

  return (
    <Shell>
      <div style={{ maxWidth: 800 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Campaigns</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Multi-step outreach campaigns.</p>
          </div>
          <button onClick={() => router.push("/campaigns/new")} className="btn btn-primary">
            New campaign
          </button>
        </div>

        {/* Summary stats (only if any campaigns) */}
        {campaigns.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total contacts", value: totalStats.total },
              { label: "Emails sent", value: totalStats.sent },
              { label: "Replies", value: totalStats.replied },
              { label: "Converted", value: totalStats.converted },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: "14px 18px" }}>
                <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card" style={{ padding: 64, textAlign: "center" }}>
            <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>No campaigns yet</p>
            <p style={{ fontSize: "0.82rem", color: "var(--faint)", marginBottom: 20 }}>
              Create a campaign to start sending structured outreach sequences.
            </p>
            <button onClick={() => router.push("/campaigns/new")} className="btn btn-primary">
              Create first campaign
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {campaigns.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`/campaign/${c.id}`)}
                className="card"
                style={{ padding: "18px 20px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>{c.name}</p>
                      <span className={`badge ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                      {!c.liAssessmentCompleted && c.status !== "draft" && (
                        <span className="badge badge-amber">LI pending</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: "0.78rem", color: "var(--muted)" }}>
                      <span>{TYPE_LABELS[c.type]}</span>
                      {sequenceMap[c.sequenceId] && (
                        <span>Sequence: {sequenceMap[c.sequenceId]}</span>
                      )}
                      <span>{c.stats.total} contact{c.stats.total !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 24, textAlign: "right", marginLeft: 20 }}>
                    <div>
                      <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>{c.stats.sent}</p>
                      <p style={{ fontSize: "0.68rem", color: "var(--faint)" }}>sent</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--status-green)" }}>{c.stats.replied}</p>
                      <p style={{ fontSize: "0.68rem", color: "var(--faint)" }}>replied</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>{c.stats.converted}</p>
                      <p style={{ fontSize: "0.68rem", color: "var(--faint)" }}>converted</p>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {c.stats.total > 0 && (
                  <div style={{ marginTop: 14, background: "var(--surface-2)", borderRadius: 4, height: 3, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.round((c.stats.sent / c.stats.total) * 100))}%`,
                        background: "var(--accent)",
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
