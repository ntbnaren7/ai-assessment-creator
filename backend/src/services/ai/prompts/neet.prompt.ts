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
 * NEET UG prompt strategy.
 * Emulates NTA NEET-UG paper setting with NCERT-faithful questions,
 * speed-oriented design, and systematic distractor philosophy.
 */
export class NeetPromptStrategy implements PromptStrategy {
  readonly strategyId = "neet-v1";
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
      this.buildNeetRules(),
      "",
      this.buildDistractorPhilosophy(),
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
    return 0.5;
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
    return `You are a senior NEET-UG paper setter from the National Testing Agency (NTA) with deep expertise in Biology (Botany & Zoology), Physics, and Chemistry at the NCERT Class 11-12 level.

You have set papers for 5+ years and understand:
- Exactly which NCERT lines are testable and frequently tested
- The precise cognitive load NEET aspirants face under time pressure
- How to design questions that separate serious students from rote learners
- The art of crafting distractors that exploit common student errors

Your questions are INDISTINGUISHABLE from real NTA NEET-UG papers.`;
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

Generate EXACTLY ${chunk.questionCount} MCQ questions for this section.`;
  }

  private buildNeetRules(): string {
    return `NEET-UG PAPER RULES:
1. ALL questions are MCQ with exactly 4 options: (a), (b), (c), (d).
2. Each question carries +4 marks for correct, -1 for incorrect.
3. Every question MUST be traceable to a specific NCERT Class 11 or Class 12 chapter.
4. Average solve time per question: 1-2 minutes (speed-oriented design).
5. Questions must test UNDERSTANDING, not rote memorization.
6. Numerical problems should have clean integer or simple fraction answers.
7. Biology questions should include:
   - Diagram-based identification
   - NCERT line-specific assertions (true/false framing in MCQ)
   - Classification and comparison questions
8. Physics questions should include:
   - Formula application with conceptual twist
   - Unit/dimension analysis
   - Graph interpretation
9. Chemistry questions should include:
   - Reaction mechanism identification
   - Periodic table trend questions
   - IUPAC naming and structure recognition`;
  }

  private buildDistractorPhilosophy(): string {
    return `DISTRACTOR DESIGN PHILOSOPHY (CRITICAL):
For each MCQ, every option must have a SPECIFIC PURPOSE:
- Option representing: COMMON CALCULATION ERROR (e.g., forgot to square, wrong sign)
- Option representing: CONCEPTUAL MISCONCEPTION (e.g., confused Newton's 2nd with 3rd law)
- Option representing: CLOSE-BUT-WRONG (e.g., off by a factor of 2, or 10, or π)
- Option representing: CORRECT ANSWER

RANDOMLY SHUFFLE the position of the correct answer across questions.
Do NOT make the correct answer predominantly one letter.

DISTRACTOR QUALITY RULES:
- ALL four options must be numerically/dimensionally plausible
- Options should be close in value (e.g., 2, 3, 4, 6 — NOT 2, 50, 1000, 3000)
- No distractor should be eliminable by dimensional analysis alone
- No distractor should be obviously absurd`;
  }

  private buildDifficultyGuidelines(): string {
    return `DIFFICULTY DISTRIBUTION:
- 30% Easy: Direct NCERT application, single-concept, 1-step problems
- 50% Moderate: Concept combination, 2-step calculation, requires careful reading
- 20% Hard: Multi-concept integration, tricky wording, requires deep understanding

DIFFICULTY PROGRESSION:
- Start each section with 2-3 easy questions to build confidence
- Increase difficulty gradually through the section
- End with the hardest questions`;
  }

  private buildAntiPatterns(): string {
    return `QUALITY GUARDRAILS (NEET-SPECIFIC):
- Do NOT create questions solvable by eliminating obviously wrong options
- Do NOT use "All of the above" or "None of the above" as options
- Do NOT start more than 20% of questions with "Which of the following"
- Do NOT make the correct answer consistently longer than distractors
- Do NOT test obscure facts not in NCERT — every question must be NCERT-traceable
- Do NOT create questions that require calculator-dependent computation
- Questions must feel like real NTA NEET questions, not textbook exercises`;
  }
}
