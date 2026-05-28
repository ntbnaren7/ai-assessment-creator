import { logger } from "../../../utils/logger.js";
import { GeneratedPaperSchema, type GeneratedPaperOutput, type GeneratedQuestionSchema } from "../../../utils/validation.js";
import { evaluateQuality, type QualityReport } from "./quality-evaluator.js";
import type { z } from "zod";

/**
 * Aggregates chunk results into a single validated paper output.
 * Handles: section merging, question renumbering, structural validation,
 * keyword-overlap dedup (heuristic), and quality evaluation.
 */

// ── Types ──

type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export interface ChunkResult {
  chunkId: string;
  sections: any[];     // raw sections from LLM output
  modelUsed: string;
  provider: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  retryCount: number;
}

export interface AggregatedResult {
  paper: GeneratedPaperOutput;
  qualityReport: QualityReport;
}

// ── Aggregator ──

/**
 * Aggregate multiple chunk results into a single paper.
 */
export function aggregateChunks(
  chunks: ChunkResult[],
  paperMetadata: {
    title: string;
    subject: string;
    totalMarks: number;
    duration: string;
  }
): AggregatedResult {
  logger.info("Aggregating chunks", { chunkCount: chunks.length });

  // ── 1. Merge all sections ──
  const allSections: any[] = [];
  for (const chunk of chunks) {
    for (const section of chunk.sections) {
      allSections.push(section);
    }
  }

  // ── 2. Sequential question renumbering ──
  let questionCounter = 1;
  for (const section of allSections) {
    for (const question of section.questions || []) {
      question.questionNumber = questionCounter++;
    }
  }

  // ── 3. Keyword-overlap dedup (heuristic — ADR-2) ──
  const duplicatePairs = findKeywordDuplicates(allSections);
  if (duplicatePairs.length > 0) {
    logger.warn("Potential duplicate questions detected", {
      count: duplicatePairs.length,
      pairs: duplicatePairs.slice(0, 5), // log first 5
    });
  }

  // ── 4. Build general instructions ──
  const generalInstructions = buildGeneralInstructions(allSections, paperMetadata);

  // ── 5. Assemble paper ──
  const paper: GeneratedPaperOutput = {
    title: paperMetadata.title,
    subject: paperMetadata.subject,
    totalMarks: paperMetadata.totalMarks,
    duration: paperMetadata.duration,
    generalInstructions,
    sections: allSections,
  };

  // ── 6. Validate with Zod ──
  const validation = GeneratedPaperSchema.safeParse(paper);
  if (!validation.success) {
    const issues = validation.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    logger.error("Aggregated paper failed Zod validation", { issues });
    // Still return it — quality evaluator will flag issues
  }

  // ── 7. Quality evaluation ──
  const qualityReport = evaluateQuality(allSections);

  if (!qualityReport.passed) {
    logger.warn("Quality evaluation flagged issues", {
      warningCount: qualityReport.warningCount,
      warnings: qualityReport.warnings.map((w) => w.message).slice(0, 5),
    });
  }

  return {
    paper: validation.success ? validation.data : paper,
    qualityReport,
  };
}

/**
 * Aggregate a single-chunk result (papers with only one question type).
 */
export function aggregateSingleChunk(
  chunkResult: ChunkResult,
  parsedPaper: GeneratedPaperOutput
): AggregatedResult {
  const qualityReport = evaluateQuality(parsedPaper.sections);
  return { paper: parsedPaper, qualityReport };
}

// ── Helpers ──

/**
 * Keyword-overlap duplicate detection.
 * Flags question pairs with >80% shared significant words.
 * 
 * Known limitation (ADR-2): Misses conceptual duplicates with different wording.
 */
function findKeywordDuplicates(sections: any[]): string[] {
  const allQuestions: { qNum: number; keywords: Set<string> }[] = [];
  const STOPWORDS = new Set([
    "the", "is", "in", "of", "to", "and", "a", "an", "for", "on", "at", "by",
    "with", "from", "that", "which", "this", "are", "was", "were", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "what", "how", "when",
    "where", "why", "who", "whom", "following", "given", "find", "calculate",
  ]);

  // Build keyword sets
  for (const section of sections) {
    for (const q of section.questions || []) {
      const text = (q.questionText || "").toLowerCase();
      const words = text.split(/\W+/).filter(
        (w: string) => w.length > 3 && !STOPWORDS.has(w)
      );
      allQuestions.push({ qNum: q.questionNumber, keywords: new Set(words) });
    }
  }

  // Compare pairs
  const duplicates: string[] = [];
  for (let i = 0; i < allQuestions.length; i++) {
    for (let j = i + 1; j < allQuestions.length; j++) {
      const a = allQuestions[i];
      const b = allQuestions[j];
      if (a.keywords.size === 0 || b.keywords.size === 0) continue;

      const intersection = [...a.keywords].filter((w) => b.keywords.has(w));
      const unionSize = new Set([...a.keywords, ...b.keywords]).size;
      const overlap = intersection.length / unionSize;

      if (overlap > 0.8) {
        duplicates.push(`Q${a.qNum} ↔ Q${b.qNum} (${Math.round(overlap * 100)}% overlap)`);
      }
    }
  }

  return duplicates;
}

/**
 * Build general instructions from aggregated sections.
 */
function buildGeneralInstructions(sections: any[], meta: { totalMarks: number; duration: string }): string[] {
  const instructions: string[] = [
    `Total marks: ${meta.totalMarks}`,
    `Duration: ${meta.duration}`,
    `This paper consists of ${sections.length} section(s).`,
    `Read each question carefully before answering.`,
    `All questions are compulsory unless stated otherwise in section instructions.`,
  ];
  return instructions;
}
