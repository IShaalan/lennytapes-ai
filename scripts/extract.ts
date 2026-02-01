/**
 * Extract script: Run LLM extraction on segments
 *
 * This script:
 * 1. Reads segments from the ingestion phase
 * 2. Runs LLM extraction to pull out structured data
 * 3. Extracts: claims, frameworks, advice, stories, context, references
 * 4. Outputs enriched segments for the embedding phase
 */

import { readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { z } from "zod";
import { llmExtract } from "../lib/llm.js";
import { EXTRACTION } from "../lib/config.js";
import type { Segment, ExtractedSegment, Claim, Framework, Advice, Story, Reference } from "../lib/types.js";

// Schema for LLM extraction
const ExtractionSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string().describe("A specific claim or assertion made by the speaker"),
      confidence: z.enum(["strong_opinion", "tentative", "anecdote"]).describe(
        "How confidently the speaker states this"
      ),
    })
  ).describe("Key claims, opinions, or assertions made in this segment"),

  frameworks: z.array(
    z.object({
      name: z.string().describe("Name of the framework or mental model"),
      description: z.string().describe("Brief description of what this framework means"),
    })
  ).describe("Named frameworks, mental models, or structured approaches mentioned"),

  advice: z.array(
    z.object({
      text: z.string().describe("The specific advice or recommendation"),
      actionable: z.boolean().describe("Whether this is directly actionable"),
    })
  ).describe("Prescriptive statements - what the speaker recommends doing"),

  stories: z.array(
    z.object({
      summary: z.string().describe("Brief summary of the story or example"),
      company: z.string().optional().describe("Company involved if mentioned"),
      outcome: z.string().optional().describe("What happened / the lesson"),
    })
  ).describe("Specific examples, case studies, or anecdotes used to illustrate points"),

  qualifiers: z.array(z.string()).describe(
    "Context qualifiers like 'at our scale', 'for B2B', 'in early stage' that limit when this applies"
  ),

  appliesWhen: z.array(z.string()).describe(
    "Conditions or contexts where this advice/insight is most applicable"
  ),

  doesntApplyWhen: z.array(z.string()).describe(
    "Conditions or contexts where this advice/insight does NOT apply or breaks down"
  ),

  references: z.array(
    z.object({
      type: z.enum(["person", "company", "book", "concept"]),
      name: z.string(),
    })
  ).describe("People, companies, books, or key concepts mentioned"),
});

type ExtractionResult = z.infer<typeof ExtractionSchema>;

// Build the extraction prompt
function buildExtractionPrompt(segment: Segment & { guestSlug: string; episodeTitle: string }): string {
  return `You are analyzing a segment from Lenny's Podcast, a show featuring interviews with world-class product leaders and growth experts.

Episode: "${segment.episodeTitle}"
Primary Speaker: ${segment.speaker}
Timestamp: ${segment.startTimestamp}

SEGMENT CONTENT:
---
${segment.text}
---

Extract structured insights from this segment. Focus on:

1. **Claims**: What specific assertions or opinions does the speaker make? Note how confidently they state each claim.

2. **Frameworks**: Does the speaker reference any named mental models, frameworks, or structured approaches? (e.g., "Jobs to be Done", "ICE scoring", original frameworks they created)

3. **Advice**: What prescriptive recommendations does the speaker make? What do they say people should or shouldn't do?

4. **Stories**: Does the speaker use specific examples or case studies to illustrate their points? What companies or situations do they reference?

5. **Context Qualifiers**: Does the speaker limit when their advice applies? Look for phrases like "at scale", "for early stage", "in B2B", "at Airbnb we...", etc.

6. **Applicability**: When does this advice apply? When does it NOT apply?

7. **References**: What people, companies, books, or concepts are mentioned?

Be precise and extract only what's actually stated. Don't infer or add information not present in the segment.
If there's nothing meaningful to extract for a category, return an empty array.`;
}

