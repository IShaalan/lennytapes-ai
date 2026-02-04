import { generateText, generateObject, embed, embedMany, CoreMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { config } from "dotenv";
import { z } from "zod";
import { LLM, LANGFUSE } from "./config";

config();

// ============ LANGFUSE SETUP ============

let langfuse: any = null;

async function initLangfuse() {
  if (!LANGFUSE.enabled || langfuse) return;

  try {
    const { Langfuse } = await import("langfuse");
    langfuse = new Langfuse({
      secretKey: LANGFUSE.secretKey,
      publicKey: LANGFUSE.publicKey,
      baseUrl: LANGFUSE.baseUrl,
    });
    console.log("[Langfuse] Initialized successfully");
  } catch (error) {
    console.warn("[Langfuse] Failed to initialize:", error);
  }
}

// Initialize Langfuse on module load
initLangfuse();

// Flush Langfuse on process exit
if (typeof process !== "undefined") {
  process.on("beforeExit", async () => {
    if (langfuse) {
      await langfuse.shutdownAsync();
    }
  });
}

// ============ RETRY CONFIGURATION ============

const RETRY_CONFIG = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

// ============ PROVIDER SETUP ============

const google = process.env.GEMINI_API_KEY
  ? createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Provider configurations in fallback order
const providers = [
  {
    name: "gemini",
    available: () => Boolean(google),
    model: () => google!(LLM.model),
  },
  {
    name: "openai",
    available: () => Boolean(openai),
    model: () => openai!("gpt-4o-mini"),
  },
];

// ============ ERROR HANDLING ============

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("quota") ||
      message.includes("too many requests") ||
      message.includes("resource exhausted") ||
      message.includes("exceeded")
    );
  }
  return false;
}

function isRetryableError(error: unknown): boolean {
  if (isRateLimitError(error)) return true;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("socket") ||
      message.includes("503") ||
      message.includes("502")
    );
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | undefined;
  let delay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(error) || attempt === RETRY_CONFIG.maxRetries) {
        throw lastError;
      }

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      const waitTime = Math.min(delay + jitter, RETRY_CONFIG.maxDelayMs);

      console.warn(
        `[${context}] ${isRateLimitError(error) ? "Rate limited" : "Retryable error"}, ` +
          `attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}, waiting ${Math.round(waitTime / 1000)}s...`
      );

      await sleep(waitTime);
      delay *= RETRY_CONFIG.backoffMultiplier;
    }
  }

  throw lastError;
}

// ============ LANGFUSE TRACING ============

// Store for request-scoped traces (to group operations under one trace)
const traceStore = new Map<string, any>();

/**
 * Get or create a trace for a request.
 * Pass a traceId to group multiple LLM calls under one trace.
 */
export function getOrCreateTrace(options: {
  traceId?: string;
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}): { trace: any; traceId: string } | null {
  if (!langfuse) return null;

  const traceId = options.traceId || crypto.randomUUID();

  // Return existing trace if we have one
  if (traceStore.has(traceId)) {
    return { trace: traceStore.get(traceId), traceId };
  }

  // Create new trace
  const trace = langfuse.trace({
    id: traceId,
    name: options.name,
    userId: options.userId,
    sessionId: options.sessionId,
    metadata: options.metadata,
  });

  traceStore.set(traceId, trace);

  // Clean up after 5 minutes to prevent memory leaks
  setTimeout(() => traceStore.delete(traceId), 5 * 60 * 1000);

  return { trace, traceId };
}

/**
 * End a trace (call when request completes)
 */
export function endTrace(traceId: string) {
  traceStore.delete(traceId);
}

interface GenerationOptions {
  name: string;
  model: string;
  input: any;
  metadata?: Record<string, any>;
  traceId?: string; // Optional: group under existing trace
  userId?: string;
  sessionId?: string;
}

function createGeneration(options: GenerationOptions) {
  if (!langfuse) return null;

  // If traceId provided, try to use existing trace
  let trace: any;
  if (options.traceId && traceStore.has(options.traceId)) {
    trace = traceStore.get(options.traceId);
  } else {
    // Create a standalone generation (no parent trace wrapper)
    // This avoids the double-entry problem
    const generation = langfuse.generation({
      name: options.name,
      model: options.model,
      input: options.input,
      metadata: options.metadata,
    });
    return { generation, trace: null };
  }

  // Create generation under existing trace
  const generation = trace.generation({
    name: options.name,
    model: options.model,
    input: options.input,
    metadata: options.metadata,
  });

  return { trace, generation };
}

