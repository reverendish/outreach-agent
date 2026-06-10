"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../../components/Shell";
import { db, newId, getSettings } from "../../../src/db";
import type {
  Campaign,
  CampaignType,
  EmailMode,
  EmailLength,
  Profile,
  Sequence,
} from "../../../src/types";

const CAMPAIGN_TYPES: { value: CampaignType; label: string; description: string }[] = [
  { value: "initial_outreach", label: "Initial outreach", description: "First contact with new prospects." },
  { value: "follow_up_sequence", label: "Follow-up sequence", description: "Follow up on previous no-reply." },
  { value: "re_engagement", label: "Re-engagement", description: "Reconnect with previously contacted leads." },
  { value: "partnership_outreach", label: "Partnership outreach", description: "Collaboration or partnership proposals." },
  { value: "sector_campaign", label: "Sector campaign", description: "Targeted outreach to a specific sector." },
];

const EMAIL_MODES: { value: EmailMode; label: string; description: string }[] = [
  { value: "fully_ai", label: "Fully AI", description: "Claude generates each email from enrichment data." },
  { value: "template_ai_slots", label: "Template + AI slots", description: "Fixed template with AI-filled personalisation slots." },
  { value: "campaign_template", label: "Campaign template", description: "Static template with token replacements only." },
];

const STEPS = ["Type & profile", "Sequence", "Email mode", "Review"];

