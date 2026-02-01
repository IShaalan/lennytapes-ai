/**
 * Annotate Search Results
 *
 * This script runs hybrid search for each query in the golden dataset
 * and links the results to Langfuse for annotation.
 *
 * The annotation workflow:
 * 1. Run search for each query
 * 2. Log results as Langfuse traces
 * 3. Link traces to dataset items
 * 4. Use Langfuse UI to review and annotate relevance
 *
 * Run with: npx tsx scripts/annotate-search-results.ts
 * Options:
 *   --algorithm=hybrid|semantic  (default: hybrid)
 *   --limit=10                   (results per query, default: 20)
 *   --query=<id>                 (run for specific query only)
 */

import { Langfuse } from "langfuse";
import { config } from "dotenv";
import { search, type SearchResult } from "../lib/search";
import { GOLDEN_QUERIES, type GoldenQuery } from "../data/golden-queries";

config();

const DATASET_NAME = "search-golden-dataset";

interface SearchTraceResult {
  queryId: string;
  query: string;
  algorithm: string;
  results: Array<{
    id: string;
    text: string;
    guest: string;
    guestSlug: string;
    episodeTitle: string;
    timestamp: string;
    similarity: number;
    semanticSimilarity?: number;
    keywordRank?: number;
    combinedScore?: number;
  }>;
  duration: number;
}

function parseArgs(): { algorithm: "hybrid" | "semantic"; limit: number; queryId?: string } {
  const args = process.argv.slice(2);
  let algorithm: "hybrid" | "semantic" = "hybrid";
  let limit = 20;
  let queryId: string | undefined;

  for (const arg of args) {
    if (arg.startsWith("--algorithm=")) {
      const val = arg.split("=")[1];
      if (val === "semantic" || val === "hybrid") {
        algorithm = val;
      }
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10) || 20;
    } else if (arg.startsWith("--query=")) {
      queryId = arg.split("=")[1];
    }
  }

  return { algorithm, limit, queryId };
}

async function runSearchForQuery(
  goldenQuery: GoldenQuery,
  algorithm: "hybrid" | "semantic",
  limit: number
): Promise<SearchTraceResult> {
  const start = Date.now();

  const results = await search(goldenQuery.query, {
    limit,
    semanticOnly: algorithm === "semantic",
  });

  const duration = Date.now() - start;

  return {
    queryId: goldenQuery.id,
    query: goldenQuery.query,
    algorithm,
    results: results.map((r: SearchResult) => ({
      id: r.id,
      text: r.text.slice(0, 500), // Truncate for readability
      guest: r.guest,
      guestSlug: r.guestSlug,
      episodeTitle: r.episodeTitle,
      timestamp: r.timestamp,
      similarity: r.similarity,
      semanticSimilarity: r.semanticSimilarity,
      keywordRank: r.keywordRank,
      combinedScore: r.combinedScore,
    })),
    duration,
  };
}

function checkKeywordMatches(
  results: SearchTraceResult["results"],
  keywords: string[]
): { total: number; inTop5: number; inTop10: number } {
  let total = 0;
  let inTop5 = 0;
  let inTop10 = 0;

  results.forEach((r, idx) => {
    const text = r.text.toLowerCase();
    const hasKeyword = keywords.some((kw) => text.includes(kw.toLowerCase()));
    if (hasKeyword) {
      total++;
      if (idx < 5) inTop5++;
      if (idx < 10) inTop10++;
    }
  });

  return { total, inTop5, inTop10 };
}

