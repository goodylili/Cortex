"use client";

import "./FeaturesDemo.css";

const STAGES: { id: string; label: string; sub: string }[] = [
  { id: "source", label: "Source", sub: "note · file · url" },
  { id: "extraction", label: "Extraction", sub: "model reads source" },
  { id: "memory", label: "Memory", sub: "durable · tagged" },
  { id: "recall", label: "Recall", sub: "context back out" },
];

export function FeaturesDemo(): React.JSX.Element {
  return (
    <div
      className="fd-pipeline"
      role="img"
      aria-label="Cortex pipeline: source, extraction, memory, recall"
    >
      {STAGES.map((stage, i) => (
        <div className="fd-pipeline__row" key={stage.id}>
          <div className="fd-pipeline__node">
            <span className="fd-pipeline__label">{stage.label}</span>
            <span className="fd-pipeline__sub">{stage.sub}</span>
          </div>
          {i < STAGES.length - 1 && (
            <span className="fd-pipeline__arrow" aria-hidden="true">
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