function endGeneration(
  gen: { trace: any; generation: any } | null,
  output: any,
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
  error?: Error
) {
  if (!gen) return;

  if (error) {
    gen.generation.end({
      output: null,
      statusMessage: error.message,
      level: "ERROR",
    });
  } else {
    gen.generation.end({
      output,
      usage: usage ? {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      } : undefined,
    });
  }
}

// ============ TEXT GENERATION ============

export async function llmGenerate(
  messages: CoreMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
    traceId?: string; // Group under existing trace
  }
): Promise<string> {
  const availableProviders = providers.filter((p) => p.available());

  if (availableProviders.length === 0) {
    throw new Error("No LLM providers configured. Set GEMINI_API_KEY or OPENAI_API_KEY.");
  }

  for (const provider of availableProviders) {
    const modelName = provider.name === "gemini" ? LLM.model : "gpt-4o-mini";

    const gen = createGeneration({
      name: "llmGenerate",
      model: modelName,
      input: messages,
      userId: options?.userId,
      sessionId: options?.sessionId,
      traceId: options?.traceId,
      metadata: {
        ...options?.metadata,
        provider: provider.name,
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      },
    });

    try {
      const result = await withRetry(
        () =>
          generateText({
            model: provider.model(),
            messages,
            maxTokens: options?.maxTokens,
            temperature: options?.temperature,
          }),
        `llmGenerate:${provider.name}`
      );

      endGeneration(gen, result.text, {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
        totalTokens: result.usage?.totalTokens,
      });

      return result.text;
    } catch (error) {
      if (isRateLimitError(error)) {
        endGeneration(gen, null, undefined, error instanceof Error ? error : new Error(String(error)));
        console.warn(`${provider.name} exhausted after retries, trying next provider...`);
        continue;
      }
      endGeneration(gen, null, undefined, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  throw new Error("All LLM providers exhausted");
}

// ============ STRUCTURED OUTPUT ============

export async function llmExtract<T>(
  messages: CoreMessage[],
  schema: z.ZodType<T>,
  options?: {
    maxTokens?: number;
    temperature?: number;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
    traceId?: string; // Group under existing trace
  }
): Promise<T> {
  const availableProviders = providers.filter((p) => p.available());

  if (availableProviders.length === 0) {
    throw new Error("No LLM providers configured. Set GEMINI_API_KEY or OPENAI_API_KEY.");
  }

  for (const provider of availableProviders) {
    const modelName = provider.name === "gemini" ? LLM.model : "gpt-4o-mini";

    const gen = createGeneration({
      name: "llmExtract",
      model: modelName,
      input: messages,
      userId: options?.userId,
      sessionId: options?.sessionId,
      traceId: options?.traceId,
      metadata: {
        ...options?.metadata,
        provider: provider.name,
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      },
    });

    try {
      const result = await withRetry(
        () =>
          generateObject({
            model: provider.model(),
            messages,
            schema,
            maxTokens: options?.maxTokens,
            temperature: options?.temperature,
          }),
        `llmExtract:${provider.name}`
      );

      endGeneration(gen, result.object, {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
        totalTokens: result.usage?.totalTokens,
      });

      return result.object;
    } catch (error) {
      if (isRateLimitError(error)) {
        endGeneration(gen, null, undefined, error instanceof Error ? error : new Error(String(error)));
        console.warn(`${provider.name} exhausted after retries, trying next provider...`);
        continue;
      }
      endGeneration(gen, null, undefined, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  throw new Error("All LLM providers exhausted");
}

// ============ EMBEDDINGS ============

export async function generateEmbedding(
  text: string,
  options?: {
    userId?: string;
    sessionId?: string;
    traceId?: string; // Group under existing trace
  }
): Promise<number[]> {
  // Prefer Gemini embeddings
  if (google) {
    const gen = createGeneration({
      name: "generateEmbedding",
      model: LLM.embeddingModel,
      input: text,
      userId: options?.userId,
      sessionId: options?.sessionId,
      traceId: options?.traceId,
      metadata: {
        provider: "gemini",
        dimensions: LLM.embeddingDimensions,
        textLength: text.length,
      },
    });

    try {
      const result = await withRetry(
        () =>
          embed({
            model: google.textEmbeddingModel(LLM.embeddingModel, {
              outputDimensionality: LLM.embeddingDimensions,
            }),
            value: text,
          }),
        "generateEmbedding:gemini"
      );

      endGeneration(gen, `[${result.embedding.length} dimensions]`, {
        totalTokens: result.usage?.tokens,
      });

      return result.embedding;
    } catch (error) {
      endGeneration(gen, null, undefined, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Fallback to OpenAI (1536 is native for text-embedding-3-small)
  if (openai) {
    const gen = createGeneration({
      name: "generateEmbedding",
      model: LLM.fallbackEmbeddingModel,
      input: text,
      userId: options?.userId,
      sessionId: options?.sessionId,
      traceId: options?.traceId,
      metadata: {
        provider: "openai",
        dimensions: LLM.embeddingDimensions,
        textLength: text.length,
      },
    });

    try {
      const result = await withRetry(
        () =>
          embed({
            model: openai.embedding(LLM.fallbackEmbeddingModel, {
              dimensions: LLM.embeddingDimensions,
            }),
            value: text,
          }),
        "generateEmbedding:openai"
      );

      endGeneration(gen, `[${result.embedding.length} dimensions]`, {
        totalTokens: result.usage?.tokens,
      });

      return result.embedding;
    } catch (error) {
      endGeneration(gen, null, undefined, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  throw new Error("No embedding provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.");
}

// Batch embedding generation
export async function generateEmbeddings(
  texts: string[],
  options?: {
    userId?: string;
    sessionId?: string;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<number[][]> {
  const batchSize = 100;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map((text) => generateEmbedding(text, options))
    );
    embeddings.push(...batchEmbeddings);

    options?.onProgress?.(Math.min(i + batchSize, texts.length), texts.length);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < texts.length) {
      await sleep(100);
    }
  }

  return embeddings;
}

// ============ CHAT (for app use) ============

export interface ChatOptions {
  guestSlug: string;
  guestName: string;
  guestProfile: string;
  relevantSegments: string;
  userId?: string;
  sessionId?: string;
}

export async function chat(
  messages: CoreMessage[],
  options: ChatOptions
): Promise<string> {
  const systemPrompt = `You are simulating a conversation with ${options.guestName} based on their appearances on Lenny's Podcast.

STRICT RULES:
1. ONLY express views ${options.guestName} has actually stated in the provided transcript excerpts
2. ALWAYS cite the episode and timestamp for each claim
3. If asked about something they haven't discussed, say:
   "I haven't addressed this specifically on the podcast, but based on my general philosophy..."
4. NEVER fabricate quotes or opinions
5. Stay in character but maintain intellectual honesty

GUEST PROFILE:
${options.guestProfile}

RELEVANT TRANSCRIPT EXCERPTS:
${options.relevantSegments}`;

  const fullMessages: CoreMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  return llmGenerate(fullMessages, {
    temperature: 0.7,
    userId: options.userId,
    sessionId: options.sessionId,
    metadata: {
      feature: "chat",
      guestSlug: options.guestSlug,
    },
  });
}

// ============ RAGAS SCORE HELPERS ============

export interface RagasScoreInput {
  traceId: string;
  faithfulness?: number | null;
  answer_relevancy?: number | null;
  context_precision?: number | null;
}

/**
 * Log RAGAS scores to a Langfuse trace.
 *
 * @param input - The trace ID and RAGAS scores to log
 *
 * @example
 * ```ts
 * await logRagasScores({
 *   traceId: "trace-123",
 *   faithfulness: 0.92,
 *   answer_relevancy: 0.88,
 *   context_precision: 0.75,
 * });
 * ```
 */
export function logRagasScores(input: RagasScoreInput): void {
  if (!langfuse) return;

  const { traceId, faithfulness, answer_relevancy, context_precision } = input;

  if (faithfulness !== null && faithfulness !== undefined) {
    langfuse.score({
      traceId,
      name: "ragas_faithfulness",
      value: faithfulness,
    });
  }

  if (answer_relevancy !== null && answer_relevancy !== undefined) {
    langfuse.score({
      traceId,
      name: "ragas_answer_relevancy",
      value: answer_relevancy,
    });
  }

  if (context_precision !== null && context_precision !== undefined) {
    langfuse.score({
      traceId,
      name: "ragas_context_precision",
      value: context_precision,
    });
  }
}

// ============ EXPORTS ============

export { langfuse };
