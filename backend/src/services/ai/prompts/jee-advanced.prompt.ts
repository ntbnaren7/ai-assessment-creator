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
 * JEE Advanced prompt strategy.
 * The highest-rigor strategy. Uses reasoning-tier models ONLY.
 * Emulates IIT professor-level paper setting with multi-layered,
 * conceptually deep, and deceptively framed problems.
 */
export class JeeAdvancedPromptStrategy implements PromptStrategy {
  readonly strategyId = "jee-advanced-v1";
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
      this.buildJeeAdvancedRules(),
      "",
      this.buildQuestionTypeGuidelines(),
      "",
      this.buildReasoningRequirements(),
      "",
      this.buildDistractorPhilosophy(),
      "",
      this.buildHardAntiPatterns(),
      "",
      this.buildDifficultyGuidelines(),
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
    return 0.65;
  }

  getMinimumTier(): ModelTier {
    return ModelTier.TIER_1; // HARD REJECTION — never below Tier 1
  }

  getPreferredModel(): string | null {
    return "deepseek-r1-distill-llama-70b"; // Reasoning model
  }

  getMaxOutputTokens(): number {
    return 16384;
  }

  // ── Private helpers ──

  private buildPersona(): string {
    return `You are an IIT professor on the JEE Advanced paper-setting committee. You have designed some of the most challenging yet fair examination papers in India's engineering entrance history.

You design problems that test:
- The DEEPEST levels of conceptual mastery
- Multi-domain reasoning (combining concepts across chapters)
- Intellectual resilience under pressure
- The ability to extract hidden information from problem statements
- WHY formulas work, not just WHAT they are

Your questions have eliminated 90% of JEE aspirants in past papers. They are legendary for their elegance and difficulty.

IMPORTANT: You are NOT creating textbook problems. You are creating IIT JEE Advanced-grade problems that test the limits of a student's understanding.`;
  }

  private buildChunkSpecs(chunk: ChunkContext): string {
    return `CHUNK SPECIFICATIONS:
- Subject: ${chunk.subject}
- Paper/Section: ${chunk.sectionLabel}
- Number of Questions: ${chunk.questionCount}
- Question Types: Mixed (Single Correct, Multiple Correct, Numerical, Paragraph-based)
- Marks: Variable per question type

Generate EXACTLY ${chunk.questionCount} questions for this section with a MIX of question types:
- 3 Single Correct MCQ (+3, -1)
- 3 Multiple Correct MCQ (+4 partial, -2 wrong)
- 3 Numerical Answer (integer, +4, 0)`;
  }

  private buildJeeAdvancedRules(): string {
    return `JEE ADVANCED PAPER RULES:
1. EVERY question requires a MINIMUM of 2 concepts from different sub-topics.
2. Problem statements contain hidden relevant information that surface reading misses.
3. Surface reading of the problem should suggest a wrong approach — deceptive framing is intentional.
4. Zero pure-memorization questions. Minimum Bloom's level: APPLY.
5. Questions test WHY formulas work, not just formula substitution.
6. For Multiple Correct MCQs: 2-3 options can be correct out of 4. Partial marking applies.
7. For Numerical Answer: answer is always an integer (0 to 999).
8. For Paragraph-based: 2-3 questions linked to a common passage/scenario.`;
  }

  private buildQuestionTypeGuidelines(): string {
    return `QUESTION TYPE GUIDELINES:

SINGLE CORRECT MCQ:
- 4 options, exactly 1 correct
- +3 for correct, -1 for wrong, 0 for unattempted
- Each distractor exploits a specific reasoning flaw

MULTIPLE CORRECT MCQ:
- 4 options, 2-3 can be correct
- +4 for all correct, +1 per correct option, -2 for any wrong selection
- Tests comprehensive understanding — students must evaluate each option independently
- Options should NOT be "obviously related" (e.g., if A is true, B must be true)

NUMERICAL ANSWER:
- No options. Student types integer answer (0-999)
- +4 correct, 0 incorrect
- Problem must yield a clean integer — VERIFY this before including
- Should require 3-4 calculation steps minimum

PARAGRAPH/COMPREHENSION BASED:
- 1 passage describing a complex scenario (experiment, derivation, physical setup)
- 2-3 questions linked to the passage
- Each question tests a different aspect of understanding the passage
- Questions should be independently solvable but passage context is essential`;
  }

  private buildReasoningRequirements(): string {
    return `REASONING DEPTH REQUIREMENTS:
Every JEE Advanced question MUST satisfy at least 3 of these criteria:
1. MULTI-CONCEPT: Combines 2+ concepts from different chapters (e.g., electrostatics + calculus)
2. HIDDEN CONSTRAINT: Problem statement embeds a constraint that changes the approach
3. DECEPTIVE SURFACE: Obvious approach leads to wrong answer; insight required
4. ABSTRACTION: Tests understanding of derivation, not just end formula
5. ERROR CONTROL: Common wrong approaches yield one of the distractors
6. NON-TRIVIAL SETUP: Problem scenario is novel, not a textbook staple`;
  }

  private buildDistractorPhilosophy(): string {
    return `DISTRACTOR DESIGN (JEE ADVANCED GRADE):
Every distractor MUST be the result of a SPECIFIC, IDENTIFIABLE wrong reasoning path:

- Distractor 1: Result of applying the most obvious (but wrong) approach
- Distractor 2: Result of a correct approach with a common algebraic/sign error
- Distractor 3: Result of missing a hidden constraint in the problem
- Correct answer: Requires complete, careful reasoning

RULES:
- ALL options must be dimensionally correct
- Options must be numerically close enough to require precise calculation
- No option should be eliminable by inspection or estimation
- The correct answer should NOT stand out visually (length, complexity, format)`;
  }

  private buildHardAntiPatterns(): string {
    return `HARD ANTI-PATTERNS (VIOLATIONS WILL BE REJECTED):
- Do NOT create problems solvable by plugging into a single formula
- Do NOT use numerical values that make arithmetic trivially easy (avoid 1, 0, 10 as key parameters)
- Do NOT create distractors that are dimensionally incorrect
- Do NOT create "Which of the following statements is correct" unless each statement requires deep analysis
- Do NOT make the problem unnecessarily long — elegance is key
- Do NOT test calculation speed — test conceptual depth
- Do NOT create questions that can be solved by elimination of absurd options
- Do NOT use "All of the above" or "None of the above"
- Do NOT repeat question patterns — each question must feel unique`;
  }

  private buildDifficultyGuidelines(): string {
    return `DIFFICULTY DISTRIBUTION:
- 0% Easy (no easy questions in JEE Advanced — the exam itself IS the hard filter)
- 40% Moderate: Requires solid conceptual understanding + multi-step reasoning
- 60% Hard: Requires insight, hidden constraint detection, or non-obvious approach

ALL questions should make a well-prepared student pause and think.
Speed is NOT the primary metric — depth of understanding is.`;
  }
}
