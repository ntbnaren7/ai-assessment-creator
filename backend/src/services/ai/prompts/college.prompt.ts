import type { IAssignment } from "../../../models/index.js";
import { ModelTier } from "../models/model-registry.js";
import type { PromptStrategy, ChunkContext } from "./prompt.strategy.js";
import {
  buildSpecsBlock,
  buildQuestionTypeBlock,
  buildDifficultyRules,
  buildFileContentBlock,
  buildAnswerKeyRules,
  buildCollegeStructureRules,
  buildOutputSchemaRules,
  buildAntiPatternRules,
  buildConceptAvoidanceBlock,
  buildAdditionalInstructionsBlock,
} from "./prompt.utils.js";

/**
 * College/University prompt strategy for semester and year-level exams.
 * Emulates the style of NAAC A+ accredited institution papers.
 */
export class CollegePromptStrategy implements PromptStrategy {
  readonly strategyId = "college-v1";
  readonly promptVersion = "1.0.0";

  buildSystemPrompt(assignment: IAssignment, chunkContext?: ChunkContext): string {
    const parts: string[] = [
      this.buildPersona(),
      "",
      buildSpecsBlock(assignment),
      "",
      buildQuestionTypeBlock(assignment),
      buildDifficultyRules(assignment),
      "",
      this.buildCognitiveGuidelines(),
      "",
      buildCollegeStructureRules(),
      "",
      buildAnswerKeyRules(true, chunkContext),
      "",
      buildAntiPatternRules(),
      "",
      this.buildCollegeSpecificRules(),
      "",
      buildOutputSchemaRules(),
    ];

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
    return 0.6;
  }

  getMinimumTier(): ModelTier {
    return ModelTier.TIER_2;
  }

  getPreferredModel(): string | null {
    return "llama-3.3-70b-versatile";
  }

  getMaxOutputTokens(): number {
    return 12288;
  }

  // ── Private helpers ──

  private buildPersona(): string {
    return `You are a university examination controller and senior professor at a NAAC A+ accredited autonomous institution. You have 25+ years of experience designing semester-end and annual university examination papers that are rigorous, fair, and pedagogically sound.

Your papers are known for:
- Crystal-clear question framing with no ambiguity
- Balanced difficulty that rewards both consistent study and deep understanding
- Internal choice questions that test equivalent but different aspects of the syllabus
- Mark-aligned answer expectations (a 5-mark question expects 5 key points)`;
  }

  private buildCognitiveGuidelines(): string {
    return `COGNITIVE DISTRIBUTION (Bloom's Taxonomy):
- 20% REMEMBER: Definitions, distinctions, factual recall, one-line derivations
- 30% UNDERSTAND: Explain concepts, compare approaches, illustrate with examples
- 30% APPLY: Solve problems using learned concepts, numerical computations, apply formulas to new scenarios
- 20% ANALYZE: Case-study based, design/critique solutions, evaluate alternatives

Part A = primarily Remember + Understand
Part B = Apply + Analyze (with internal either/or choice)
Part C (if present) = Analyze + Evaluate (synthesis-level)`;
  }

  private buildCollegeSpecificRules(): string {
    return `UNIVERSITY PAPER RULES:
- Part A questions should be precise and factual — a 2-mark question expects a 2-line answer
- Part B questions must have internal EITHER/OR choice — both options MUST be of equal difficulty but from different sub-topics
- Part C questions (if present) should be comprehensive — requiring synthesis of multiple concepts
- Numerical problems must have clean, verifiable answers
- Include at least one "justify your answer" or "explain with a diagram" type question in Part B
- Questions must cover breadth of the syllabus — no more than 2 questions from the same chapter/unit
- Avoid trivial recall questions in Part B and Part C
- Language should be formal, precise, and academic`;
  }
}
