"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, saveSettings, newId } from "../../src/db";
import type { Profile } from "../../src/types";

const SECTORS = [
  "Construction", "Hospitality", "Retail", "Manufacturing", "Professional Services",
  "Healthcare", "Education", "Technology", "Finance", "Recruitment",
  "Marketing & Media", "Property", "Transport & Logistics", "Food & Beverage", "Other",
];

const STEPS = ["Profile", "Email style", "Email sending"];

type StepId = 0 | 1 | 2;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 0 — Profile
  const [profileName, setProfileName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [yourName, setYourName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [valueProposition, setValueProposition] = useState("");

  // Step 1 — Email style
  const [emailTone, setEmailTone] = useState<Profile["emailTone"]>("conversational");
  const [emailLength, setEmailLength] = useState<Profile["emailLength"]>("medium");

  // Step 2 — SES
  const [sesFromAddress, setSesFromAddress] = useState("");

  const toggleSector = (s: string) =>
    setSelectedSectors((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const canProceed = (): boolean => {
    if (step === 0) return !!(profileName && companyName && yourName && companyDescription && valueProposition);
    if (step === 1) return !!(emailTone && emailLength);
    return true; // step 2 — SES optional
  };

  const finish = async () => {
    setSaving(true);
    setError("");
    try {
      const id = newId();
      const profile: Profile = {
        id,
        name: profileName.trim(),
        companyName: companyName.trim(),
        yourName: yourName.trim(),
        companyDescription: companyDescription.trim(),
        targetSectors: selectedSectors,
        valueProposition: valueProposition.trim(),
        emailTone,
        emailLength,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.profiles.add(profile);
      saveSettings({
        activeProfileId: id,
        sesFromAddress: sesFromAddress.trim(),
        onboardingComplete: true,
      });
      router.push("/");
    } catch {
      setError("Something went wrong saving your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < 2) setStep((s) => (s + 1) as StepId);
    else finish();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-2)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text)",
    fontSize: "0.875rem",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--muted)",
    marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>
            Outreach Agent
          </p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            Set up your workspace
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            You can change everything later in Settings.
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                height: 3,
                borderRadius: 2,
                background: i <= step ? "var(--accent)" : "var(--border-2)",
                marginBottom: 5,
                transition: "background 0.2s",
              }} />
              <span style={{
                fontSize: "0.68rem",
                color: i === step ? "var(--accent)" : "var(--faint)",
                fontWeight: i === step ? 600 : 400,
              }}>
                {s}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 28,
          display: "grid",
          gap: 18,
        }}>
          {/* ── Step 0: Profile ─────────────────────────────────────────────── */}
          {step === 0 && (
            <>
              <div>
                <label style={labelStyle}>Your name</label>
                <input value={yourName} onChange={e => setYourName(e.target.value)} placeholder="e.g. Ish" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Profile name</label>
                <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="e.g. Web Dev Services" style={inputStyle} />
                <p style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--faint)" }}>
                  You can have multiple profiles for different services or audiences.
                </p>
              </div>
              <div>
                <label style={labelStyle}>Your company / trading name</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Ish Digital" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>What you do (1–2 sentences)</label>
                <textarea
                  value={companyDescription}
                  onChange={e => setCompanyDescription(e.target.value)}
                  placeholder="e.g. We build websites and automations for small businesses in the UK."
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Target sectors (optional)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SECTORS.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSector(s)}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 20,
                        fontSize: "0.78rem",
                        fontWeight: selectedSectors.includes(s) ? 600 : 400,
                        border: selectedSectors.includes(s) ? "1px solid var(--accent)" : "1px solid var(--border-2)",
                        background: selectedSectors.includes(s) ? "var(--accent-dim)" : "var(--surface-2)",
                        color: selectedSectors.includes(s) ? "var(--accent)" : "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>What you're offering (value proposition)</label>
                <textarea
                  value={valueProposition}
                  onChange={e => setValueProposition(e.target.value)}
                  placeholder="e.g. A modern website that converts visitors into enquiries — built in 2 weeks, fixed price."
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </>
          )}

          {/* ── Step 1: Email style ──────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div>
                <label style={labelStyle}>Email tone</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {(["professional", "conversational", "direct", "consultative"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setEmailTone(t)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "var(--radius-sm)",
                        border: emailTone === t ? "1px solid var(--accent)" : "1px solid var(--border-2)",
                        background: emailTone === t ? "var(--accent-dim)" : "var(--surface-2)",
                        color: emailTone === t ? "var(--accent)" : "var(--muted)",
                        fontWeight: emailTone === t ? 600 : 400,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Default email length</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {([
                    { val: "short", desc: "3–5 sentences" },
                    { val: "medium", desc: "2–3 paragraphs" },
                    { val: "long", desc: "4+ paragraphs" },
                  ] as const).map(({ val, desc }) => (
                    <button
                      key={val}
                      onClick={() => setEmailLength(val)}
                      style={{
                        padding: "12px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: emailLength === val ? "1px solid var(--accent)" : "1px solid var(--border-2)",
                        background: emailLength === val ? "var(--accent-dim)" : "var(--surface-2)",
                        color: emailLength === val ? "var(--accent)" : "var(--muted)",
                        fontWeight: emailLength === val ? 600 : 400,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "block", textTransform: "capitalize", fontWeight: 600 }}>{val}</span>
                      <span style={{ display: "block", fontSize: "0.7rem", color: "var(--faint)", marginTop: 2 }}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Email sending ────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
                Emails are sent via AWS SES. You need a verified sending address before you can send. You can skip this and configure it later in Settings → Email.
              </p>
              <div>
                <label style={labelStyle}>SES verified sending address</label>
                <input
                  type="email"
                  value={sesFromAddress}
                  onChange={e => setSesFromAddress(e.target.value)}
                  placeholder="you@yourdomain.com"
                  style={inputStyle}
                />
              </div>
              <div style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-2)",
                borderRadius: "var(--radius-sm)",
                padding: "14px 16px",
              }}>
                <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
                  To verify an address in SES:
                </p>
                <ol style={{ paddingLeft: 16, fontSize: "0.78rem", color: "var(--faint)", lineHeight: 1.8 }}>
                  <li>Go to AWS Console → SES → Verified identities</li>
                  <li>Click Create identity → Email address</li>
                  <li>Enter your address and click Create</li>
                  <li>Click the verification link AWS sends you</li>
                </ol>
              </div>
            </>
          )}

          {error && (
            <p style={{ fontSize: "0.82rem", color: "var(--status-red)", background: "var(--status-red-dim)", padding: "10px 14px", borderRadius: "var(--radius-sm)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as StepId)}
              style={{
                padding: "10px 18px",
                background: "transparent",
                border: "1px solid var(--border-2)",
                borderRadius: "var(--radius-sm)",
                color: "var(--muted)",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          ) : <div />}

          <button
            onClick={next}
            disabled={!canProceed() || saving}
            style={{
              padding: "10px 22px",
              background: canProceed() ? "var(--accent)" : "var(--surface-3)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: canProceed() ? "#000" : "var(--faint)",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: canProceed() ? "pointer" : "not-allowed",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : step === 2 ? "Finish →" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
