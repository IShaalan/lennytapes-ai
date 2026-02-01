/**
 * Investigate search relevance - WHERE DO ONBOARDING SEGMENTS RANK?
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function main() {
  const { generateEmbedding } = await import('../lib/llm');

  const query = "I'm building an onboarding flow";
  console.log(`Query: "${query}"\n`);

  // Generate embedding for query
  console.log('Generating embedding...');
  const queryEmbedding = await generateEmbedding(query);
  console.log('Done.');
  console.log('First 5 values:', queryEmbedding.slice(0, 5).map(v => v.toFixed(8)));
  console.log('Sum:', queryEmbedding.reduce((a, b) => a + b, 0).toFixed(8));
  console.log('');

  // Get onboarding segment IDs
  const { data: onboardingSegs } = await supabase
    .from('segments')
    .select('id, text')
    .ilike('text', '%onboarding%')
    .limit(10);

  console.log(`Found ${onboardingSegs?.length || 0} segments containing "onboarding" in text\n`);

  const onboardingIds = new Set(onboardingSegs?.map(s => s.id) || []);

  // Get ALL results without threshold
  console.log('Running semantic search with NO threshold...');
  const { data: allResults } = await supabase.rpc('match_segments', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,
    match_count: 2000,
  });

  console.log(`Total results: ${allResults?.length || 0}\n`);

  // Show top 20 results
  console.log('=== TOP 20 RESULTS ===');
  allResults?.slice(0, 20).forEach((r: any, idx: number) => {
    const hasOnboarding = r.text?.toLowerCase().includes('onboarding');
    const marker = hasOnboarding ? ' ✓ ONBOARDING' : '';
    console.log(`#${String(idx + 1).padStart(2)}: similarity=${r.similarity?.toFixed(4)}${marker}`);
  });

  // Find where onboarding segments rank
  console.log('\n\n=== WHERE DO ACTUAL ONBOARDING SEGMENTS RANK? ===');
  let found = 0;
  allResults?.forEach((r: any, idx: number) => {
    if (onboardingIds.has(r.id)) {
      found++;
      console.log(`\nOnboarding segment #${found} is at rank #${idx + 1}`);
      console.log(`  Similarity: ${r.similarity?.toFixed(4)}`);
      console.log(`  Text: "${r.text?.slice(0, 150)}..."`);
    }
  });

  if (found === 0) {
    console.log('NO onboarding segments found in results!');
  }

  // Summary
  console.log('\n\n=== SUMMARY ===');
  const top20OnboardingCount = allResults?.slice(0, 20).filter((r: any) =>
    r.text?.toLowerCase().includes('onboarding')
  ).length || 0;
  console.log(`Onboarding segments in top 20: ${top20OnboardingCount}`);
  console.log(`Onboarding segments in database: ${onboardingSegs?.length || 0}`);

  const topSimilarity = allResults?.[0]?.similarity?.toFixed(4) || 'N/A';
  console.log(`Top result similarity: ${topSimilarity}`);
}

main().catch(console.error);
