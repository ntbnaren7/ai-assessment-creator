/**
 * In-memory sliding window TPM (Tokens Per Minute) tracker.
 * Tracks estimated tokens consumed by requests to prevent orchestrator
 * from exceeding the provider's TPM limit.
 */
export class TpmTracker {
  // Map of modelId -> array of token consumptions with timestamps
  private usage: Map<string, Array<{ timestamp: number; tokens: number }>> = new Map();
  private readonly windowMs = 60000; // 60 seconds

  /**
   * Records token usage for a model.
   */
  public recordUsage(modelId: string, tokens: number): void {
    if (!this.usage.has(modelId)) {
      this.usage.set(modelId, []);
    }
    const history = this.usage.get(modelId)!;
    history.push({ timestamp: Date.now(), tokens });
    this.clean(modelId);
  }

  /**
   * Gets the total token usage for a model in the last 60 seconds.
   */
  public getUsage(modelId: string): number {
    this.clean(modelId);
    const history = this.usage.get(modelId);
    if (!history) return 0;
    
    return history.reduce((sum, entry) => sum + entry.tokens, 0);
  }

  /**
   * Removes entries older than 60 seconds.
   */
  private clean(modelId: string): void {
    const history = this.usage.get(modelId);
    if (!history) return;
    
    const cutoff = Date.now() - this.windowMs;
    const cleaned = history.filter((entry) => entry.timestamp > cutoff);
    this.usage.set(modelId, cleaned);
  }
}
