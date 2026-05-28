"use client";

import { Counter } from "./Counter";

export interface QuestionTypeConfig {
  id: string;
  type: string;
  numberOfQuestions: number;
  marks: number;
}

const AVAILABLE_TYPES = [
  { value: "MCQ", label: "Multiple Choice Questions (MCQ)" },
  { value: "Short Answer", label: "Short Answer" },
  { value: "Long Answer", label: "Long Answer" },
  { value: "True/False", label: "True / False" },
  { value: "Fill in the Blanks", label: "Fill in the Blanks" },
];

interface QuestionTypeRowProps {
  config: QuestionTypeConfig;
  onChange: (updated: QuestionTypeConfig) => void;
  onRemove: () => void;
}

/**
 * A single dynamic row in the question type builder table.
 * Contains: dropdown select + remove button + questions counter + marks counter.
 */
export function QuestionTypeRow({
  config,
  onChange,
  onRemove,
}: QuestionTypeRowProps) {
  return (
    <div className="question-type-row-container">
      {/* 1. Mobile Premium Card Layout (visible only on mobile) */}
      <div className="question-type-mobile-card show-on-mobile-flex">
        <div className="card-top-row">
          <select
            className="form-select-mobile"
            value={config.type}
            onChange={(e) => onChange({ ...config, type: e.target.value })}
          >
            {AVAILABLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            className="question-type-remove-mobile"
            type="button"
            onClick={onRemove}
            aria-label="Remove question type"
          >
            ✕
          </button>
        </div>

        <div className="card-counters-box">
          <div className="counter-column">
            <span className="counter-label">No. of Questions</span>
            <Counter
              value={config.numberOfQuestions}
              min={1}
              max={50}
              onChange={(v) => onChange({ ...config, numberOfQuestions: v })}
            />
          </div>
          <div className="counter-column">
            <span className="counter-label">Marks</span>
            <Counter
              value={config.marks}
              min={1}
              max={20}
              onChange={(v) => onChange({ ...config, marks: v })}
            />
          </div>
        </div>
      </div>

      {/* 2. Desktop Row Layout (visible only on desktop) */}
      <div className="question-type-row hide-on-mobile">
        {/* Type Select */}
        <select
          className="form-select"
          value={config.type}
          onChange={(e) => onChange({ ...config, type: e.target.value })}
        >
          {AVAILABLE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        
        {/* Remove Button */}
        <button
          className="question-type-remove"
          type="button"
          onClick={onRemove}
          aria-label="Remove question type"
        >
          ✕
        </button>

        {/* No. of Questions Counter */}
        <Counter
          value={config.numberOfQuestions}
          min={1}
          max={50}
          onChange={(v) => onChange({ ...config, numberOfQuestions: v })}
        />

        {/* Marks Counter */}
        <Counter
          value={config.marks}
          min={1}
          max={20}
          onChange={(v) => onChange({ ...config, marks: v })}
        />
      </div>
    </div>
  );
}
