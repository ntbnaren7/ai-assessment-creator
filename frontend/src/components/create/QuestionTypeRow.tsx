"use client";

import { Counter } from "./Counter";

export interface QuestionTypeConfig {
  id: string;
  type: string;
  numberOfQuestions: number;
  marks: number;
}

const AVAILABLE_TYPES = [
  "Multiple Choice Questions",
  "Short Questions",
  "Long Questions",
  "Diagram/Graph-Based Questions",
  "Numerical Problems",
  "True/False",
  "Fill in the Blanks",
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
    <div className="question-type-row">
      {/* Type Select */}
      <select
        className="form-select"
        value={config.type}
        onChange={(e) => onChange({ ...config, type: e.target.value })}
      >
        {AVAILABLE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
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
  );
}