export default function NewCampaign() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // form state
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("initial_outreach");
  const [profileId, setProfileId] = useState<string>("");
  const [sequenceId, setSequenceId] = useState<string>("");
  const [emailMode, setEmailMode] = useState<EmailMode>("fully_ai");
  const [emailLength, setEmailLength] = useState<EmailLength>("medium");

  // data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const settings = getSettings();
    Promise.all([
      db.profiles.toArray(),
      db.sequences.toArray(),
    ]).then(([profs, seqs]) => {
      setProfiles(profs);
      setSequences(seqs);
      if (profs.length > 0) {
        setProfileId(settings.activeProfileId ?? profs[0].id);
      }
    });
  }, []);

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0 && profileId;
    if (step === 1) return sequenceId !== "";
    return true;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const campaign: Campaign = {
        id: newId(),
        profileId,
        name: name.trim(),
        type,
        status: "draft",
        defaultEmailMode: emailMode,
        defaultEmailLength: emailLength,
        sequenceId,
        contactIds: [],
        liAssessmentId: null,
        liAssessmentCompleted: false,
        stats: { total: 0, sent: 0, replied: 0, optedOut: 0, converted: 0 },
        createdAt: now,
        updatedAt: now,
      };
      await db.campaigns.add(campaign);
      router.push(`/campaign/${campaign.id}`);
    } catch (e) {
      setError("Failed to save campaign.");
      setSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--muted)",
    marginBottom: 8,
  };

  return (
    <Shell>
      <div style={{ maxWidth: 560 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 16 }}
          >
            ← Back
          </button>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            New campaign
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            Set up a new outreach campaign in a few steps.
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 0, marginBottom: 32, borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)" }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1,
                padding: "10px 0",
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: i === step ? 700 : 400,
                color: i === step ? "var(--bg)" : i < step ? "var(--muted)" : "var(--faint)",
                background: i === step ? "var(--accent)" : i < step ? "var(--surface-2)" : "var(--surface)",
                borderRight: i < STEPS.length - 1 ? "1px solid var(--border)" : undefined,
                transition: "background 0.2s",
              }}
            >
              {i < step ? "✓ " : ""}{s}
            </div>
          ))}
        </div>

        {/* Step 0: Type & Profile */}
        {step === 0 && (
          <div className="card" style={{ padding: 24, display: "grid", gap: 20 }}>
            <div>
              <label style={labelStyle}>Campaign name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Construction sector — Q3 2026"
                style={{ width: "100%" }}
                autoFocus
              />
            </div>

            <div>
              <label style={labelStyle}>Campaign type</label>
              <div style={{ display: "grid", gap: 8 }}>
                {CAMPAIGN_TYPES.map(ct => (
                  <label
                    key={ct.value}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "12px 14px",
                      background: type === ct.value ? "var(--accent-soft)" : "var(--surface-2)",
                      border: `1px solid ${type === ct.value ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="campaignType"
                      value={ct.value}
                      checked={type === ct.value}
                      onChange={() => setType(ct.value)}
                      style={{ marginTop: 2, accentColor: "var(--accent)" }}
                    />
                    <div>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{ct.label}</p>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{ct.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Profile</label>
              {profiles.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--status-red)" }}>
                  No profiles found. <a href="/settings/profiles/new" style={{ color: "var(--accent)" }}>Create one</a> first.
                </p>
              ) : (
                <select
                  value={profileId}
                  onChange={e => setProfileId(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.companyName}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Sequence */}
        {step === 1 && (
          <div className="card" style={{ padding: 24 }}>
            <label style={labelStyle}>Select sequence</label>
            {sequences.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: 16 }}>
                  No sequences yet. Create one first.
                </p>
                <button
                  onClick={() => router.push("/sequences")}
                  className="btn btn-primary"
                >
                  Go to Sequences
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {sequences.map(s => (
                  <label
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      background: sequenceId === s.id ? "var(--accent-soft)" : "var(--surface-2)",
                      border: `1px solid ${sequenceId === s.id ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="sequence"
                      value={s.id}
                      checked={sequenceId === s.id}
                      onChange={() => setSequenceId(s.id)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{s.name}</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {s.steps.length} step{s.steps.length !== 1 ? "s" : ""}
                        {s.steps.length > 0 && ` · ${s.steps.reduce((sum, st) => sum + st.waitDays, 0)}d total`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => router.push("/sequences")}
                className="btn btn-ghost btn-sm"
              >
                + Create new sequence
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Email mode */}
        {step === 2 && (
          <div className="card" style={{ padding: 24, display: "grid", gap: 20 }}>
            <div>
              <label style={labelStyle}>Default email generation mode</label>
              <div style={{ display: "grid", gap: 8 }}>
                {EMAIL_MODES.map(em => (
                  <label
                    key={em.value}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "12px 14px",
                      background: emailMode === em.value ? "var(--accent-soft)" : "var(--surface-2)",
                      border: `1px solid ${emailMode === em.value ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="emailMode"
                      value={em.value}
                      checked={emailMode === em.value}
                      onChange={() => setEmailMode(em.value)}
                      style={{ marginTop: 2, accentColor: "var(--accent)" }}
                    />
                    <div>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{em.label}</p>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{em.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Default email length</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["short", "medium", "long"] as EmailLength[]).map(l => (
                  <button
                    key={l}
                    onClick={() => setEmailLength(l)}
                    className={`btn btn-sm ${emailLength === l ? "btn-primary" : "btn-ghost"}`}
                  >
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="card" style={{ padding: 24 }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--faint)", marginBottom: 16 }}>
              Review
            </p>
            {[
              { label: "Name", value: name },
              { label: "Type", value: CAMPAIGN_TYPES.find(t => t.value === type)?.label },
              { label: "Profile", value: profiles.find(p => p.id === profileId)?.name },
              { label: "Sequence", value: sequences.find(s => s.id === sequenceId)?.name ?? "—" },
              { label: "Email mode", value: EMAIL_MODES.find(m => m.value === emailMode)?.label },
              { label: "Email length", value: emailLength },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "0.875rem",
                }}
              >
                <span style={{ color: "var(--muted)" }}>{row.label}</span>
                <span style={{ color: "var(--text)", fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}

            <div style={{ marginTop: 20, padding: "14px 16px", background: "var(--surface-2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                <strong style={{ color: "var(--text)" }}>Note:</strong> The campaign will be saved as a <strong>draft</strong>. Add contacts and complete the LI assessment before activating.
              </p>
            </div>

            {error && (
              <p style={{ marginTop: 12, fontSize: "0.82rem", color: "var(--status-red)" }}>{error}</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost">
              ← Back
            </button>
          ) : (
            <div />
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="btn btn-primary"
            >
              Continue →
            </button>
          ) : (
            <button onClick={save} disabled={saving} className="btn btn-primary">
              {saving ? "Creating…" : "Create campaign →"}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}
