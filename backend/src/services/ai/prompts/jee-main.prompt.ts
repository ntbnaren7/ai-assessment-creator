import type { IAssignment } from "../../../models/index.js";
import { ModelTier } from "../models/model-registry.js";
import type { PromptStrategy, ChunkContext } from "./prompt.strategy.js";
import {
  buildSpecsBlock,
  buildFileContentBlock,
  buildOutputSchemaRules,
  buildConceptAvoidanceBlock,
  buildAdditionalInstructionsBlock,
} from "./prompt.utils.js";

/**
 * JEE Main prompt strategy.
 * Emulates NTA JEE Main paper setting with time-pressure design,
 * clean numericals, and concept-blend questions.
 */
export class JeeMainPromptStrategy implements PromptStrategy {
  readonly strategyId = "jee-main-v1";
  readonly promptVersion = "1.0.0";

  buildSystemPrompt(assignment: IAssignment, chunkContext?: ChunkContext): string {
    const isChunked = !!chunkContext;

    const parts: string[] = [
      this.buildPersona(),
      "",
    ];

    if (isChunked) {
      parts.push(this.buildChunkSpecs(chunkContext!));
    } else {
      parts.push(buildSpecsBlock(assignment));
    }

    parts.push(
      "",
      this.buildJeeMainRules(),
      "",
      this.buildConceptBlendGuidelines(),
      "",
      this.buildDistractorRules(),
      "",
      this.buildDifficultyGuidelines(),
      "",
      this.buildAntiPatterns(),
      "",
      buildOutputSchemaRules(),
    );

    const fileContent = buildFileContentBlock(assignment);
    if (fileContent) parts.push("", fileContent);

    const additional = buildAdditionalInstructionsBlock(assignment);
    if (additional) parts.push("", additional);

    if (chunkContext) {
      const avoidance = buildConceptAvoidanceBlock(chunkContext.avoidanceConcepts);
      if (avoidance) parts.push("", avoidance);
    }

    return parts.filter((p) => p !== undefined).join("\n");
  }

  getTemperature(): number {
    return 0.55;
  }

  getMinimumTier(): ModelTier {
    return ModelTier.TIER_1;
  }

  getPreferredModel(): string | null {
    return "llama-3.3-70b-versatile";
  }

  getMaxOutputTokens(): number {
    return 16384;
  }

  // ── Private helpers ──

  private buildPersona(): string {
    return `You are a JEE Main paper architect from the NTA examination design committee. You have designed papers for 10+ years and deeply understand:

- The precise balance between speed and accuracy that JEE Main demands
- How to create questions that reward conceptual clarity over rote formula application
- The art of designing numerically close MCQ options that catch common calculation errors
- Time-pressure design: each question should be solvable in 2-3 minutes by a prepared student

Your questions are indistinguishable from real NTA JEE Main papers.`;
  }

  private buildChunkSpecs(chunk: ChunkContext): string {
    return `CHUNK SPECIFICATIONS:
- Subject: ${chunk.subject}
- Section: ${chunk.sectionLabel}
- Number of Questions: ${chunk.questionCount}
- Question Type: ${chunk.questionType}
- Marks per Question: ${chunk.marksPerQuestion}
- Negative Marking: ${chunk.negativeMarking}
- Attempt Rule: ${chunk.attemptRule}

Generate EXACTLY ${chunk.questionCount} questions for this section.`;
  }

  private buildJeeMainRules(): string {
    return `JEE MAIN PAPER RULES:
1. Section A: 20 MCQs with 4 options each. +4 correct, -1 incorrect. Attempt all.
2. Section B: 5 Numerical Answer questions (integer answer, no options). +4 correct, 0 incorrect. Attempt all.
3. ALL numerical answers must be clean integers (no decimals, no fractions).
4. Time per question: 2-3 minutes average.
5. Every question must be solvable using Class 11-12 NCERT + standard JEE syllabus.
6. For Numerical Answer questions: the correctAnswer field should contain ONLY the integer value (e.g., "42").`;
  }

  private buildConceptBlendGuidelines(): string {
    return `CONCEPT BLEND DISTRIBUTION:
- 40% DIRECT: Single concept, direct formula application, 1-step calculation
- 30% CONCEPT + CALCULATION: Requires identifying the right concept, then clean calculation
- 20% MULTI-STEP: Requires 2-3 sequential concepts or calculations, intermediate results
- 10% UNCONVENTIONAL: Non-standard approach required, tests deep understanding, creative problem-solving`;
  }

  private buildDistractorRules(): string {
    return `MCQ DISTRACTOR RULES (Section A):
- Options must be NUMERICALLY CLOSE (e.g., 2, 3, 4, 6 — NOT 2, 50, 1000)
- Each distractor must result from a SPECIFIC wrong approach:
  * Forgot a factor (÷2, ×2, missing π)
  * Wrong formula applied
  * Sign error
  * Unit conversion mistake
- Correct answer position: RANDOMLY distributed across (a)/(b)/(c)/(d)
- NEVER make the correct answer consistently the longest option`;
  }

  private buildDifficultyGuidelines(): string {
    return `DIFFICULTY DISTRIBUTION:
- 25% Easy: Direct application, single-step, confidence builders
- 50% Moderate: Requires clear conceptual understanding + calculation precision
- 25% Hard: Multi-step, concept combination, requires insight

PROGRESSION: Difficulty should increase through each section.`;
  }

  private buildAntiPatterns(): string {
    return `QUALITY GUARDRAILS (JEE MAIN-SPECIFIC):
- Do NOT create questions solvable by dimensional analysis alone
- Do NOT use trivial numbers that make arithmetic too easy (avoid pure textbook examples)
- Do NOT create distractors eliminable by common sense or units check
- Do NOT test obscure formulae outside standard JEE syllabus
- Do NOT make "None of these" or "All of these" an option
- Numerical Answer questions must yield INTEGER results — verify this before including
- Questions must feel like real NTA JEE Main questions, not coaching institute worksheets`;
  }
}
