/**
 * Verify data in Supabase
 */

import { supabase, isDbConfigured } from "../lib/db.js";

async function verify() {
  if (!isDbConfigured()) {
    console.error("Supabase not configured");
    process.exit(1);
  }

  console.log("=== DATABASE VERIFICATION ===\n");

  // Count episodes
  const { count: episodeCount } = await supabase
    .from("episodes")
    .select("*", { count: "exact", head: true });

  console.log(`Episodes: ${episodeCount}`);

  // Count segments
  const { count: segmentCount } = await supabase
    .from("segments")
    .select("*", { count: "exact", head: true });

  console.log(`Segments: ${segmentCount}`);

  // Get episodes list
  const { data: episodes } = await supabase
    .from("episodes")
    .select("guest_slug, title")
    .order("created_at");

  if (episodes && episodes.length > 0) {
    console.log("\nEpisodes in DB:");
    for (const ep of episodes) {
      console.log(`  - ${ep.guest_slug}: ${ep.title?.slice(0, 50)}...`);
    }
  }

  // Sample segment with extraction
  const { data: sample } = await supabase
    .from("segments")
    .select("segment_key, speaker, claims, frameworks, advice, references")
    .limit(1)
    .single();

  if (sample) {
    console.log("\nSample segment:");
    console.log(`  Key: ${sample.segment_key}`);
    console.log(`  Speaker: ${sample.speaker}`);
    console.log(`  Claims: ${(sample.claims as any[])?.length || 0}`);
    console.log(`  Frameworks: ${(sample.frameworks as any[])?.length || 0}`);
    console.log(`  Advice: ${(sample.advice as any[])?.length || 0}`);
    console.log(`  References: ${(sample.references as any[])?.length || 0}`);
  }

  // Aggregate stats
  const { data: allSegments } = await supabase
    .from("segments")
    .select("claims, frameworks, advice, stories, references");

  if (allSegments) {
    let totalClaims = 0;
    let totalFrameworks = 0;
    let totalAdvice = 0;
    let totalStories = 0;
    let totalRefs = 0;

    for (const seg of allSegments) {
      totalClaims += (seg.claims as any[])?.length || 0;
      totalFrameworks += (seg.frameworks as any[])?.length || 0;
      totalAdvice += (seg.advice as any[])?.length || 0;
      totalStories += (seg.stories as any[])?.length || 0;
      totalRefs += (seg.references as any[])?.length || 0;
    }

    console.log("\nAggregated extraction stats:");
    console.log(`  Total claims: ${totalClaims}`);
    console.log(`  Total frameworks: ${totalFrameworks}`);
    console.log(`  Total advice: ${totalAdvice}`);
    console.log(`  Total stories: ${totalStories}`);
    console.log(`  Total references: ${totalRefs}`);
  }

  console.log("\n✓ Database verification complete");
}

verify().catch(console.error);
