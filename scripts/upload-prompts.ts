/**
 * Upload prompts to Langfuse
 *
 * Run with: npx tsx scripts/upload-prompts.ts
 */

import { Langfuse } from "langfuse";
import { config } from "dotenv";

config();

const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});

const PROMPTS = [
  {
    name: "solve-synthesize",
    prompt: `You are an expert advisor synthesizing guidance from multiple product leaders who have appeared on Lenny's Podcast.

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
    config: {
      model: "gemini-2.0-flash",
      temperature: 0.7,
    },
    labels: ["production"],
  },
  {
    name: "chat-guest",
    prompt: `You are simulating a conversation with {{guestName}} based on their appearances on Lenny's Podcast.

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
    config: {
      model: "gemini-2.0-flash",
      temperature: 0.7,
    },
    labels: ["production"],
  },
  {
    name: "extract-segment",
    prompt: `You are an expert at extracting structured insights from podcast transcripts.

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
    config: {
      model: "gemini-2.0-flash",
      temperature: 0.3,
    },
    labels: ["production"],
  },
  {
    name: "synthesize-related-view",
    prompt: `You are analyzing a podcast transcript excerpt to compare perspectives between guests.

The main guest said:
{{mainResponse}}

Now analyze what {{otherGuestName}} thinks about a similar topic based on this excerpt. Determine if they generally agree or have a different perspective.

{{otherGuestName}}'s excerpt:
{{otherExcerpt}}

Provide:
1. A 2-3 sentence synthesis of what this guest thinks
2. Whether they "agrees" or "differs" from the main guest`,
    config: {
      model: "gemini-2.0-flash",
      temperature: 0.3,
    },
    labels: ["production"],
  },
];

async function uploadPrompts() {
  console.log("=== UPLOADING PROMPTS TO LANGFUSE ===\n");

  for (const promptData of PROMPTS) {
    try {
      console.log(`Uploading "${promptData.name}"...`);

      await langfuse.createPrompt({
        name: promptData.name,
        prompt: promptData.prompt,
        config: promptData.config,
        labels: promptData.labels,
        type: "text",
      });

      console.log(`  ✓ Created "${promptData.name}"`);
    } catch (error: any) {
      // If prompt already exists, try to create a new version
      if (error.message?.includes("already exists") || error.status === 409) {
        try {
          await langfuse.createPrompt({
            name: promptData.name,
            prompt: promptData.prompt,
            config: promptData.config,
            labels: promptData.labels,
            type: "text",
          });
          console.log(`  ✓ Updated "${promptData.name}" (new version)`);
        } catch (updateError) {
          console.log(`  ⚠ "${promptData.name}" already exists with same content`);
        }
      } else {
        console.error(`  ✗ Failed to create "${promptData.name}":`, error.message);
      }
    }
  }

  // Flush to ensure all events are sent
  await langfuse.shutdownAsync();

  console.log("\n=== DONE ===");
  console.log("Prompts are now available in Langfuse.");
  console.log("You can edit them in the Langfuse dashboard.");
}

uploadPrompts().catch(console.error);
