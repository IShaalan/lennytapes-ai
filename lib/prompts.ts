/**
 * Langfuse Prompt Management
 *
 * All prompts are stored in Langfuse for:
 * - Version control and history
 * - A/B testing different variations
 * - Iterating without code deployments
 * - Observability of prompt performance
 */

import { Langfuse } from "langfuse";
import { LANGFUSE } from "./config";

// Initialize Langfuse client
let langfuseClient: Langfuse | null = null;

// Cache prompts to reduce API calls (5 minute TTL)
const promptCache = new Map<string, { prompt: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getLangfuse(): Langfuse | null {
  if (!LANGFUSE.enabled) return null;

  if (!langfuseClient) {
    langfuseClient = new Langfuse({
      secretKey: LANGFUSE.secretKey!,
      publicKey: LANGFUSE.publicKey!,
      baseUrl: LANGFUSE.baseUrl,
    });
  }

  return langfuseClient;
}

async function getCachedPrompt(langfuse: Langfuse, name: string): Promise<any | null> {
  const cached = promptCache.get(name);
  const now = Date.now();

  // Return cached if still valid
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.prompt;
  }

  // Fetch from Langfuse
  try {
    const prompt = await langfuse.getPrompt(name);
    if (prompt) {
      promptCache.set(name, { prompt, timestamp: now });
      return prompt;
    }
  } catch {
    // Prompt doesn't exist in Langfuse
  }

  return null;
}

// Fallback prompts when Langfuse is not available or prompt doesn't exist
const FALLBACK_PROMPTS: Record<string, string> = {
  "solve-synthesize": `You are an expert advisor synthesizing guidance from multiple product leaders who have appeared on Lenny's Podcast.

USER'S CHALLENGE:
{{problem}}

EXPERT INSIGHTS (from podcast interviews):
{{context}}

Based on these expert perspectives, provide guidance in this structure:
1. KEY INSIGHT: One paragraph summary of the main takeaway
2. FRAMEWORKS: List applicable frameworks/mental models with attribution
3. ACTIONABLE STEPS: 3-5 concrete steps the user can take
4. WHERE EXPERTS DIFFER: Note any disagreements or different approaches

Rules:
- Only reference insights actually present in the provided context
- Always attribute frameworks and key claims to specific guests
- Be practical and actionable
- If experts disagree, present both perspectives fairly`,

  "chat-guest": `You are simulating a conversation with {{guestName}} based on their appearances on Lenny's Podcast.

STRICT RULES:
1. ONLY express views {{guestName}} has actually stated in the provided transcript excerpts
2. ALWAYS cite the episode and timestamp for each claim
3. If asked about something they haven't discussed, say:
   "I haven't addressed this specifically on the podcast, but based on my general philosophy..."
4. NEVER fabricate quotes or opinions
5. Stay in character but maintain intellectual honesty

GUEST PROFILE:
{{guestProfile}}

RELEVANT TRANSCRIPT EXCERPTS:
{{relevantSegments}}`,

  "extract-segment": `You are an expert at extracting structured insights from podcast transcripts.

Analyze this transcript segment and extract:

1. **Claims**: What specific assertions or opinions does the speaker make? Note how confidently they state each claim.

2. **Frameworks**: Does the speaker reference any named mental models, frameworks, or structured approaches?

3. **Advice**: What prescriptive recommendations does the speaker make?

4. **Stories**: Does the speaker use specific examples or case studies?

5. **Context Qualifiers**: Does the speaker limit when their advice applies?

6. **Applicability**: When does this advice apply? When does it NOT apply?

7. **References**: What people, companies, books, or concepts are mentioned?

TRANSCRIPT:
{{transcript}}`,
};

/**
 * Get a prompt from Langfuse, with fallback to hardcoded prompts
 */
export async function getPrompt(
  name: string,
  variables: Record<string, string>
): Promise<string> {
  const langfuse = getLangfuse();

  // Try to get from Langfuse if enabled (using cache)
  if (langfuse && LANGFUSE.usePrompts) {
    const prompt = await getCachedPrompt(langfuse, name);
    if (prompt) {
      return prompt.compile(variables);
    }
  }

  // Fall back to hardcoded prompt
  const fallback = FALLBACK_PROMPTS[name];
  if (!fallback) {
    throw new Error(`Prompt "${name}" not found in Langfuse or fallbacks`);
  }

  // Simple variable substitution for fallback
  let compiled = fallback;
  for (const [key, value] of Object.entries(variables)) {
    compiled = compiled.replace(new RegExp(`{{${key}}}`, "g"), value);
  }

  return compiled;
}

/**
 * Get a prompt object for use with Langfuse tracing
 * Returns both the compiled prompt and metadata for tracing
 */
export async function getPromptWithMeta(
  name: string,
  variables: Record<string, string>
): Promise<{
  prompt: string;
  promptName: string;
  promptVersion: string | null;
  isLangfuse: boolean;
}> {
  const langfuse = getLangfuse();

  if (langfuse && LANGFUSE.usePrompts) {
    const promptObj = await getCachedPrompt(langfuse, name);
    if (promptObj) {
      return {
        prompt: promptObj.compile(variables),
        promptName: name,
        promptVersion: promptObj.version?.toString() || null,
        isLangfuse: true,
      };
    }
  }

  // Fallback
  const fallback = FALLBACK_PROMPTS[name];
  if (!fallback) {
    throw new Error(`Prompt "${name}" not found`);
  }

  let compiled = fallback;
  for (const [key, value] of Object.entries(variables)) {
    compiled = compiled.replace(new RegExp(`{{${key}}}`, "g"), value);
  }

  return {
    prompt: compiled,
    promptName: name,
    promptVersion: "fallback",
    isLangfuse: false,
  };
}
