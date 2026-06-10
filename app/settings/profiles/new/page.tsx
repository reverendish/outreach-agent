"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../../../components/Shell";
import { db, getSettings, saveSettings, newId } from "../../../../src/db";
import type { Profile } from "../../../../src/types";

const SECTORS = [
  "Construction", "Hospitality", "Retail", "Manufacturing", "Professional Services",
  "Healthcare", "Education", "Technology", "Finance", "Recruitment",
  "Marketing & Media", "Property", "Transport & Logistics", "Food & Beverage", "Other",
];

export default function NewProfile() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [profileName, setProfileName] = useState("");
  const [yourName, setYourName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [valueProposition, setValueProposition] = useState("");
  const [emailTone, setEmailTone] = useState<Profile["emailTone"]>("conversational");
  const [emailLength, setEmailLength] = useState<Profile["emailLength"]>("medium");

  const toggleSector = (s: string) =>
    setSelectedSectors((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const canSave = profileName && yourName && companyName && companyDescription && valueProposition;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const id = newId();
      const profile: Profile = {
        id,
        name: profileName.trim(),
        yourName: yourName.trim(),
        companyName: companyName.trim(),
        companyDescription: companyDescription.trim(),
        targetSectors: selectedSectors,
        valueProposition: valueProposition.trim(),
        emailTone,
        emailLength,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.profiles.add(profile);
      // Switch to new profile
      saveSettings({ activeProfileId: id });
      router.push("/settings/profiles");
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
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
    <Shell>
      <div style={{ maxWidth: 540 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>New profile</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            Profiles keep company context, email style, and style memory separate.
          </p>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, display: "grid", gap: 16 }}>
            <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>Profile details</h2>
            <div>
              <label style={labelStyle}>Profile name</label>
              <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="e.g. Web Dev Services" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Your name</label>
              <input value={yourName} onChange={e => setYourName(e.target.value)} placeholder="e.g. Ish" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Company / trading name</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Ish Digital" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>What you do (1–2 sentences)</label>
              <textarea value={companyDescription} onChange={e => setCompanyDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Value proposition</label>
              <textarea value={valueProposition} onChange={e => setValueProposition(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Target sectors</label>
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
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, display: "grid", gap: 16 }}>
            <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>Email style</h2>
            <div>
              <label style={labelStyle}>Tone</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["professional", "conversational", "direct", "consultative"] as const).map((t) => (
                  <button key={t} onClick={() => setEmailTone(t)} style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: emailTone === t ? "1px solid var(--accent)" : "1px solid var(--border-2)",
                    background: emailTone === t ? "var(--accent-dim)" : "var(--surface-2)",
                    color: emailTone === t ? "var(--accent)" : "var(--muted)",
                    fontWeight: emailTone === t ? 600 : 400,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Default length</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {([
                  { val: "short", desc: "3–5 sentences" },
                  { val: "medium", desc: "2–3 paragraphs" },
                  { val: "long", desc: "4+ paragraphs" },
                ] as const).map(({ val, desc }) => (
                  <button key={val} onClick={() => setEmailLength(val)} style={{
                    padding: "10px",
                    borderRadius: "var(--radius-sm)",
                    border: emailLength === val ? "1px solid var(--accent)" : "1px solid var(--border-2)",
                    background: emailLength === val ? "var(--accent-dim)" : "var(--surface-2)",
                    color: emailLength === val ? "var(--accent)" : "var(--muted)",
                    fontWeight: emailLength === val ? 600 : 400,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}>
                    <span style={{ display: "block", textTransform: "capitalize", fontWeight: 600 }}>{val}</span>
                    <span style={{ display: "block", fontSize: "0.68rem", color: "var(--faint)", marginTop: 2 }}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p style={{ fontSize: "0.82rem", color: "var(--status-red)", background: "var(--status-red-dim)", padding: "10px 14px", borderRadius: "var(--radius-sm)" }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => router.back()} className="btn btn-ghost">Cancel</button>
            <button onClick={save} disabled={!canSave || saving} className="btn btn-primary">
              {saving ? "Saving…" : "Create profile"}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
