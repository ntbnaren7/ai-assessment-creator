import { LLMOrchestrator } from "./services/ai/llm.orchestrator.js";
import { GroqProvider } from "./services/ai/providers/groq.provider.js";
import { OpenRouterProvider } from "./services/ai/providers/openrouter.provider.js";
import { SchoolPromptStrategy } from "./services/ai/prompts/school.prompt.js";
import { getDynamicPaperSchemaJSON } from "./utils/validation.js";
import { logger } from "./utils/logger.js";
import { config } from "./config/index.js";
import fs from "fs";

function logToFile(msg: string) {
  logger.info(msg);
  fs.appendFileSync("benchmark_output.txt", msg + "\n");
}

export async function runStartupBenchmark() {
  try {
    logToFile("Initializing Providers for Benchmark...");
    const providers = [
      new GroqProvider({ apiKey: config.groqApiKey })
    ];
    const llm = new LLMOrchestrator(providers);
    const strategy = new SchoolPromptStrategy();

    const testCounts = [10, 20, 30, 40];

  logToFile("======================================");
  logToFile("STARTING EMPIRICAL BENCHMARK");
  logToFile("======================================");

  for (const count of testCounts) {
    logToFile(`\n--- Benchmarking ${count} MCQs ---`);
    const assignment: any = {
      title: "Science Benchmark Test",
      subject: "Science",
      grade: "Grade 10",
      totalMarks: count,
      numberOfQuestions: count,
      duration: "60 mins",
      questionTypes: ["Multiple Choice Questions"],
    };

    const systemPrompt = strategy.buildSystemPrompt(assignment);
    const expectedSchema = getDynamicPaperSchemaJSON(assignment.questionTypes);

    const request = {
      systemPrompt,
      userPrompt: "Generate the assessment JSON now.",
      expectedSchema,
      temperature: strategy.getTemperature(),
      minimumTier: 3, // ModelTier.TIER_3
      maxOutputTokens: strategy.getMaxOutputTokens(),
    };

    const start = performance.now();
    try {
      const result = await llm.generateJSON(request);
      const latencyMs = Math.round(performance.now() - start);
      
      logToFile(`✅ Success for ${count} MCQs`);
      logToFile(`⏱️ Total Orchestrator Time: ${latencyMs / 1000} seconds`);
      logToFile(`🤖 Model Used: ${result.raw.modelUsed} (${result.raw.providerName})`);
      logToFile(`📊 Prompt Tokens: ${result.raw.usage?.promptTokens || 0}`);
      logToFile(`📊 Completion Tokens: ${result.raw.usage?.completionTokens || 0}`);
      
      const sections = (result.data as any).sections || [];
      const actualCount = sections.reduce((acc: number, s: any) => acc + (s.questions?.length || 0), 0);
      logToFile(`📝 Generated Question Count: ${actualCount}`);
      
    } catch (error: any) {
      logToFile(`❌ Failed for ${count} MCQs: ${error.message}`);
      if (error.errors) {
        logToFile(`Details: ${JSON.stringify(error.errors, null, 2)}`);
      }
    }
  }

  logToFile("\n======================================");
  logToFile("BENCHMARK COMPLETE");
  logToFile("======================================");
  } catch (err: any) {
    logToFile(`FATAL ERROR IN BENCHMARK: ${err.message}\n${err.stack}`);
  }
}
