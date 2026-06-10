"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../../components/Shell";
import { db, newId } from "../../../src/db";
import type { Sequence, SequenceStep, EmailMode, EmailLength } from "../../../src/types";

const EMAIL_MODE_LABELS: Record<EmailMode, string> = {
  fully_ai: "Fully AI",
  template_ai_slots: "Template + AI slots",
  campaign_template: "Campaign template",
};

const DEFAULT_STEP_NAMES = [
  "Initial email",
  "Follow-up 1",
  "Follow-up 2",
  "Final follow-up",
  "Check-in",
];

const WAIT_TYPE_LABELS = { calendar: "Calendar days", business: "Business days" };

function StepCard({
  step,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  step: SequenceStep;
  index: number;
  total: number;
  onChange: (updated: SequenceStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);

  const field = (key: keyof SequenceStep, value: unknown) =>
    onChange({ ...step, [key]: value });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--muted)",
    marginBottom: 5,
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    >
      {/* Step header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 16px",
          cursor: "pointer",
          userSelect: "none",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>
            {step.name || `Step ${index + 1}`}
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>
            {index === 0 ? "Send immediately" : `Wait ${step.waitDays} ${step.waitType === "business" ? "business " : ""}day${step.waitDays !== 1 ? "s" : ""}`}
            {" · "}
            {EMAIL_MODE_LABELS[step.emailMode]}
            {step.subjectLine && ` · "${step.subjectLine}"`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="btn btn-ghost btn-sm"
            style={{ padding: "4px 8px" }}
            title="Move up"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="btn btn-ghost btn-sm"
            style={{ padding: "4px 8px" }}
            title="Move down"
          >
            ↓
          </button>
          <button
            onClick={onDelete}
            className="btn btn-ghost btn-sm"
            style={{ padding: "4px 8px", color: "var(--status-red)" }}
            title="Remove step"
          >
            ✕
          </button>
        </div>
        <span style={{ color: "var(--faint)", fontSize: "0.8rem", marginLeft: 4 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Step body */}
      {expanded && (
        <div style={{ padding: "0 16px 20px", borderTop: "1px solid var(--border)", display: "grid", gap: 16 }}>
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Step name</label>
            <input
              value={step.name}
              onChange={e => field("name", e.target.value)}
              placeholder={`Step ${index + 1}`}
              style={{ width: "100%" }}
            />
          </div>

          {index > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Wait days</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={step.waitDays}
                  onChange={e => field("waitDays", Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Wait type</label>
                <select
                  value={step.waitType}
                  onChange={e => field("waitType", e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="calendar">Calendar days</option>
                  <option value="business">Business days</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Email generation mode</label>
            <select
              value={step.emailMode}
              onChange={e => field("emailMode", e.target.value as EmailMode)}
              style={{ width: "100%" }}
            >
              {Object.entries(EMAIL_MODE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Email length</label>
              <select
                value={step.emailLength}
                onChange={e => field("emailLength", e.target.value as EmailLength)}
                style={{ width: "100%" }}
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Subject line template <span style={{ color: "var(--faint)", fontWeight: 400 }}>(tokens: {"{{company_name}}"}, {"{{director_name}}"}, {"{{your_name}}"})</span></label>
            <input
              value={step.subjectLine}
              onChange={e => field("subjectLine", e.target.value)}
              placeholder={index === 0 ? "e.g. Quick question about {{company_name}}" : "e.g. Re: {{company_name}}"}
              style={{ width: "100%" }}
            />
          </div>

          {step.emailMode !== "campaign_template" && (
            <div>
              <label style={labelStyle}>AI prompt override <span style={{ color: "var(--faint)", fontWeight: 400 }}>(optional — leave blank to use profile defaults)</span></label>
              <textarea
                value={step.emailPromptOverride ?? ""}
                onChange={e => field("emailPromptOverride", e.target.value || null)}
                placeholder="e.g. Emphasise our experience with tradespeople. Keep it under 100 words."
                rows={3}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Connector between steps
function StepConnector({ waitDays, waitType }: { waitDays: number; waitType: "calendar" | "business" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, padding: "0 0" }}>
      <div style={{ width: 1, height: 12, background: "var(--border-2)" }} />
      <div
        style={{
          padding: "4px 12px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          fontSize: "0.7rem",
          color: "var(--muted)",
          fontWeight: 600,
        }}
      >
        wait {waitDays}d {waitType === "business" ? "(biz)" : ""}
      </div>
      <div style={{ width: 1, height: 12, background: "var(--border-2)" }} />
    </div>
  );
}

export default function SequenceBuilder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    db.sequences.get(id).then(seq => {
      if (seq) {
        setSequence(seq);
        setSteps(seq.steps);
        setName(seq.name);
      }
      setLoading(false);
    });
  }, [id]);

  const addStep = () => {
    const stepNumber = steps.length + 1;
    const newStep: SequenceStep = {
      id: newId(),
      stepNumber,
      name: DEFAULT_STEP_NAMES[steps.length] ?? `Step ${stepNumber}`,
      waitDays: 3,
      waitType: "calendar",
      emailMode: "fully_ai",
      emailLength: "medium",
      templateId: null,
      subjectLine: "",
      emailPromptOverride: null,
    };
    setSteps(prev => [...prev, newStep]);
  };

  const updateStep = (index: number, updated: SequenceStep) => {
    setSteps(prev => prev.map((s, i) => (i === index ? updated : s)));
  };

  const deleteStep = (index: number) => {
    setSteps(prev =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, stepNumber: i + 1 }))
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const newSteps = [...steps];
    const target = index + direction;
    if (target < 0 || target >= newSteps.length) return;
    [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  const save = async () => {
    if (!sequence) return;
    setSaving(true);
    const updated: Sequence = {
      ...sequence,
      name,
      steps: steps.map((s, i) => ({ ...s, stepNumber: i + 1 })),
      updatedAt: new Date().toISOString(),
    };
    await db.sequences.put(updated);
    setSequence(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalDuration = steps.slice(1).reduce((sum, s) => sum + s.waitDays, 0);

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
          <div className="spinner" />
        </div>
      </Shell>
    );
  }

  if (!sequence) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: 64 }}>
          <p style={{ color: "var(--muted)" }}>Sequence not found.</p>
          <button onClick={() => router.push("/sequences")} className="btn btn-ghost" style={{ marginTop: 12 }}>
            ← Back to sequences
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 600 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <button
              onClick={() => router.push("/sequences")}
              className="btn btn-ghost btn-sm"
              style={{ marginBottom: 12 }}
            >
              ← Sequences
            </button>

            {editingName ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                autoFocus
                style={{ fontSize: "1.4rem", fontWeight: 700, background: "transparent", border: "none", borderBottom: "2px solid var(--accent)", color: "var(--text)", width: "100%", padding: "0 0 4px", outline: "none" }}
              />
            ) : (
              <h1
                onClick={() => setEditingName(true)}
                style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", cursor: "pointer", marginBottom: 4 }}
                title="Click to rename"
              >
                {name} <span style={{ fontSize: "0.8rem", color: "var(--faint)" }}>✎</span>
              </h1>
            )}

            <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
              {steps.length} step{steps.length !== 1 ? "s" : ""}
              {steps.length > 1 && ` · ${totalDuration} day${totalDuration !== 1 ? "s" : ""} total`}
            </p>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="btn btn-primary"
          >
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save sequence"}
          </button>
        </div>

        {/* Steps */}
        {steps.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: 16 }}>
              No steps yet. Add your first step to get started.
            </p>
            <button onClick={addStep} className="btn btn-primary">
              Add first step
            </button>
          </div>
        ) : (
          <div>
            {steps.map((step, i) => (
              <div key={step.id}>
                <StepCard
                  step={step}
                  index={i}
                  total={steps.length}
                  onChange={updated => updateStep(i, updated)}
                  onDelete={() => deleteStep(i)}
                  onMoveUp={() => moveStep(i, -1)}
                  onMoveDown={() => moveStep(i, 1)}
                />
                {i < steps.length - 1 && (
                  <StepConnector
                    waitDays={steps[i + 1].waitDays}
                    waitType={steps[i + 1].waitType}
                  />
                )}
              </div>
            ))}

            {/* Add step */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 8 }}>
              <div style={{ width: 1, height: 12, background: "var(--border-2)" }} />
              <button onClick={addStep} className="btn btn-ghost" style={{ borderStyle: "dashed" }}>
                + Add step
              </button>
            </div>
          </div>
        )}

        {/* Footer save hint */}
        {steps.length > 0 && (
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={save} disabled={saving} className="btn btn-primary">
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save sequence"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
