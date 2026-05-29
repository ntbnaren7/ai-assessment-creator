import { logger } from "../../../utils/logger.js";

/**
 * Tracks rate limit cooldowns per model.
 * A model in cooldown should not be selected for generation until the cooldown expires.
 */
export class ProviderCooldownManager {
  private cooldowns: Map<string, number> = new Map();

  /**
   * Puts a model into cooldown for the specified duration.
   * @param modelId The ID of the model.
   * @param retryAfterSeconds The number of seconds to wait.
   */
  public setCooldown(modelId: string, retryAfterSeconds: number): void {
    const expiresAt = Date.now() + retryAfterSeconds * 1000;
    this.cooldowns.set(modelId, expiresAt);
    
    logger.warn("[COOLDOWN] Model placed in cooldown", {
      model: modelId,
      retryAfterSeconds,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }

  /**
   * Checks if a model is currently in cooldown.
   * @param modelId The ID of the model.
   * @returns true if the model is in cooldown, false otherwise.
   */
  public isCoolingDown(modelId: string): boolean {
    const expiresAt = this.cooldowns.get(modelId);
    if (!expiresAt) return false;

    if (Date.now() > expiresAt) {
      // Cooldown expired, clean it up
      this.cooldowns.delete(modelId);
      return false;
    }

    return true;
  }

  /**
   * Gets the remaining cooldown time in milliseconds.
   */
  public getRemainingCooldownMs(modelId: string): number {
    const expiresAt = this.cooldowns.get(modelId);
    if (!expiresAt) return 0;
    
    const remaining = expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }
}
