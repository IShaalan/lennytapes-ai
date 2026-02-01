import { config } from "dotenv";
import { resolve } from "path";

config();

export const APP_CONFIG = {
  name: "LennyTapes",
  tagline: "Search, explore, and pressure-test ideas from Lenny's Podcast",
} as const;

export const PATHS = {
  transcripts: resolve(process.env.TRANSCRIPTS_PATH || "../lennytapes-transcripts"),
  episodes: resolve(process.env.TRANSCRIPTS_PATH || "../lennytapes-transcripts", "episodes"),
  index: resolve(process.env.TRANSCRIPTS_PATH || "../lennytapes-transcripts", "index"),
} as const;

export const EXTRACTION = {
  // How many speaker turns to group into one segment
  turnsPerSegment: 4,

  // Similarity threshold for search (lower = more results, higher = stricter match)
  similarityThreshold: 0.3,

  // How many episodes to process (for testing, set to small number)
  maxEpisodes: process.env.MAX_EPISODES ? parseInt(process.env.MAX_EPISODES) : undefined,

  // Batch size for LLM calls
  batchSize: 5,

  // Delay between segment extractions (ms) - helps avoid rate limits
  // Gemini Flash has ~15 RPM for free tier, ~1000 RPM for paid
  delayBetweenSegmentsMs: process.env.EXTRACTION_DELAY_MS
    ? parseInt(process.env.EXTRACTION_DELAY_MS)
    : 500,
} as const;

export const LLM = {
  // Primary model for generation
  model: "gemini-3-flash-preview",

  // Embedding configuration
  // Using 1536 dimensions - native for OpenAI, configurable for Gemini
  // Both providers work seamlessly at this dimension
  embeddingDimensions: 1536,

  // Primary: Gemini (newer model, configured to 1536)
  embeddingModel: "gemini-embedding-001",

  // Fallback: OpenAI (reduced to 768 for compatibility)
  fallbackEmbeddingModel: "text-embedding-3-small",
} as const;

export const LANGFUSE = {
  enabled: Boolean(
    process.env.LANGFUSE_SECRET_KEY &&
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_BASE_URL
  ),
  // Defaults to true - always use Langfuse prompts
  // Set USE_LANGFUSE_PROMPTS=false to use hardcoded fallbacks only
  usePrompts: process.env.USE_LANGFUSE_PROMPTS !== "false",
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
} as const;
