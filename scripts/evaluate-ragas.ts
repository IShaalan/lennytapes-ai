/**
 * RAGAS Evaluation Script
 *
 * Evaluates RAG output quality using RAGAS metrics:
 * - Faithfulness: Is the answer grounded in the retrieved context?
 * - Answer Relevancy: Does the answer address the question?
 * - Context Precision: Are the retrieved documents relevant?
 *
 * Run with: npx tsx scripts/evaluate-ragas.ts
 * Options:
 *   --topic=<topic>     Filter by topic (e.g., growth, hiring)
 *   --type=<type>       Filter by query type (keyword, semantic, guest-specific, mixed)
 *   --limit=<n>         Limit number of queries to evaluate
 *   --dry-run           Show what would be evaluated without running RAGAS
 */

import { config } from "dotenv";
import { Langfuse } from "langfuse";
import { search, type SearchResult } from "../lib/search";
import { llmGenerate, getOrCreateTrace, endTrace } from "../lib/llm";
import { evaluateWithRagas, aggregateResults } from "../lib/evaluation";
import type { RagasInput, RagasEvaluationResult } from "../lib/evaluation/types";
import { RAGAS_THRESHOLDS, RAGAS_ALERT_THRESHOLDS } from "../lib/evaluation/types";
import {
  GOLDEN_QUERIES,
  type GoldenQuery,
  type QueryType,
} from "../data/golden-queries";

config();

// ============ ARGUMENT PARSING ============

function parseArgs(): {
  topic?: string;
  type?: QueryType;
  limit?: number;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  let topic: string | undefined;
  let type: QueryType | undefined;
  let limit: number | undefined;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith("--topic=")) {
      topic = arg.split("=")[1];
    } else if (arg.startsWith("--type=")) {
      const val = arg.split("=")[1];
      if (["keyword", "semantic", "guest-specific", "mixed"].includes(val)) {
        type = val as QueryType;
      }
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return { topic, type, limit, dryRun };
}

// ============ ANSWER GENERATION ============

/**
 * Generate an answer for a query using the RAG pipeline.
 */
async function generateAnswer(
  query: string,
  contexts: SearchResult[],
  traceId?: string
): Promise<string> {
  // Build context string from search results
  const contextText = contexts
    .slice(0, 5) // Use top 5 results
    .map((r, i) => {
      return `[${i + 1}] ${r.guest} (${r.episodeTitle}):\n"${r.text}"`;
    })
    .join("\n\n");

  const systemPrompt = `You are an AI assistant that answers questions based on insights from Lenny's Podcast.
You MUST only use information from the provided context to answer questions.
Always cite the source (guest name and episode) when making claims.
If the context doesn't contain enough information to answer, say so.`;

  const userPrompt = `Context from Lenny's Podcast:
${contextText}

Question: ${query}

Answer the question based ONLY on the context provided. Cite your sources.`;

  const answer = await llmGenerate(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.3, // Lower temperature for more factual responses
      traceId,
      metadata: {
        feature: "ragas-eval",
        queryText: query,
      },
    }
  );

  return answer;
}

// ============ EVALUATION PIPELINE ============

interface EvalResult {
  query: GoldenQuery;
  searchResults: SearchResult[];
  answer: string;
  ragasResult: RagasEvaluationResult;
  traceId: string;
}

