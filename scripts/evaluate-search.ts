/**
 * Evaluate Search Quality
 *
 * This script runs evaluation against the golden dataset and calculates metrics:
 * - Precision@K: % of top K results that are relevant
 * - Recall@K: % of relevant results found in top K
 * - MRR (Mean Reciprocal Rank): 1/rank of first relevant result
 * - NDCG (Normalized Discounted Cumulative Gain): Position-weighted relevance
 *
 * Metrics are logged to Langfuse for tracking over time.
 *
 * Run with: npx tsx scripts/evaluate-search.ts
 * Options:
 *   --algorithm=hybrid|semantic  (default: hybrid)
 *   --compare                    (compare both algorithms)
 *   --topic=<topic>              (filter by topic)
 *   --type=<type>                (filter by query type)
 */

import { Langfuse } from "langfuse";
import { config } from "dotenv";
import { search, type SearchResult } from "../lib/search";
import {
  GOLDEN_QUERIES,
  filterQueries,
  type GoldenQuery,
  type QueryType,
  type Difficulty,
} from "../data/golden-queries";

config();

const DATASET_NAME = "search-golden-dataset";

// Relevance grades (to be annotated in Langfuse)
// For now, we use heuristics based on keywords and expected guests
type RelevanceGrade = "highly_relevant" | "relevant" | "somewhat_relevant" | "not_relevant";

interface EvaluationResult {
  queryId: string;
  query: string;
  type: QueryType;
  topic: string;
  difficulty: Difficulty;
  algorithm: string;

  // Metrics
  precision_at_5: number;
  precision_at_10: number;
  recall_at_10: number;
  mrr: number;
  ndcg_at_10: number;

  // Additional info
  resultCount: number;
  duration: number;
  keywordMatchesTop5: number;
  keywordMatchesTop10: number;
  expectedGuestsFound: number;
  expectedGuestsTotal: number;
}

interface AggregateMetrics {
  mean_precision_at_5: number;
  mean_precision_at_10: number;
  mean_recall_at_10: number;
  mean_mrr: number;
  mean_ndcg_at_10: number;
  count: number;
}

function parseArgs(): {
  algorithm: "hybrid" | "semantic";
  compare: boolean;
  topic?: string;
  type?: QueryType;
} {
  const args = process.argv.slice(2);
  let algorithm: "hybrid" | "semantic" = "hybrid";
  let compare = false;
  let topic: string | undefined;
  let type: QueryType | undefined;

  for (const arg of args) {
    if (arg.startsWith("--algorithm=")) {
      const val = arg.split("=")[1];
      if (val === "semantic" || val === "hybrid") {
        algorithm = val;
      }
    } else if (arg === "--compare") {
      compare = true;
    } else if (arg.startsWith("--topic=")) {
      topic = arg.split("=")[1];
    } else if (arg.startsWith("--type=")) {
      const val = arg.split("=")[1];
      if (["keyword", "semantic", "guest-specific", "mixed"].includes(val)) {
        type = val as QueryType;
      }
    }
  }

  return { algorithm, compare, topic, type };
}

/**
 * Heuristic relevance scoring based on available metadata
 * This is used until manual annotations are available
 */
function estimateRelevance(
  result: SearchResult,
  goldenQuery: GoldenQuery
): { grade: RelevanceGrade; score: number } {
  let score = 0;
  const text = result.text.toLowerCase();

  // Check keyword matches
  if (goldenQuery.mustIncludeKeywords) {
    const keywordMatches = goldenQuery.mustIncludeKeywords.filter((kw) =>
      text.includes(kw.toLowerCase())
    ).length;
    score += (keywordMatches / goldenQuery.mustIncludeKeywords.length) * 0.4;
  } else {
    // No specific keywords, use topic match heuristic
    if (text.includes(goldenQuery.topic)) {
      score += 0.3;
    }
  }

  // Check expected guests
  if (goldenQuery.expectedGuests) {
    const guestMatch = goldenQuery.expectedGuests.some((g) =>
      result.guest.toLowerCase().includes(g.toLowerCase())
    );
    if (guestMatch) {
      score += 0.4;
    }
  }

  // Use semantic similarity as a proxy for relevance
  if (result.similarity > 0.7) {
    score += 0.3;
  } else if (result.similarity > 0.5) {
    score += 0.2;
  } else if (result.similarity > 0.3) {
    score += 0.1;
  }

  // Determine grade
  let grade: RelevanceGrade;
  if (score >= 0.7) {
    grade = "highly_relevant";
  } else if (score >= 0.5) {
    grade = "relevant";
  } else if (score >= 0.3) {
    grade = "somewhat_relevant";
  } else {
    grade = "not_relevant";
  }

  return { grade, score: Math.min(score, 1) };
}

/**
 * Calculate Precision@K
 */
function calculatePrecision(
  results: SearchResult[],
  goldenQuery: GoldenQuery,
  k: number
): number {
  const topK = results.slice(0, k);
  if (topK.length === 0) return 0;

  const relevant = topK.filter((r) => {
    const { grade } = estimateRelevance(r, goldenQuery);
    return grade === "highly_relevant" || grade === "relevant";
  });

  return relevant.length / k;
}

