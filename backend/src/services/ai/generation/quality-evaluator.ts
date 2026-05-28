import { logger } from "../../../utils/logger.js";

/**
 * Lightweight quality evaluator.
 * v1: 3 checks only. Non-blocking — produces warnings, never rejects.
 * See ADR-3.
 */

// ── Types ──

export interface QualityWarning {
  check: string;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface QualityReport {
  passed: boolean;
  warningCount: number;
  warnings: QualityWarning[];
}

// ── Constants ──

const MAX_WARNINGS = 50;
const WARNING_THRESHOLD = 5;  // > 5 warnings = not passed (but still delivered)

// ── Evaluator ──

/**
 * Evaluate the quality of a generated paper.
 * Non-blocking: produces warnings but never rejects the paper.
 */
export function evaluateQuality(sections: any[]): QualityReport {
  const warnings: QualityWarning[] = [];

  // Collect all questions across sections
  const allQuestions = sections.flatMap((s: any) => s.questions || []);

  if (allQuestions.length === 0) {
    warnings.push({
      check: "empty-paper",
      message: "No questions found in generated paper",
      severity: "high",
    });
    return {
      passed: false,
      warningCount: warnings.length,
      warnings: warnings.slice(0, MAX_WARNINGS),
    };
  }

  // ── Check 1: Answer Distribution ──
  checkAnswerDistribution(allQuestions, warnings);

  // ── Check 2: Difficulty Curve ──
  checkDifficultyCurve(sections, warnings);

  // ── Check 3: Question Length Outliers ──
  checkQuestionLengthOutliers(sections, warnings);

  // Cap warnings
  const cappedWarnings = warnings.slice(0, MAX_WARNINGS).map((w) => ({
    ...w,
    message: w.message.substring(0, 200),  // cap message length
  }));

  return {
    passed: cappedWarnings.length <= WARNING_THRESHOLD,
    warningCount: cappedWarnings.length,
    warnings: cappedWarnings,
  };
}

// ── Individual Checks ──

/**
 * Check 1: MCQ correct-answer letter distribution.
 * Flags if any single letter accounts for >40% of MCQ answers.
 */
function checkAnswerDistribution(questions: any[], warnings: QualityWarning[]): void {
  const mcqs = questions.filter((q: any) =>
    q.questionType === "MCQ" && q.correctAnswer
  );

  if (mcqs.length < 4) return; // not enough MCQs to check

  const letterCounts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };

  for (const q of mcqs) {
    const answer = (q.correctAnswer || "").toLowerCase().trim();
    // Extract letter: "(a)", "(b)", "a)", "option a", etc.
    const match = answer.match(/^[(\s]*([a-d])[)\s.]/);
    if (match) {
      letterCounts[match[1]]++;
    }
  }

  const total = Object.values(letterCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return;

  for (const [letter, count] of Object.entries(letterCounts)) {
    const pct = Math.round((count / total) * 100);
    if (pct > 40) {
      warnings.push({
        check: "answer-distribution",
        message: `${pct}% of MCQ answers are option (${letter}). Expected ~25% per option.`,
        severity: "medium",
      });
    }
  }
}

/**
 * Check 2: Difficulty curve — flags if hard questions appear before moderate ones.
 */
function checkDifficultyCurve(sections: any[], warnings: QualityWarning[]): void {
  const difficultyOrder: Record<string, number> = {
    "Easy": 1,
    "Moderate": 2,
    "Hard": 3,
  };

  for (const section of sections) {
    const questions = section.questions || [];
    if (questions.length < 3) continue;

    let inversions = 0;
    for (let i = 1; i < questions.length; i++) {
      const prevDiff = difficultyOrder[questions[i - 1]?.difficulty] || 2;
      const currDiff = difficultyOrder[questions[i]?.difficulty] || 2;
      if (currDiff < prevDiff) inversions++;
    }

    const inversionRate = inversions / (questions.length - 1);
    if (inversionRate > 0.5) {
      warnings.push({
        check: "difficulty-curve",
        message: `Difficulty is inverted in "${section.sectionTitle || section.sectionLabel}" (${Math.round(inversionRate * 100)}% reverse-ordered).`,
        severity: "low",
      });
    }
  }
}

/**
 * Check 3: Question length outliers — flags abnormally short or long questions.
 */
function checkQuestionLengthOutliers(sections: any[], warnings: QualityWarning[]): void {
  for (const section of sections) {
    const questions = section.questions || [];
    if (questions.length < 3) continue;

    const lengths = questions.map((q: any) => (q.questionText || "").length);
    const avgLength = lengths.reduce((a: number, b: number) => a + b, 0) / lengths.length;

    for (let i = 0; i < questions.length; i++) {
      const len = lengths[i];
      const qNum = questions[i]?.questionNumber || i + 1;

      // Flag questions shorter than 30% of average or longer than 300% of average
      if (avgLength > 20 && len < avgLength * 0.3) {
        warnings.push({
          check: "question-length",
          message: `Q${qNum} is unusually short (${len} chars vs ${Math.round(avgLength)} avg in section).`,
          severity: "low",
        });
      } else if (avgLength > 20 && len > avgLength * 3) {
        warnings.push({
          check: "question-length",
          message: `Q${qNum} is unusually long (${len} chars vs ${Math.round(avgLength)} avg in section).`,
          severity: "low",
        });
      }
    }
  }
}
