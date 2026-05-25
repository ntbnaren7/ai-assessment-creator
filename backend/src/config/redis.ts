import Redis from "ioredis";
import { config } from "./env.js";

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisConnection.on("connect", () => {
      console.log("✅ Redis connected successfully");
    });

    redisConnection.on("error", (err) => {
      console.error("Redis connection error:", err);
    });
  }
  return redisConnection;
}
