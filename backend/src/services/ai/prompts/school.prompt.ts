import type { IAssignment } from "../../../models/index.js";
import { ModelTier } from "../models/model-registry.js";
import type { PromptStrategy, ChunkContext } from "./prompt.strategy.js";
import {
  buildSpecsBlock,
  buildQuestionTypeBlock,
  buildDifficultyRules,
  buildFileContentBlock,
  buildAnswerKeyRules,
  buildSchoolStructureRules,
  buildOutputSchemaRules,
  buildAntiPatternRules,
  buildConceptAvoidanceBlock,
  buildAdditionalInstructionsBlock,
  extractGradeNumber,
} from "./prompt.utils.js";

/**
 * School prompt strategy for Grades 1–12.
 * Adapts persona, cognitive targets, and difficulty distribution by grade band.
 */
export class SchoolPromptStrategy implements PromptStrategy {
  readonly strategyId = "school-v1";
  readonly promptVersion = "1.0.0";

  buildSystemPrompt(assignment: IAssignment, chunkContext?: ChunkContext): string {
    const gradeNum = extractGradeNumber(assignment);
    const band = this.getGradeBand(gradeNum);

    const parts: string[] = [
      this.buildPersona(band),
      "",
      buildSpecsBlock(assignment),
      "",
      buildQuestionTypeBlock(assignment),
      buildDifficultyRules(assignment),
      "",
      this.buildCognitiveGuidelines(band),
      "",
      buildSchoolStructureRules(),
      "",
      buildAnswerKeyRules(false),
      "",
      buildAntiPatternRules(),
      "",
      this.buildGradeBandRules(band),
      "",
      buildOutputSchemaRules(),
    ];

    // Optional blocks
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
    return 0.7;
  }

  getMinimumTier(): ModelTier {
    return ModelTier.TIER_2; // Tier 3 acceptable for grades 1-5 handled by resolver
  }

  getPreferredModel(): string | null {
    return "qwen3-32b";
  }

  getMaxOutputTokens(): number {
    return 8192;
  }

  // ── Private helpers ──

  private getGradeBand(gradeNum: number | null): "primary" | "middle" | "secondary" | "senior" {
    if (!gradeNum || gradeNum <= 5) return "primary";
    if (gradeNum <= 8) return "middle";
    if (gradeNum <= 10) return "secondary";
    return "senior";
  }

  private buildPersona(band: string): string {
    const base = `You are a CBSE/ICSE-certified senior faculty member with 20+ years of experience setting board-level examination papers.`;
    const bandSpecific: Record<string, string> = {
      primary: `${base} You specialize in early childhood education and age-appropriate assessment design for young learners (Grades 1-5). Your questions use simple vocabulary, short sentences, and visual/concrete examples.`,
      middle: `${base} You specialize in middle school education (Grades 6-8), crafting questions that build conceptual understanding through real-world scenarios, diagrams, and application-based problems.`,
      secondary: `${base} You specialize in board-exam preparation for Grades 9-10, creating HOTS (Higher Order Thinking Skills) questions with case-based scenarios and multi-step reasoning.`,
      senior: `${base} You specialize in senior secondary (Grades 11-12) pre-competitive exam preparation, creating questions that test deep conceptual mastery, derivation skills, and analytical reasoning at near-competitive exam rigor.`,
    };
    return bandSpecific[band] || base;
  }

  private buildCognitiveGuidelines(band: string): string {
    const guidelines: Record<string, string> = {
      primary: `COGNITIVE TARGETS (Bloom's Taxonomy):
- Primary focus: REMEMBER (recall facts, definitions, basic concepts)
- Difficulty mix: 80% Easy, 20% Moderate, 0% Hard
- Language: Simple vocabulary, short sentences, concrete examples
- Avoid abstract reasoning or multi-step problems`,

      middle: `COGNITIVE TARGETS (Bloom's Taxonomy):
- Focus: UNDERSTAND (explain, compare, classify) + APPLY (use knowledge in new situations)
- Difficulty mix: 40% Easy, 40% Moderate, 20% Hard
- Include: Real-world scenarios, diagram-based questions, "why" questions
- Introduce: Data interpretation and basic analytical reasoning`,

      secondary: `COGNITIVE TARGETS (Bloom's Taxonomy):
- Focus: APPLY + ANALYZE (break down, compare relationships, identify patterns)
- Difficulty mix: 20% Easy, 50% Moderate, 30% Hard
- Include: HOTS questions, case-based problems, multi-step calculations
- Board exam framing: Match the style of CBSE/ICSE board papers`,

      senior: `COGNITIVE TARGETS (Bloom's Taxonomy):
- Focus: APPLY + ANALYZE + EVALUATE (justify, critique, design solutions)
- Difficulty mix: 15% Easy, 45% Moderate, 40% Hard
- Include: Derivation-based questions, numerical problems with conceptual depth
- Pre-competitive rigor: Questions should prepare students for JEE/NEET entrance level`,
    };
    return guidelines[band] || guidelines.middle;
  }

  private buildGradeBandRules(band: string): string {
    const rules: Record<string, string> = {
      primary: `GRADE-SPECIFIC RULES:
- Use age-appropriate language (no jargon)
- Questions should be answerable in 1-2 minutes each
- Include visual cues in question text where appropriate (e.g., "Look at the picture..." — describe it in text)
- Fill-in-the-blanks should have single-word or short-phrase answers`,

      middle: `GRADE-SPECIFIC RULES:
- Introduce subject-specific terminology gradually
- Include at least 1 diagram-based or data-interpretation question if applicable
- Short answers should require 2-3 sentences
- MCQ distractors should be common student misconceptions, not random values`,

      secondary: `GRADE-SPECIFIC RULES:
- Match CBSE/ICSE board paper style and difficulty
- Include at least 1 case-study or passage-based question
- Numerical problems should have clean answers (integers or simple fractions)
- Long answers should require structured responses with diagrams/derivations where applicable
- MCQ distractors MUST represent common student errors (not random values)`,

      senior: `GRADE-SPECIFIC RULES:
- Pre-competitive exam difficulty — these students are preparing for JEE/NEET
- Include derivation-based questions that test understanding of fundamentals
- Numerical problems should test conceptual application, not just formula substitution
- At least 20% of questions should combine concepts from multiple chapters/topics
- Distractors in MCQs must be the result of specific, identifiable wrong approaches`,
    };
    return rules[band] || rules.middle;
  }
}