async function evaluateQuery(
  query: GoldenQuery,
  langfuse: Langfuse
): Promise<EvalResult | null> {
  // Create trace for this evaluation
  const traceResult = getOrCreateTrace({
    name: `ragas-eval-${query.id}`,
    metadata: {
      queryId: query.id,
      queryType: query.type,
      topic: query.topic,
      difficulty: query.difficulty,
    },
  });

  const traceId = traceResult?.traceId || crypto.randomUUID();

  try {
    // Step 1: Search
    const searchResults = await search(query.query, {
      limit: 10,
      traceId,
    });

    if (searchResults.length === 0) {
      console.log(`  ⚠ No search results for "${query.id}"`);
      return null;
    }

    // Step 2: Generate answer
    const answer = await generateAnswer(query.query, searchResults, traceId);

    // Step 3: Prepare RAGAS input
    const ragasInput: RagasInput = {
      question: query.query,
      answer: answer,
      contexts: searchResults.slice(0, 5).map((r) => r.text),
    };

    // Step 4: Run RAGAS evaluation
    const ragasResult = await evaluateWithRagas(ragasInput);

    // Step 5: Log scores to Langfuse
    if (traceResult?.trace && !ragasResult.scores.error) {
      const { faithfulness, answer_relevancy, context_precision } = ragasResult.scores;

      if (faithfulness !== null) {
        langfuse.score({
          traceId,
          name: "ragas_faithfulness",
          value: faithfulness,
        });
      }
      if (answer_relevancy !== null) {
        langfuse.score({
          traceId,
          name: "ragas_answer_relevancy",
          value: answer_relevancy,
        });
      }
      if (context_precision !== null) {
        langfuse.score({
          traceId,
          name: "ragas_context_precision",
          value: context_precision,
        });
      }
    }

    return {
      query,
      searchResults,
      answer,
      ragasResult,
      traceId,
    };
  } catch (error) {
    console.error(`  ✗ Error evaluating "${query.id}":`, error);
    return null;
  } finally {
    endTrace(traceId);
  }
}

// ============ REPORTING ============

function printResults(results: EvalResult[]) {
  console.log("\n" + "=".repeat(70));
  console.log("RAGAS EVALUATION RESULTS");
  console.log("=".repeat(70));

  // Individual results
  console.log("\n--- INDIVIDUAL QUERIES ---\n");

  for (const result of results) {
    const { query, ragasResult } = result;
    const { scores } = ragasResult;

    const status = ragasResult.passed ? "✓" : "✗";
    const faithfulness = scores.faithfulness?.toFixed(2) ?? "N/A";
    const relevancy = scores.answer_relevancy?.toFixed(2) ?? "N/A";
    const precision = scores.context_precision?.toFixed(2) ?? "N/A";

    // Color-code based on thresholds
    const fColor = getScoreIndicator(scores.faithfulness, "faithfulness");
    const rColor = getScoreIndicator(scores.answer_relevancy, "answer_relevancy");
    const pColor = getScoreIndicator(scores.context_precision, "context_precision");

    console.log(
      `${status} [${query.id}] F=${faithfulness}${fColor} R=${relevancy}${rColor} P=${precision}${pColor} (${ragasResult.durationMs}ms)`
    );

    if (scores.error) {
      console.log(`    Error: ${scores.error}`);
    }
  }

  // Aggregate metrics
  const aggregate = aggregateResults(results.map((r) => r.ragasResult));

  console.log("\n--- AGGREGATE METRICS ---\n");
  console.log(`Total queries:     ${aggregate.count}`);
  console.log(`Passed:            ${aggregate.passed} (${(aggregate.passRate * 100).toFixed(1)}%)`);
  console.log(`Failed:            ${aggregate.failed}`);
  console.log("");
  console.log(`Avg Faithfulness:      ${aggregate.averages.faithfulness.toFixed(3)} (target: ${RAGAS_THRESHOLDS.faithfulness})`);
  console.log(`Avg Answer Relevancy:  ${aggregate.averages.answer_relevancy.toFixed(3)} (target: ${RAGAS_THRESHOLDS.answer_relevancy})`);
  console.log(`Avg Context Precision: ${aggregate.averages.context_precision.toFixed(3)} (target: ${RAGAS_THRESHOLDS.context_precision})`);

  // Group by topic
  console.log("\n--- BY TOPIC ---\n");
  const byTopic = groupBy(results, (r) => r.query.topic);
  for (const [topic, topicResults] of Object.entries(byTopic)) {
    const topicAgg = aggregateResults(topicResults.map((r) => r.ragasResult));
    console.log(
      `  ${topic.padEnd(15)} F=${topicAgg.averages.faithfulness.toFixed(2)} R=${topicAgg.averages.answer_relevancy.toFixed(2)} (n=${topicAgg.count})`
    );
  }

  // Group by difficulty
  console.log("\n--- BY DIFFICULTY ---\n");
  const byDifficulty = groupBy(results, (r) => r.query.difficulty);
  for (const [difficulty, diffResults] of Object.entries(byDifficulty)) {
    const diffAgg = aggregateResults(diffResults.map((r) => r.ragasResult));
    console.log(
      `  ${difficulty.padEnd(10)} F=${diffAgg.averages.faithfulness.toFixed(2)} R=${diffAgg.averages.answer_relevancy.toFixed(2)} (n=${diffAgg.count})`
    );
  }

  // Check if we should fail the run
  const shouldFail = aggregate.averages.faithfulness < RAGAS_ALERT_THRESHOLDS.faithfulness;

  console.log("\n" + "=".repeat(70));
  if (shouldFail) {
    console.log(`FAILED: Average faithfulness (${aggregate.averages.faithfulness.toFixed(2)}) below alert threshold (${RAGAS_ALERT_THRESHOLDS.faithfulness})`);
  } else {
    console.log("PASSED: All metrics within acceptable range");
  }
  console.log("=".repeat(70));

  return shouldFail;
}

