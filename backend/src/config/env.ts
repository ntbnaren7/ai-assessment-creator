import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5001", 10),
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/ai-assessment-creator",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  groqApiKey: process.env.GROQ_API_KEY || "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  cohereApiKey: process.env.COHERE_API_KEY || "",
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
} as const;

export function validateConfig(): void {
  if (!config.groqApiKey && !config.openRouterApiKey && !config.cohereApiKey) {
    console.warn("⚠️  No AI provider API keys are set. AI generation will fail.");
  }
  if (!config.mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }
  if (!config.redisUrl) {
    throw new Error("REDIS_URL is required");
  }
}
