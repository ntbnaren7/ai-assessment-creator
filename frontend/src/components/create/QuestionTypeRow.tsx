"use client";

import { Counter } from "./Counter";

export interface QuestionTypeConfig {
  id: string;
  type: string;
  numberOfQuestions: number;
  marks: number;
}

const AVAILABLE_TYPES = [
  { value: "Multiple Choice Questions", label: "Multiple Choice Questions" },
  { value: "Short Answer Questions", label: "Short Answer Questions" },
  { value: "Long Answer Questions", label: "Long Answer Questions" },
  { value: "Diagram/Graph-Based Questions", label: "Diagram/Graph-Based Questions" },
  { value: "Numerical Problems", label: "Numerical Problems" },
];

interface QuestionTypeRowProps {
  config: QuestionTypeConfig;
  onChange: (updated: QuestionTypeConfig) => void;
  onRemove: () => void;
  /** Max questions this row can reach (current value + global remaining) */
  maxQuestionsForRow?: number;
  /** Max marks-per-question this row can reach */
  maxMarksForRow?: number;
}

/**
 * A single dynamic row in the question type builder table.
 * Contains: dropdown select + remove button + questions counter + marks counter.
 */
export function QuestionTypeRow({
  config,
  onChange,
  onRemove,
  maxQuestionsForRow,
  maxMarksForRow,
}: QuestionTypeRowProps) {
  return (
    <div className="question-type-row-container">
      {/* 1. Mobile Premium Card Layout (visible only on mobile) */}
      <div className="question-type-mobile-card show-on-mobile-flex">
        <div className="card-top-row">
          <div className="form-select-mobile-wrapper">
            <span className="selected-value-text">
              {AVAILABLE_TYPES.find((t) => t.value === config.type)?.label || config.type}
            </span>
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
          </div>
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
              dynamicMax={maxQuestionsForRow}
              onChange={(v) => onChange({ ...config, numberOfQuestions: v })}
            />
          </div>
          <div className="counter-column">
            <span className="counter-label">Marks</span>
            <Counter
              value={config.marks}
              min={1}
              max={20}
              dynamicMax={maxMarksForRow}
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
          dynamicMax={maxQuestionsForRow}
          onChange={(v) => onChange({ ...config, numberOfQuestions: v })}
        />

        {/* Marks Counter */}
        <Counter
          value={config.marks}
          min={1}
          max={20}
          dynamicMax={maxMarksForRow}
          onChange={(v) => onChange({ ...config, marks: v })}
        />
      </div>
    </div>
  );
}
