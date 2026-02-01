/**
 * Test hybrid search vs semantic-only search
 *
 * This script compares results between:
 * - Legacy match_segments (semantic only)
 * - New hybrid_search (semantic + keyword)
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config();

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

interface TestCase {
  name: string;
  query: string;
  expectedKeywords: string[];
}

const testCases: TestCase[] = [
  {
    name: "Keyword-heavy: onboarding",
    query: "I'm building an onboarding flow",
    expectedKeywords: ["onboarding"],
  },
  {
    name: "Keyword-heavy: specific guest",
    query: "What does Adam Fishman think about growth?",
    expectedKeywords: ["adam", "fishman"],
  },
  {
    name: "Semantic: user activation",
    query: "How do I improve user activation and retention?",
    expectedKeywords: ["activation", "retention", "user"],
  },
  {
    name: "Semantic: pricing strategy",
    query: "What's the best approach to pricing my SaaS product?",
    expectedKeywords: ["pricing", "price"],
  },
  {
    name: "Mixed: PMF indicators",
    query: "How do I know if I have product-market fit?",
    expectedKeywords: ["product-market", "pmf", "fit"],
  },
];

async function generateEmbedding(text: string): Promise<number[]> {
  const { generateEmbedding } = await import("../lib/llm");
  return generateEmbedding(text);
}

async function testSemanticSearch(
  query: string,
  embedding: number[],
  matchCount: number = 10
) {
  const start = Date.now();
  const { data, error } = await supabase.rpc("match_segments", {
    query_embedding: embedding,
    match_threshold: 0.0,
    match_count: matchCount,
  });
  const duration = Date.now() - start;

  if (error) {
    return { results: [], error: error.message, duration };
  }

  return { results: data || [], error: null, duration };
}

async function testHybridSearch(
  query: string,
  embedding: number[],
  matchCount: number = 10
) {
  const start = Date.now();
  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: query,
    query_embedding: embedding,
    match_count: matchCount,
    semantic_weight: 0.7,
    keyword_weight: 0.3,
    match_threshold: 0.0,
  });
  const duration = Date.now() - start;

  if (error) {
    // If hybrid_search doesn't exist, return a helpful message
    if (error.message.includes("hybrid_search")) {
      return {
        results: [],
        error: "hybrid_search function not found - run migrate-hybrid-search.sql first",
        duration: 0,
      };
    }
    return { results: [], error: error.message, duration };
  }

  return { results: data || [], error: null, duration };
}

function countKeywordMatches(
  results: any[],
  keywords: string[]
): { total: number; inTop5: number; inTop10: number } {
  let total = 0;
  let inTop5 = 0;
  let inTop10 = 0;

  results.forEach((r: any, idx: number) => {
    const text = (r.text || "").toLowerCase();
    const hasKeyword = keywords.some((kw) => text.includes(kw.toLowerCase()));
    if (hasKeyword) {
      total++;
      if (idx < 5) inTop5++;
      if (idx < 10) inTop10++;
    }
  });

  return { total, inTop5, inTop10 };
}

async function runTest(testCase: TestCase) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${testCase.name}`);
  console.log(`Query: "${testCase.query}"`);
  console.log(`Expected keywords: ${testCase.expectedKeywords.join(", ")}`);
  console.log("=".repeat(60));

  // Generate embedding once
  console.log("\nGenerating embedding...");
  const embedding = await generateEmbedding(testCase.query);

  // Test semantic search
  console.log("\n--- Semantic Search (match_segments) ---");
  const semanticResult = await testSemanticSearch(testCase.query, embedding, 20);

  if (semanticResult.error) {
    console.log(`Error: ${semanticResult.error}`);
  } else {
    const semanticMatches = countKeywordMatches(
      semanticResult.results,
      testCase.expectedKeywords
    );
    console.log(`Duration: ${semanticResult.duration}ms`);
    console.log(`Results: ${semanticResult.results.length}`);
    console.log(
      `Keyword matches - Total: ${semanticMatches.total}, Top 5: ${semanticMatches.inTop5}, Top 10: ${semanticMatches.inTop10}`
    );

    // Show top 5 results
    console.log("\nTop 5 results:");
    semanticResult.results.slice(0, 5).forEach((r: any, idx: number) => {
      const hasKeyword = testCase.expectedKeywords.some((kw) =>
        (r.text || "").toLowerCase().includes(kw.toLowerCase())
      );
      const sim = r.similarity?.toFixed(4) || "N/A";
      console.log(
        `  #${idx + 1}: sim=${sim} ${hasKeyword ? "✓ KEYWORD" : ""}`
      );
    });
  }

  // Test hybrid search
  console.log("\n--- Hybrid Search (hybrid_search) ---");
  const hybridResult = await testHybridSearch(testCase.query, embedding, 20);

  if (hybridResult.error) {
    console.log(`Error: ${hybridResult.error}`);
  } else {
    const hybridMatches = countKeywordMatches(
      hybridResult.results,
      testCase.expectedKeywords
    );
    console.log(`Duration: ${hybridResult.duration}ms`);
    console.log(`Results: ${hybridResult.results.length}`);
    console.log(
      `Keyword matches - Total: ${hybridMatches.total}, Top 5: ${hybridMatches.inTop5}, Top 10: ${hybridMatches.inTop10}`
    );

    // Show top 5 results
    console.log("\nTop 5 results:");
    hybridResult.results.slice(0, 5).forEach((r: any, idx: number) => {
      const hasKeyword = testCase.expectedKeywords.some((kw) =>
        (r.text || "").toLowerCase().includes(kw.toLowerCase())
      );
      const semSim = r.semantic_similarity?.toFixed(4) || "N/A";
      const kwRank = r.keyword_rank?.toFixed(4) || "0";
      const combined = r.combined_score?.toFixed(4) || "N/A";
      console.log(
        `  #${idx + 1}: sem=${semSim} kw=${kwRank} combined=${combined} ${
          hasKeyword ? "✓ KEYWORD" : ""
        }`
      );
    });
  }

  // Compare results
  if (!semanticResult.error && !hybridResult.error) {
    const semanticMatches = countKeywordMatches(
      semanticResult.results,
      testCase.expectedKeywords
    );
    const hybridMatches = countKeywordMatches(
      hybridResult.results,
      testCase.expectedKeywords
    );

    console.log("\n--- Comparison ---");
    const improvement = hybridMatches.inTop5 - semanticMatches.inTop5;
    if (improvement > 0) {
      console.log(
        `✓ Hybrid search found ${improvement} more keyword matches in top 5`
      );
    } else if (improvement < 0) {
      console.log(
        `✗ Hybrid search found ${Math.abs(improvement)} fewer keyword matches in top 5`
      );
    } else {
      console.log("= Same number of keyword matches in top 5");
    }

    const latencyDiff = hybridResult.duration - semanticResult.duration;
    console.log(
      `Latency difference: ${latencyDiff > 0 ? "+" : ""}${latencyDiff}ms`
    );
  }
}

async function main() {
  console.log("Testing Hybrid Search vs Semantic Search");
  console.log("========================================\n");

  // First check if hybrid_search exists
  const { error } = await supabase.rpc("hybrid_search", {
    query_text: "test",
    query_embedding: Array(1536).fill(0),
    match_count: 1,
  });

  if (error?.message.includes("hybrid_search")) {
    console.log("ERROR: hybrid_search function not found in database.");
    console.log("Please run the migration first:");
    console.log("  1. Open Supabase SQL Editor");
    console.log("  2. Run scripts/migrate-hnsw-index.sql");
    console.log("  3. Run scripts/migrate-hybrid-search.sql");
    console.log("  4. Re-run this test");
    process.exit(1);
  }

  for (const testCase of testCases) {
    await runTest(testCase);
  }

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(
    "If hybrid search shows more keyword matches in the top results,"
  );
  console.log("the migration was successful!");
}

main().catch(console.error);