async function main() {
  // Validate environment
  if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
    console.error("ERROR: Langfuse credentials not configured.");
    console.error("Set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY in .env");
    process.exit(1);
  }

  const { algorithm, limit, queryId } = parseArgs();

  console.log("=== ANNOTATING SEARCH RESULTS ===\n");
  console.log(`Algorithm: ${algorithm}`);
  console.log(`Results per query: ${limit}`);
  if (queryId) {
    console.log(`Query filter: ${queryId}`);
  }
  console.log("");

  const langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
  });

  // Get the dataset
  let dataset;
  try {
    dataset = await langfuse.getDataset(DATASET_NAME);
  } catch {
    console.error(`ERROR: Dataset "${DATASET_NAME}" not found.`);
    console.error("Run 'npx tsx scripts/seed-golden-dataset.ts' first.");
    process.exit(1);
  }

  // Filter queries if specific ID provided
  const queries = queryId
    ? GOLDEN_QUERIES.filter((q) => q.id === queryId)
    : GOLDEN_QUERIES;

  if (queries.length === 0) {
    console.error(`No queries found${queryId ? ` with ID "${queryId}"` : ""}`);
    process.exit(1);
  }

  console.log(`Processing ${queries.length} queries...\n`);

  let processed = 0;
  let errors = 0;

  for (const goldenQuery of queries) {
    try {
      console.log(`[${goldenQuery.id}] "${goldenQuery.query.slice(0, 50)}..."`);

      // Run search
      const searchResult = await runSearchForQuery(goldenQuery, algorithm, limit);

      // Check keyword matches if applicable
      const keywordStats = goldenQuery.mustIncludeKeywords
        ? checkKeywordMatches(searchResult.results, goldenQuery.mustIncludeKeywords)
        : null;

      // Create Langfuse trace
      const trace = langfuse.trace({
        name: `search-annotation-${algorithm}`,
        input: { query: goldenQuery.query },
        output: searchResult,
        metadata: {
          queryId: goldenQuery.id,
          algorithm,
          type: goldenQuery.type,
          topic: goldenQuery.topic,
          difficulty: goldenQuery.difficulty,
          expectedOutcome: goldenQuery.expectedOutcome,
          resultCount: searchResult.results.length,
          duration: searchResult.duration,
          keywordMatches: keywordStats,
        },
      });

      // Log the search as a generation/span
      trace.generation({
        name: `${algorithm}-search`,
        model: "hybrid_search_v2",
        input: { query: goldenQuery.query, limit },
        output: {
          results: searchResult.results.map((r) => ({
            id: r.id,
            guest: r.guest,
            similarity: r.similarity,
            combinedScore: r.combinedScore,
          })),
        },
        metadata: {
          algorithm,
          duration: searchResult.duration,
        },
      });

      // Find the dataset item for this query
      const datasetItems = (dataset as any).items || [];
      const datasetItem = datasetItems.find((item: any) => {
        return (
          item.metadata &&
          typeof item.metadata === "object" &&
          "queryId" in item.metadata &&
          item.metadata.queryId === goldenQuery.id
        );
      });

      if (datasetItem) {
        // Link trace to dataset item
        await langfuse.createDatasetRunItem({
          runName: `search-annotation-${algorithm}-${new Date().toISOString().split("T")[0]}`,
          datasetItemId: datasetItem.id,
          traceId: trace.id,
          metadata: {
            algorithm,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Print summary
      const topGuests = [...new Set(searchResult.results.slice(0, 5).map((r) => r.guest))];
      console.log(`  → ${searchResult.results.length} results in ${searchResult.duration}ms`);
      console.log(`  → Top guests: ${topGuests.join(", ") || "none"}`);
      if (keywordStats) {
        console.log(
          `  → Keyword matches: ${keywordStats.total} total, ${keywordStats.inTop5} in top 5`
        );
      }

      processed++;

      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error: any) {
      console.error(`  ✗ Error: ${error.message}`);
      errors++;
    }
  }

  // Flush to ensure all events are sent
  await langfuse.shutdownAsync();

  console.log("\n=== SUMMARY ===");
  console.log(`Processed: ${processed} queries`);
  console.log(`Errors: ${errors}`);
  console.log("\nNext steps:");
  console.log("  1. Open Langfuse dashboard");
  console.log(`  2. Go to Datasets → ${DATASET_NAME}`);
  console.log("  3. Review search results and annotate relevance");
  console.log("  4. Run 'npx tsx scripts/evaluate-search.ts' to calculate metrics");
}

main().catch(console.error);
