import type { ChunkContext } from "../prompts/prompt.strategy.js";

/**
 * Difficulty-Aware Token Estimator
 * 
 * Computes realistic completion token budgets based on:
 *  - Grade band (Primary 1-5, Middle 6-8, Secondary 9-10, Senior 11-12)
 *  - Question type (MCQ, Short Answer, Long Answer, Numerical, etc.)
 *  - Question count
 * 
 * Replaces the old static estimator that returned ~2100 tokens for
 * Grade 1 MCQs — a 3-4x overestimate that caused unnecessary TPM exhaustion.
 * 
 * These values are empirically derived from actual Groq/OpenRouter outputs
 * across benchmark runs. Each value represents tokens-per-question.
 */

type GradeBand = "primary" | "middle" | "secondary" | "senior";

/**
 * Tokens per question, indexed by [GradeBand][QuestionType].
 * Covers the JSON output structure (field names, values, punctuation).
 */
const TOKENS_PER_QUESTION: Record<GradeBand, Record<string, number>> = {
  // Grade 1-5: Simple vocabulary, short sentences, 1-word answers
  primary: {
    "Multiple Choice Questions": 50,
    "Short Answer Questions": 70,
    "Long Answer Questions": 120,
    "Numerical Problems": 60,
    "Diagram/Graph-Based Questions": 80,
    "Case Study Questions": 130,
  },
  // Grade 6-8: Real-world scenarios, moderate complexity
  middle: {
    "Multiple Choice Questions": 65,
    "Short Answer Questions": 100,
    "Long Answer Questions": 180,
    "Numerical Problems": 90,
    "Diagram/Graph-Based Questions": 100,
    "Case Study Questions": 200,
  },
  // Grade 9-10: Board-exam style, multi-step reasoning
  secondary: {
    "Multiple Choice Questions": 75,
    "Short Answer Questions": 130,
    "Long Answer Questions": 250,
    "Numerical Problems": 120,
    "Diagram/Graph-Based Questions": 120,
    "Case Study Questions": 280,
  },
  // Grade 11-12: Derivations, analytical reasoning, advanced
  senior: {
    "Multiple Choice Questions": 90,
    "Short Answer Questions": 180,
    "Long Answer Questions": 350,
    "Numerical Problems": 160,
    "Diagram/Graph-Based Questions": 150,
    "Case Study Questions": 380,
  },
};

/**
 * Overhead tokens per chunk for JSON structure (section wrapper, labels, etc.)
 */
const CHUNK_OVERHEAD: Record<GradeBand, number> = {
  primary: 80,
  middle: 100,
  secondary: 120,
  senior: 150,
};

/**
 * Resolve a grade number (1-12) to a grade band.
 */
function resolveGradeBand(gradeNum: number | null): GradeBand {
  if (!gradeNum || gradeNum <= 5) return "primary";
  if (gradeNum <= 8) return "middle";
  if (gradeNum <= 10) return "secondary";
  return "senior";
}

/**
 * Extract grade number from a grade string like "Grade 5" or "5".
 */
function extractGradeNum(grade: string): number | null {
  const match = grade.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Estimates completion tokens for a single chunk.
 * 
 * @param grade - The grade string (e.g., "Grade 1", "Grade 12")
 * @param questionType - The question type string
 * @param questionCount - Number of questions in the chunk
 * @returns Estimated completion tokens
 */
export function estimateChunkCompletionTokens(
  grade: string,
  questionType: string,
  questionCount: number,
): number {
  const gradeNum = extractGradeNum(grade);
  const band = resolveGradeBand(gradeNum);

  const perQuestion = TOKENS_PER_QUESTION[band][questionType] ?? 100;
  const overhead = CHUNK_OVERHEAD[band];

  return (perQuestion * questionCount) + overhead;
}

/**
 * Estimates completion tokens for an entire paper (all question types combined).
 * Used when chunking is not available (single-chunk fallback).
 * 
 * @param grade - The grade string
 * @param questionTypeDetails - Array of { type, numberOfQuestions }
 * @param totalQuestions - Fallback total question count
 * @returns Estimated completion tokens
 */
export function estimatePaperCompletionTokens(
  grade: string,
  questionTypeDetails?: { type: string; numberOfQuestions: number }[],
  totalQuestions?: number,
): number {
  const gradeNum = extractGradeNum(grade);
  const band = resolveGradeBand(gradeNum);

  if (questionTypeDetails && questionTypeDetails.length > 0) {
    const questionTokens = questionTypeDetails.reduce((sum, d) => {
      const perQ = TOKENS_PER_QUESTION[band][d.type] ?? 100;
      return sum + (d.numberOfQuestions * perQ);
    }, 0);
    return questionTokens + 200; // +200 for paper-level metadata (title, instructions, etc.)
  }

  // Rough fallback: use a middle-of-the-road estimate
  const fallbackPerQ = TOKENS_PER_QUESTION[band]["Multiple Choice Questions"] ?? 70;
  return ((totalQuestions || 20) * fallbackPerQ) + 200;
}
