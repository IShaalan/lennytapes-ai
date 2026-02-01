/**
 * Generate embeddings for all segments in Supabase
 *
 * This script:
 * 1. Fetches segments without embeddings from Supabase
 * 2. Generates embeddings using Gemini (or OpenAI fallback)
 * 3. Updates segments with embeddings
 * 4. Tracks progress and handles errors
 */

import { supabase, isDbConfigured } from "../lib/db.js";
import { generateEmbedding } from "../lib/llm.js";
import { LLM } from "../lib/config.js";

interface Segment {
  id: string;
  text: string;
  segment_key: string;
  claims: Array<{ text: string }>;
  frameworks: Array<{ name: string; description: string }>;
  advice: Array<{ text: string }>;
}

// Create embedding text that captures the key information
function createEmbeddingText(segment: Segment): string {
  const parts: string[] = [];

  // Main text
  parts.push(segment.text);

  // Add claims for semantic richness
  if (segment.claims && segment.claims.length > 0) {
    parts.push("Key claims: " + segment.claims.map((c) => c.text).join("; "));
  }

  // Add frameworks
  if (segment.frameworks && segment.frameworks.length > 0) {
    parts.push(
      "Frameworks discussed: " +
        segment.frameworks.map((f) => `${f.name}: ${f.description}`).join("; ")
    );
  }

  // Add advice
  if (segment.advice && segment.advice.length > 0) {
    parts.push("Advice given: " + segment.advice.map((a) => a.text).join("; "));
  }

  return parts.join("\n\n");
}

async function getSegmentsWithoutEmbeddings(
  limit: number = 100
): Promise<Segment[]> {
  const { data, error } = await supabase
    .from("segments")
    .select("id, text, segment_key, claims, frameworks, advice")
    .is("embedding", null)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch segments: ${error.message}`);
  }

  return data || [];
}

async function updateSegmentEmbedding(
  id: string,
  embedding: number[]
): Promise<void> {
  const { error } = await supabase
    .from("segments")
    .update({ embedding })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update segment ${id}: ${error.message}`);
  }
}

async function getTotalCounts(): Promise<{
  total: number;
  withEmbedding: number;
  withoutEmbedding: number;
}> {
  const { count: total } = await supabase
    .from("segments")
    .select("*", { count: "exact", head: true });

  const { count: withEmbedding } = await supabase
    .from("segments")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  return {
    total: total || 0,
    withEmbedding: withEmbedding || 0,
    withoutEmbedding: (total || 0) - (withEmbedding || 0),
  };
}

async function main() {
  if (!isDbConfigured()) {
    console.error("Supabase credentials not configured in .env");
    process.exit(1);
  }

  console.log("=== EMBEDDING GENERATION ===");
  console.log(`Model: ${LLM.embeddingModel}`);
  console.log(`Dimensions: ${LLM.embeddingDimensions}`);
  console.log();

  // Get initial counts
  const initialCounts = await getTotalCounts();
  console.log(`Total segments: ${initialCounts.total}`);
  console.log(`Already embedded: ${initialCounts.withEmbedding}`);
  console.log(`To process: ${initialCounts.withoutEmbedding}`);
  console.log();

  if (initialCounts.withoutEmbedding === 0) {
    console.log("All segments already have embeddings!");
    return;
  }

  let processed = 0;
  let failed = 0;
  const startTime = Date.now();
  const batchSize = 50;

  // Process in batches
  while (true) {
    const segments = await getSegmentsWithoutEmbeddings(batchSize);

    if (segments.length === 0) {
      break;
    }

    for (const segment of segments) {
      try {
        // Create rich embedding text
        const embeddingText = createEmbeddingText(segment);

        // Generate embedding
        const embedding = await generateEmbedding(embeddingText);

        // Verify dimensions
        if (embedding.length !== LLM.embeddingDimensions) {
          throw new Error(
            `Dimension mismatch: got ${embedding.length}, expected ${LLM.embeddingDimensions}`
          );
        }

        // Update in database
        await updateSegmentEmbedding(segment.id, embedding);

        processed++;

        // Progress update every 10 segments
        if (processed % 10 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = processed / elapsed;
          const remaining = initialCounts.withoutEmbedding - processed;
          const eta = remaining / rate;

          console.log(
            `[${processed}/${initialCounts.withoutEmbedding}] ` +
              `${segment.segment_key} | ` +
              `${rate.toFixed(1)}/s | ` +
              `ETA: ${Math.round(eta / 60)}m`
          );
        }
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Failed ${segment.segment_key}: ${errorMsg.slice(0, 100)}`);

        // If we get too many consecutive failures, stop
        if (failed > 10) {
          console.error("Too many failures, stopping...");
          break;
        }
      }

      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Check if we should stop due to failures
    if (failed > 10) {
      break;
    }
  }

  // Final summary
  const elapsed = (Date.now() - startTime) / 1000;
  console.log();
  console.log("=== COMPLETE ===");
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Time: ${Math.round(elapsed / 60)}m ${Math.round(elapsed % 60)}s`);
  console.log(`Rate: ${(processed / elapsed).toFixed(1)} segments/second`);

  // Verify final counts
  const finalCounts = await getTotalCounts();
  console.log();
  console.log(`Total embedded: ${finalCounts.withEmbedding}/${finalCounts.total}`);

  if (finalCounts.withoutEmbedding > 0) {
    console.log(`\nRemaining without embeddings: ${finalCounts.withoutEmbedding}`);
    console.log("Run 'npm run embed' again to continue.");
  }
}

main().catch(console.error);