function getScoreIndicator(
  score: number | null,
  metric: keyof typeof RAGAS_THRESHOLDS
): string {
  if (score === null) return "";
  if (score >= RAGAS_THRESHOLDS[metric]) return " ✓";
  if (score >= RAGAS_ALERT_THRESHOLDS[metric]) return " ⚠";
  return " ✗";
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

// ============ MAIN ============

async function main() {
  console.log("=== RAGAS EVALUATION ===\n");

  // Validate environment
  if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
    console.error("ERROR: Langfuse credentials not configured.");
    console.error("Set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY in .env");
    process.exit(1);
  }

  const hasAzureOpenAI = process.env.AZURE_OPENAI_API_KEY &&
                         process.env.AZURE_OPENAI_ENDPOINT &&
                         process.env.AZURE_OPENAI_DEPLOYMENT;
  const hasOpenAI = process.env.OPENAI_API_KEY;

  if (!hasAzureOpenAI && !hasOpenAI) {
    console.error("ERROR: No LLM credentials configured for RAGAS evaluation.");
    console.error("Set either Azure OpenAI (AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT)");
    console.error("or direct OpenAI (OPENAI_API_KEY) in .env");
    process.exit(1);
  }

  if (hasAzureOpenAI) {
    console.log("Using Azure OpenAI for RAGAS evaluation");
  } else {
    console.log("Using OpenAI for RAGAS evaluation");
  }

  const { topic, type, limit, dryRun } = parseArgs();

  // Initialize Langfuse
  const langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
  });

  // Filter queries
  let queries = GOLDEN_QUERIES;

  if (topic) {
    queries = queries.filter((q) => q.topic === topic);
    console.log(`Filtered by topic: ${topic}`);
  }
  if (type) {
    queries = queries.filter((q) => q.type === type);
    console.log(`Filtered by type: ${type}`);
  }
  if (limit) {
    queries = queries.slice(0, limit);
    console.log(`Limited to first ${limit} queries`);
  }

  console.log(`\nEvaluating ${queries.length} queries...\n`);

  if (dryRun) {
    console.log("DRY RUN - queries that would be evaluated:");
    for (const q of queries) {
      console.log(`  [${q.id}] ${q.query.substring(0, 60)}...`);
    }
    console.log("\nRun without --dry-run to execute evaluation.");
    process.exit(0);
  }

  // Run evaluations
  const results: EvalResult[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`[${i + 1}/${queries.length}] Evaluating "${query.id}"...`);

    const result = await evaluateQuery(query, langfuse);
    if (result) {
      results.push(result);
    }

    // Small delay to avoid rate limits
    if (i < queries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Flush Langfuse
  await langfuse.shutdownAsync();

  // Print results and determine exit code
  const shouldFail = printResults(results);

  console.log("\nResults logged to Langfuse.");

  // Exit with error code if metrics are below thresholds
  if (shouldFail) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
