import { useMemo, useState } from "react";
import {
  ONBOARDING_STEPS,
  TOTAL_QUESTIONS,
  profileAnsweredCount,
  type ProfileField,
  type UserProfile,
} from "@/lib/cortex/profile";

function Field({
  field,
  value,
  onChange,
}: {
  field: ProfileField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="ob-field">
      <span className="ob-label">{field.label}</span>
      {field.type === "textarea" ? (
        <textarea
          className="ob-input"
          rows={3}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="ob-input"
          type={field.type === "url" ? "url" : "text"}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

export function Onboarding({
  initial,
  onComplete,
  onSkip,
}: {
  initial: UserProfile;
  onComplete: (profile: UserProfile) => void;
  onSkip: (profile: UserProfile) => void;
}) {
  const [answers, setAnswers] = useState<UserProfile>(initial);
  const [step, setStep] = useState(0);
  const total = ONBOARDING_STEPS.length;
  const current = ONBOARDING_STEPS[step]!;
  const answered = useMemo(() => profileAnsweredCount(answers), [answers]);
  const set = (key: string, v: string) =>
    setAnswers((a) => ({ ...a, [key]: v }));
  const last = step === total - 1;
  const pct = Math.round(((step + 1) / total) * 100);

  return (
    <div className="ob-scrim">
      <div className="ob-card">
        <div className="ob-top">
          <div className="ob-meta">
            <span>
              Step {step + 1} of {total}
            </span>
            <span>
              {answered}/{TOTAL_QUESTIONS} answered
            </span>
          </div>
          <div className="ob-track">
            <span style={{ width: pct + "%" }} />
          </div>
        </div>

        <div className="ob-body">
          <h2 className="ob-title">{current.title}</h2>
          <p className="ob-blurb">{current.blurb}</p>
          <div className="ob-fields">
            {current.fields.map((f) => (
              <Field
                key={f.key}
                field={f}
                value={answers[f.key] ?? ""}
                onChange={(v) => set(f.key, v)}
              />
            ))}
          </div>
        </div>

        <div className="ob-foot">
          {step > 0 ? (
            <button className="ob-back" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          <div className="ob-foot-r">
            <button className="ob-skip" onClick={() => onSkip(answers)}>
              {last ? "Skip for now" : "Skip for now"}
            </button>
            {last ? (
              <button className="ob-next" onClick={() => onComplete(answers)}>
                Finish
                <svg viewBox="0 0 24 24">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </button>
            ) : (
              <button className="ob-next" onClick={() => setStep((s) => s + 1)}>
                Next
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
