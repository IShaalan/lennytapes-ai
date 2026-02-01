/**
 * Test if embedding generation is consistent
 */
import { config } from 'dotenv';
config();

async function main() {
  const { generateEmbedding } = await import('../lib/llm');

  const query = "I'm building an onboarding flow";

  console.log('Generating embedding twice for same query...\n');

  const emb1 = await generateEmbedding(query);
  console.log('Embedding 1 first 10 values:', emb1.slice(0, 10).map(v => v.toFixed(6)));

  const emb2 = await generateEmbedding(query);
  console.log('Embedding 2 first 10 values:', emb2.slice(0, 10).map(v => v.toFixed(6)));

  // Check if they're the same
  let same = true;
  let maxDiff = 0;
  for (let i = 0; i < emb1.length; i++) {
    const diff = Math.abs(emb1[i] - emb2[i]);
    if (diff > maxDiff) maxDiff = diff;
    if (diff > 0.0001) same = false;
  }

  console.log('\nAre embeddings identical?', same);
  console.log('Max difference:', maxDiff.toFixed(10));
}

main().catch(console.error);