// Extract from a single segment
async function extractSegment(
  segment: Segment & { guestSlug: string; episodeTitle: string },
  index: number,
  total: number
): Promise<ExtractedSegment | null> {
  try {
    const prompt = buildExtractionPrompt(segment);

    const extraction = await llmExtract<ExtractionResult>(
      [{ role: "user", content: prompt }],
      ExtractionSchema,
      { temperature: 0.1 } // Low temperature for consistent extraction
    );

    const extracted: ExtractedSegment = {
      id: `${segment.guestSlug}-${segment.startTimestampSeconds}`,
      episodeId: segment.guestSlug,
      speaker: segment.speaker,
      timestamp: segment.startTimestamp,
      timestampSeconds: segment.startTimestampSeconds,
      text: segment.text,

      claims: extraction.claims as Claim[],
      frameworks: extraction.frameworks as Framework[],
      advice: extraction.advice as Advice[],
      stories: extraction.stories as Story[],

      qualifiers: extraction.qualifiers,
      appliesWhen: extraction.appliesWhen,
      doesntApplyWhen: extraction.doesntApplyWhen,

      references: extraction.references as Reference[],
    };

    console.log(
      `[${index + 1}/${total}] Extracted ${segment.guestSlug} @ ${segment.startTimestamp}: ` +
        `${extraction.claims.length} claims, ${extraction.frameworks.length} frameworks, ` +
        `${extraction.advice.length} advice, ${extraction.stories.length} stories`
    );

    return extracted;
  } catch (error) {
    console.error(`Error extracting ${segment.guestSlug} @ ${segment.startTimestamp}:`, error);
    return null;
  }
}

// Process segments in batches
async function processBatch(
  segments: Array<Segment & { guestSlug: string; episodeTitle: string }>,
  startIndex: number,
  total: number
): Promise<ExtractedSegment[]> {
  const results = await Promise.all(
    segments.map((segment, i) => extractSegment(segment, startIndex + i, total))
  );
  return results.filter((r): r is ExtractedSegment => r !== null);
}

// Main extraction function
async function extract() {
  console.log("Starting extraction...");

  // Read segments from ingestion phase
  const dataDir = resolve(process.cwd(), "data");
  const segmentsPath = join(dataDir, "segments.json");

  let segments: Array<Segment & { guestSlug: string; episodeTitle: string }>;
  try {
    const content = await readFile(segmentsPath, "utf-8");
    segments = JSON.parse(content);
  } catch (error) {
    console.error("Error reading segments.json. Run 'npm run ingest' first.");
    process.exit(1);
  }

  console.log(`Loaded ${segments.length} segments for extraction`);

  // Process in batches to manage rate limits
  const batchSize = EXTRACTION.batchSize;
  const extracted: ExtractedSegment[] = [];

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    const results = await processBatch(batch, i, segments.length);
    extracted.push(...results);

    // Save progress periodically
    if ((i + batchSize) % 50 === 0 || i + batchSize >= segments.length) {
      await writeFile(
        join(dataDir, "extracted.json"),
        JSON.stringify(extracted, null, 2)
      );
      console.log(`Progress saved: ${extracted.length} segments extracted`);
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < segments.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Compute extraction stats
  const stats = {
    totalSegments: extracted.length,
    totalClaims: extracted.reduce((sum, s) => sum + s.claims.length, 0),
    totalFrameworks: extracted.reduce((sum, s) => sum + s.frameworks.length, 0),
    totalAdvice: extracted.reduce((sum, s) => sum + s.advice.length, 0),
    totalStories: extracted.reduce((sum, s) => sum + s.stories.length, 0),
    totalReferences: extracted.reduce((sum, s) => sum + s.references.length, 0),
    segmentsWithClaims: extracted.filter((s) => s.claims.length > 0).length,
    segmentsWithFrameworks: extracted.filter((s) => s.frameworks.length > 0).length,
    uniqueFrameworks: [
      ...new Set(extracted.flatMap((s) => s.frameworks.map((f) => f.name.toLowerCase()))),
    ].length,
    uniqueCompaniesReferenced: [
      ...new Set(
        extracted.flatMap((s) =>
          s.references.filter((r) => r.type === "company").map((r) => r.name.toLowerCase())
        )
      ),
    ].length,
  };

  await writeFile(join(dataDir, "extraction-stats.json"), JSON.stringify(stats, null, 2));

  console.log("\nExtraction complete!");
  console.log(`Segments extracted: ${stats.totalSegments}`);
  console.log(`Total claims: ${stats.totalClaims}`);
  console.log(`Total frameworks: ${stats.totalFrameworks} (${stats.uniqueFrameworks} unique)`);
  console.log(`Total advice items: ${stats.totalAdvice}`);
  console.log(`Total stories: ${stats.totalStories}`);
  console.log(`Total references: ${stats.totalReferences}`);
  console.log(`Companies referenced: ${stats.uniqueCompaniesReferenced}`);
}

// Run
extract().catch(console.error);