/**
 * Calculate Recall@K (assuming all keyword/guest matches are relevant)
 */
function calculateRecall(
  results: SearchResult[],
  goldenQuery: GoldenQuery,
  k: number
): number {
  // Estimate total relevant (this would come from annotations)
  // For now, use a heuristic based on expected outcome
  const estimatedRelevant =
    goldenQuery.expectedOutcome === "single-expert" ? 3 : 10;

  const topK = results.slice(0, k);
  const foundRelevant = topK.filter((r) => {
    const { grade } = estimateRelevance(r, goldenQuery);
    return grade === "highly_relevant" || grade === "relevant";
  }).length;

  return Math.min(foundRelevant / estimatedRelevant, 1);
}

/**
 * Calculate MRR (Mean Reciprocal Rank)
 */
function calculateMRR(results: SearchResult[], goldenQuery: GoldenQuery): number {
  for (let i = 0; i < results.length; i++) {
    const { grade } = estimateRelevance(results[i], goldenQuery);
    if (grade === "highly_relevant" || grade === "relevant") {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Calculate NDCG@K (Normalized Discounted Cumulative Gain)
 */
function calculateNDCG(
  results: SearchResult[],
  goldenQuery: GoldenQuery,
  k: number
): number {
  const topK = results.slice(0, k);

  // Calculate DCG
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const { score } = estimateRelevance(topK[i], goldenQuery);
    dcg += score / Math.log2(i + 2); // i+2 because log2(1) = 0
  }

  // Calculate ideal DCG (all relevant at top)
  const idealScores = topK
    .map((r) => estimateRelevance(r, goldenQuery).score)
    .sort((a, b) => b - a);

  let idcg = 0;
  for (let i = 0; i < idealScores.length; i++) {
    idcg += idealScores[i] / Math.log2(i + 2);
  }

  if (idcg === 0) return 0;
  return dcg / idcg;
}

/**
 * Evaluate a single query
 */
async function evaluateQuery(
  goldenQuery: GoldenQuery,
  algorithm: "hybrid" | "semantic"
): Promise<EvaluationResult> {
  const start = Date.now();

  const results = await search(goldenQuery.query, {
    limit: 20,
    semanticOnly: algorithm === "semantic",
  });

  const duration = Date.now() - start;

  // Calculate keyword matches
  let keywordMatchesTop5 = 0;
  let keywordMatchesTop10 = 0;

  if (goldenQuery.mustIncludeKeywords) {
    results.slice(0, 10).forEach((r, idx) => {
      const text = r.text.toLowerCase();
      const hasMatch = goldenQuery.mustIncludeKeywords!.some((kw) =>
        text.includes(kw.toLowerCase())
      );
      if (hasMatch) {
        if (idx < 5) keywordMatchesTop5++;
        keywordMatchesTop10++;
      }
    });
  }

  // Calculate expected guests found
  let expectedGuestsFound = 0;
  const expectedGuestsTotal = goldenQuery.expectedGuests?.length || 0;
  if (goldenQuery.expectedGuests) {
    const foundGuests = new Set(results.slice(0, 10).map((r) => r.guest.toLowerCase()));
    expectedGuestsFound = goldenQuery.expectedGuests.filter((g) =>
      foundGuests.has(g.toLowerCase())
    ).length;
  }

  return {
    queryId: goldenQuery.id,
    query: goldenQuery.query,
    type: goldenQuery.type,
    topic: goldenQuery.topic,
    difficulty: goldenQuery.difficulty,
    algorithm,

    precision_at_5: calculatePrecision(results, goldenQuery, 5),
    precision_at_10: calculatePrecision(results, goldenQuery, 10),
    recall_at_10: calculateRecall(results, goldenQuery, 10),
    mrr: calculateMRR(results, goldenQuery),
    ndcg_at_10: calculateNDCG(results, goldenQuery, 10),

    resultCount: results.length,
    duration,
    keywordMatchesTop5,
    keywordMatchesTop10,
    expectedGuestsFound,
    expectedGuestsTotal,
  };
}

/**
 * Aggregate metrics from multiple results
 */
function aggregateMetrics(results: EvaluationResult[]): AggregateMetrics {
  if (results.length === 0) {
    return {
      mean_precision_at_5: 0,
      mean_precision_at_10: 0,
      mean_recall_at_10: 0,
      mean_mrr: 0,
      mean_ndcg_at_10: 0,
      count: 0,
    };
  }

  return {
    mean_precision_at_5:
      results.reduce((sum, r) => sum + r.precision_at_5, 0) / results.length,
    mean_precision_at_10:
      results.reduce((sum, r) => sum + r.precision_at_10, 0) / results.length,
    mean_recall_at_10:
      results.reduce((sum, r) => sum + r.recall_at_10, 0) / results.length,
    mean_mrr: results.reduce((sum, r) => sum + r.mrr, 0) / results.length,
    mean_ndcg_at_10:
      results.reduce((sum, r) => sum + r.ndcg_at_10, 0) / results.length,
    count: results.length,
  };
}

/**
 * Group metrics by dimension
 */
function groupMetrics(
  results: EvaluationResult[],
  groupBy: "type" | "topic" | "difficulty"
): Record<string, AggregateMetrics> {
  const groups: Record<string, EvaluationResult[]> = {};

  for (const result of results) {
    const key = result[groupBy];
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(result);
  }

  const aggregated: Record<string, AggregateMetrics> = {};
  for (const [key, groupResults] of Object.entries(groups)) {
    aggregated[key] = aggregateMetrics(groupResults);
  }

  return aggregated;
}

async function main() {
  // Validate environment
  if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
    console.error("ERROR: Langfuse credentials not configured.");
    console.error("Set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY in .env");
    process.exit(1);
  }

  const { algorithm, compare, topic, type } = parseArgs();

  console.log("=== EVALUATING SEARCH QUALITY ===\n");

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

  console.log(`Evaluating ${queries.length} queries...\n`);

  const algorithms: Array<"hybrid" | "semantic"> = compare
    ? ["hybrid", "semantic"]
    : [algorithm];

  for (const algo of algorithms) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`ALGORITHM: ${algo.toUpperCase()}`);
    console.log("=".repeat(60));

    const results: EvaluationResult[] = [];

    for (const goldenQuery of queries) {
      try {
        process.stdout.write(`  [${goldenQuery.id}] `);
        const result = await evaluateQuery(goldenQuery, algo);
        results.push(result);

        // Log to Langfuse
        const trace = langfuse.trace({
          name: `search-eval-${algo}`,
          input: { query: goldenQuery.query },
          metadata: {
            queryId: goldenQuery.id,
            algorithm: algo,
            type: goldenQuery.type,
            topic: goldenQuery.topic,
            difficulty: goldenQuery.difficulty,
          },
        });

        trace.score({ name: "precision@5", value: result.precision_at_5 });
        trace.score({ name: "precision@10", value: result.precision_at_10 });
        trace.score({ name: "recall@10", value: result.recall_at_10 });
        trace.score({ name: "mrr", value: result.mrr });
        trace.score({ name: "ndcg@10", value: result.ndcg_at_10 });

        console.log(
          `P@5=${result.precision_at_5.toFixed(2)} MRR=${result.mrr.toFixed(2)} (${result.duration}ms)`
        );

        // Small delay
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        console.log(`ERROR: ${error.message}`);
      }
    }

    // Calculate aggregate metrics
    const overall = aggregateMetrics(results);
    const byType = groupMetrics(results, "type");
    const byTopic = groupMetrics(results, "topic");
    const byDifficulty = groupMetrics(results, "difficulty");

    // Print summary
    console.log("\n--- OVERALL METRICS ---");
    console.log(`Queries evaluated: ${overall.count}`);
    console.log(`Mean Precision@5:  ${overall.mean_precision_at_5.toFixed(3)}`);
    console.log(`Mean Precision@10: ${overall.mean_precision_at_10.toFixed(3)}`);
    console.log(`Mean Recall@10:    ${overall.mean_recall_at_10.toFixed(3)}`);
    console.log(`Mean MRR:          ${overall.mean_mrr.toFixed(3)}`);
    console.log(`Mean NDCG@10:      ${overall.mean_ndcg_at_10.toFixed(3)}`);

    console.log("\n--- BY QUERY TYPE ---");
    for (const [qtype, metrics] of Object.entries(byType)) {
      console.log(
        `  ${qtype.padEnd(15)} P@5=${metrics.mean_precision_at_5.toFixed(2)} MRR=${metrics.mean_mrr.toFixed(2)} (n=${metrics.count})`
      );
    }

    console.log("\n--- BY DIFFICULTY ---");
    for (const [diff, metrics] of Object.entries(byDifficulty)) {
      console.log(
        `  ${diff.padEnd(10)} P@5=${metrics.mean_precision_at_5.toFixed(2)} MRR=${metrics.mean_mrr.toFixed(2)} (n=${metrics.count})`
      );
    }

    // Log aggregate metrics to Langfuse
    const aggregateTrace = langfuse.trace({
      name: `search-eval-aggregate-${algo}`,
      metadata: {
        algorithm: algo,
        timestamp: new Date().toISOString(),
        queryCount: overall.count,
      },
    });

    aggregateTrace.score({ name: "overall_precision@5", value: overall.mean_precision_at_5 });
    aggregateTrace.score({ name: "overall_mrr", value: overall.mean_mrr });
    aggregateTrace.score({ name: "overall_ndcg@10", value: overall.mean_ndcg_at_10 });
  }

  // Flush to ensure all events are sent
  await langfuse.shutdownAsync();

  console.log("\n=== DONE ===");
  console.log("Results logged to Langfuse for tracking over time.");
}

main().catch(console.error);
