import { getRedisConnection } from "../../../config/redis.js";
import { logger } from "../../../utils/logger.js";
import crypto from "crypto";

/**
 * Persistent generation run state in Redis.
 * Survives worker crashes. Auto-expires via TTL.
 * 
 * Uses distributed locking (SET NX EX) to prevent double-processing race conditions.
 * See ADR-9 for design rationale.
 */

// ── Constants ──

const LOCK_KEY_PREFIX = "gen-lock:";
const RUN_KEY_PREFIX = "gen-run:";
const LOCK_TTL_SECONDS = 300;    // 5 min lock, renewed after each chunk
const RUN_TTL_SECONDS = 1800;    // 30 min run data, auto-expire

// ── Types ──

export interface GenerationRun {
  runId: string;
  assignmentId: string;
  status: "active" | "completed" | "failed" | "cancelled";
  strategyId: string;
  completedChunkIds: string[];
  completedChunkResults: string;  // JSON blob of completed chunk outputs
  currentChunkId: string | null;
  totalChunks: number;
  startedAt: number;
  updatedAt: number;
  workerId: string;
  lockToken: string;
}

// ── Lock Operations ──

/**
 * Attempt to acquire a distributed lock for an assignment.
 * Uses Redis SET NX EX for atomic lock acquisition.
 * 
 * @returns lockToken if acquired, null if another worker holds the lock
 */
export async function acquireLock(assignmentId: string): Promise<string | null> {
  const redis = getRedisConnection();
  const lockToken = crypto.randomUUID();

  const result = await redis.set(
    `${LOCK_KEY_PREFIX}${assignmentId}`,
    lockToken,
    "EX",
    LOCK_TTL_SECONDS,
    "NX"
  );

  if (result === "OK") {
    logger.info("Generation lock acquired", { assignmentId, lockToken });
    return lockToken;
  }

  logger.debug("Generation lock not acquired (held by another worker)", { assignmentId });
  return null;
}

/**
 * Renew the lock TTL. Only succeeds if we still own it (compare-and-extend via Lua).
 * Call this after each chunk completes to prevent lock expiry during long generation.
 * 
 * @returns true if renewed, false if lock was lost
 */
export async function renewLock(assignmentId: string, lockToken: string): Promise<boolean> {
  const redis = getRedisConnection();

  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;

  const result = await redis.eval(
    script,
    1,
    `${LOCK_KEY_PREFIX}${assignmentId}`,
    lockToken,
    String(LOCK_TTL_SECONDS)
  );

  if (result === 1) {
    return true;
  }

  logger.warn("Lock renewal failed (lock lost)", { assignmentId, lockToken });
  return false;
}

/**
 * Release the lock. Only deletes if we still own it (compare-and-delete via Lua).
 */
export async function releaseLock(assignmentId: string, lockToken: string): Promise<void> {
  const redis = getRedisConnection();

  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  await redis.eval(
    script,
    1,
    `${LOCK_KEY_PREFIX}${assignmentId}`,
    lockToken
  );

  logger.info("Generation lock released", { assignmentId });
}

// ── Run State Operations ──

/**
 * Save or update the generation run state in Redis.
 */
export async function saveRun(run: GenerationRun): Promise<void> {
  const redis = getRedisConnection();
  run.updatedAt = Date.now();

  await redis.set(
    `${RUN_KEY_PREFIX}${run.assignmentId}`,
    JSON.stringify(run),
    "EX",
    RUN_TTL_SECONDS
  );
}

/**
 * Load an existing generation run (for crash recovery).
 */
export async function loadRun(assignmentId: string): Promise<GenerationRun | null> {
  const redis = getRedisConnection();
  const data = await redis.get(`${RUN_KEY_PREFIX}${assignmentId}`);
  return data ? JSON.parse(data) : null;
}

/**
 * Clear the generation run state after successful completion.
 */
export async function clearRun(assignmentId: string): Promise<void> {
  const redis = getRedisConnection();
  await redis.del(`${RUN_KEY_PREFIX}${assignmentId}`);
}

/**
 * Check if a run is stale (worker probably crashed).
 * A run is stale if it hasn't been updated in 5 minutes.
 */
export function isRunStale(run: GenerationRun): boolean {
  const ageMs = Date.now() - run.updatedAt;
  return ageMs > 5 * 60 * 1000;
}
