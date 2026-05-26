import Redis from "ioredis";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisConnection.on("connect", () => {
      logger.info("Redis connected successfully");
    });

    redisConnection.on("error", (err) => {
      logger.error("Redis connection error", { error: err });
    });
  }
  return redisConnection;
}
