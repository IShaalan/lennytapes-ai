/**
 * Test different thresholds with SAME embedding
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

  // Generate embedding ONCE
  console.log('Generating embedding...');
  const embedding = await generateEmbedding(query);
  console.log('Done. Length:', embedding.length);
  console.log('First 5 values:', embedding.slice(0, 5).map(v => v.toFixed(8)));
  console.log('Sum:', embedding.reduce((a, b) => a + b, 0).toFixed(8));

  // Test different match_counts to check if IVFFlat index is the issue
  for (const count of [10, 50, 100, 500, 1000]) {
    console.log(`\n=== MATCH_COUNT ${count} ===`);

    const { data: results, error } = await supabase.rpc('match_segments', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: count,
    });

    if (error) {
      console.log('Error:', error.message);
      continue;
    }

    console.log(`Results: ${results?.length || 0}`);
    if (results && results.length > 0) {
      results.slice(0, 5).forEach((r: any, i: number) => {
        const hasOnboarding = r.text?.toLowerCase().includes('onboarding');
        console.log(`  #${i+1}: sim=${r.similarity?.toFixed(4)} ${hasOnboarding ? '✓ ONBOARDING' : ''}`);
      });
    }
  }
}

main().catch(console.error);
