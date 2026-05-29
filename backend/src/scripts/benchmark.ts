import dotenv from "dotenv";
dotenv.config();

import { LLMOrchestrator } from "../services/ai/llm.orchestrator.js";
import { GenerationOrchestrator } from "../services/ai/generation/generation.orchestrator.js";
import { GroqProvider } from "../services/ai/providers/groq.provider.js";
import { OpenRouterProvider } from "../services/ai/providers/openrouter.provider.js";
import { CohereProvider } from "../services/ai/providers/cohere.provider.js";
import { getDynamicPaperSchemaJSON } from "../utils/validation.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";


async function runBenchmark() {
  console.log("Initializing Providers...");
  const providers = [];
  if (config.groqApiKey) {
    providers.push(new GroqProvider({ apiKey: config.groqApiKey }));
    console.log("  ✔ Groq provider loaded");
  }
  if (config.openRouterApiKey) {
    providers.push(new OpenRouterProvider({ apiKey: config.openRouterApiKey }));
    console.log("  ✔ OpenRouter provider loaded");
  }
  if (config.cohereApiKey) {
    providers.push(new CohereProvider({ apiKey: config.cohereApiKey }));
    console.log("  ✔ Cohere provider loaded");
  }
  if (providers.length === 0) {
    console.error("❌ No providers initialized. Set GROQ_API_KEY, OPENROUTER_API_KEY, or COHERE_API_KEY.");
    process.exit(1);
  }
  console.log(`  Total providers: ${providers.length}`);
  const llm = new LLMOrchestrator(providers);
  const orchestrator = new GenerationOrchestrator(llm);
  const testGrades = ["Grade 1", "Grade 5", "Grade 8", "Grade 10", "Grade 12"];

  console.log("======================================");
  console.log("STARTING EMPIRICAL BENCHMARK (v3 — Strict Schemas & Budgets)");
  console.log("======================================");

  for (const grade of testGrades) {
    console.log(`\n--- Benchmarking Mixed Assessment for ${grade} (40 Questions total) ---`);
    const assignment: any = {
      title: "Science Benchmark Test (Mixed)",
      subject: "Science",
      grade: grade,
      totalMarks: 70, // 20*1 + 10*2 + 5*4 + 5*2
      numberOfQuestions: 40,
      duration: "90 mins",
      questionTypes: ["Multiple Choice Questions", "Short Answer Questions", "Long Answer Questions", "Numerical Problems"],
      questionTypeDetails: [
        {
          type: "Multiple Choice Questions",
          numberOfQuestions: 20,
          marks: 1
        },
        {
          type: "Short Answer Questions",
          numberOfQuestions: 10,
          marks: 2
        },
        {
          type: "Long Answer Questions",
          numberOfQuestions: 5,
          marks: 4
        },
        {
          type: "Numerical Problems",
          numberOfQuestions: 5,
          marks: 2
        }
      ]
    };

    const start = performance.now();
    try {
      const result = await orchestrator.generate(assignment, `bench-${Date.now()}`);
      const latencyMs = Math.round(performance.now() - start);
      
      console.log(`✅ Success for Mixed Assessment (${grade})`);
      console.log(`⏱️ Total Orchestrator Time: ${latencyMs / 1000} seconds`);
      console.log(`🤖 Chunk Details:`, JSON.stringify(result.metadata.chunksDetail, null, 2));
      
      const sections = result.paper.sections || [];
      const actualCount = sections.reduce((acc: number, s: any) => acc + (s.questions?.length || 0), 0);
      console.log(`📝 Generated Question Count: ${actualCount}`);
      
    } catch (error: any) {
      console.error(`❌ Failed: ${error.message}`);
    }
  }

  console.log("\n======================================");
  console.log("BENCHMARK COMPLETE");
  console.log("======================================");
}

runBenchmark().catch(console.error);
