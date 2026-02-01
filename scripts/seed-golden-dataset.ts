/**
 * Seed Golden Dataset in Langfuse
 *
 * This script creates a Langfuse dataset and seeds it with queries from golden-queries.ts.
 * The dataset is used for:
 * - Regression testing search quality
 * - Algorithm comparison (semantic vs hybrid)
 * - Metrics tracking (Precision@K, Recall@K, MRR, NDCG)
 *
 * Run with: npx tsx scripts/seed-golden-dataset.ts
 */

import { Langfuse } from "langfuse";
import { config } from "dotenv";
import { GOLDEN_QUERIES, getQueryStats, type GoldenQuery } from "../data/golden-queries";

config();

const DATASET_NAME = "search-golden-dataset";
const DATASET_DESCRIPTION = "Golden dataset for search quality evaluation. Contains queries across multiple types (keyword, semantic, guest-specific, mixed), topics, and difficulty levels.";

async function main() {
  // Validate environment
  if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
    console.error("ERROR: Langfuse credentials not configured.");
    console.error("Set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY in .env");
    process.exit(1);
  }

  const langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
  });

  console.log("=== SEEDING GOLDEN DATASET ===\n");

  // Show statistics
  const stats = getQueryStats();
  console.log("Query Statistics:");
  console.log(`  Total queries: ${stats.total}`);
  console.log("\n  By Type:");
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });
  console.log("\n  By Difficulty:");
  Object.entries(stats.byDifficulty).forEach(([diff, count]) => {
    console.log(`    ${diff}: ${count}`);
  });
  console.log("\n  By Topic:");
  Object.entries(stats.byTopic)
    .sort((a, b) => b[1] - a[1])
    .forEach(([topic, count]) => {
      console.log(`    ${topic}: ${count}`);
    });

  console.log("\n---\n");

  // Create or get the dataset
  console.log(`Creating/getting dataset "${DATASET_NAME}"...`);

  let dataset: any;
  let datasetItems: any[] = [];

  try {
    // Try to get existing dataset first
    dataset = await langfuse.getDataset(DATASET_NAME);
    datasetItems = dataset.items || [];
    console.log(`  Dataset already exists with ${datasetItems.length} items`);
  } catch {
    // Create new dataset
    dataset = await langfuse.createDataset({
      name: DATASET_NAME,
      description: DATASET_DESCRIPTION,
      metadata: {
        version: "1.0",
        createdAt: new Date().toISOString(),
        queryCount: stats.total,
        topics: Object.keys(stats.byTopic),
        types: Object.keys(stats.byType),
      },
    });
    console.log(`  Created new dataset`);
  }

  // Get existing item IDs to avoid duplicates
  const existingIds = new Set<string>();
  for (const item of datasetItems) {
    if (item.metadata && typeof item.metadata === "object" && "queryId" in item.metadata) {
      existingIds.add(item.metadata.queryId as string);
    }
  }
  console.log(`  Found ${existingIds.size} existing items\n`);

  // Seed queries
  let created = 0;
  let skipped = 0;

  for (const query of GOLDEN_QUERIES) {
    // Skip if already exists
    if (existingIds.has(query.id)) {
      console.log(`  ⏭ Skipping "${query.id}" (already exists)`);
      skipped++;
      continue;
    }

    try {
      await langfuse.createDatasetItem({
        datasetName: DATASET_NAME,
        input: {
          query: query.query,
        },
        expectedOutput: {
          // These will be filled during annotation
          relevantSegments: [],
          expectedGuests: query.expectedGuests || [],
        },
        metadata: {
          queryId: query.id,
          type: query.type,
          topic: query.topic,
          difficulty: query.difficulty,
          expectedOutcome: query.expectedOutcome,
          mustIncludeKeywords: query.mustIncludeKeywords || [],
          notes: query.notes || "",
        },
      });

      console.log(`  ✓ Created "${query.id}"`);
      created++;

      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error(`  ✗ Failed to create "${query.id}": ${error.message}`);
    }
  }

  // Flush to ensure all events are sent
  await langfuse.shutdownAsync();

  console.log("\n=== SUMMARY ===");
  console.log(`Created: ${created} items`);
  console.log(`Skipped: ${skipped} items (already existed)`);
  console.log(`Total in dataset: ${created + skipped} items`);
  console.log("\nNext steps:");
  console.log("  1. Run 'npx tsx scripts/annotate-search-results.ts' to generate search results");
  console.log("  2. Review and annotate results in Langfuse dashboard");
  console.log("  3. Run 'npx tsx scripts/evaluate-search.ts' to calculate metrics");
}

main().catch(console.error);
