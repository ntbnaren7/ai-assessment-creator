/**
 * Lightweight token estimation for admission control and profiling.
 * 
 * Uses the 4 chars ≈ 1 token heuristic (accurate within ~10% for English prose).
 * This is a ROUTING HEURISTIC, not a billing system. No external dependencies.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
