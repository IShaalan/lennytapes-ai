/**
 * Full pipeline: Ingest → Extract → Save to Supabase
 *
 * This script:
 * 1. Parses all transcripts
 * 2. Saves episodes to Supabase
 * 3. Extracts data from segments using LLM
 * 4. Saves segments to Supabase
 * 5. Handles resumption (skips already processed segments)
 * 6. Logs failures to a file for retry
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
import matter from "gray-matter";
import { z } from "zod";
import { supabase, isDbConfigured } from "../lib/db.js";
import { llmExtract } from "../lib/llm.js";
import { PATHS, EXTRACTION } from "../lib/config.js";
import type { EpisodeMetadata, SpeakerTurn, Segment } from "../lib/types.js";

// ============ LOGGING ============

interface PipelineLog {
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  config: {
    maxEpisodes?: number;
    delayMs: number;
  };
  summary: {
    episodesProcessed: number;
    totalSegments: number;
    extracted: number;
    skipped: number;
    failed: number;
  };
  successes: Array<{
    segmentKey: string;
    timestamp: string;
    claims: number;
    frameworks: number;
  }>;
  failures: Array<{
    segmentKey: string;
    timestamp: string;
    error: string;
  }>;
}

let pipelineLog: PipelineLog;

function initLog() {
  pipelineLog = {
    startedAt: new Date().toISOString(),
    status: "running",
    config: {
      maxEpisodes: EXTRACTION.maxEpisodes,
      delayMs: EXTRACTION.delayBetweenSegmentsMs,
    },
    summary: {
      episodesProcessed: 0,
      totalSegments: 0,
      extracted: 0,
      skipped: 0,
      failed: 0,
    },
    successes: [],
    failures: [],
  };
}

async function saveLog() {
  const logPath = resolve(process.cwd(), "data", "pipeline-log.json");
  await writeFile(logPath, JSON.stringify(pipelineLog, null, 2));
}

function logSuccess(segmentKey: string, claims: number, frameworks: number) {
  pipelineLog.successes.push({
    segmentKey,
    timestamp: new Date().toISOString(),
    claims,
    frameworks,
  });
  pipelineLog.summary.extracted++;
}

function logFailure(segmentKey: string, error: string) {
  pipelineLog.failures.push({
    segmentKey,
    timestamp: new Date().toISOString(),
    error,
  });
  pipelineLog.summary.failed++;
}

// ============ PARSING ============

function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function parseTranscript(content: string): SpeakerTurn[] {
  const turns: SpeakerTurn[] = [];
  const lines = content.split("\n");
  let currentTurn: Partial<SpeakerTurn> | null = null;
  let currentText: string[] = [];
  let lastSpeaker = "";

  for (const line of lines) {
    const match = line.match(/^(?:([^(]+?)\s*)?\((\d{1,2}:\d{2}:\d{2})\):$/);

    if (match) {
      if (currentTurn && currentText.length > 0) {
        turns.push({
          speaker: currentTurn.speaker!,
          timestamp: currentTurn.timestamp!,
          timestampSeconds: currentTurn.timestampSeconds!,
          text: currentText.join("\n").trim(),
        });
      }

      const speaker = match[1]?.trim() || lastSpeaker;
      const timestamp = match[2];
      if (speaker) lastSpeaker = speaker;

      currentTurn = {
        speaker,
        timestamp,
        timestampSeconds: parseTimestamp(timestamp),
      };
      currentText = [];
    } else if (currentTurn) {
      if (line.trim()) {
        currentText.push(line);
      }
    }
  }

  if (currentTurn && currentText.length > 0) {
    turns.push({
      speaker: currentTurn.speaker!,
      timestamp: currentTurn.timestamp!,
      timestampSeconds: currentTurn.timestampSeconds!,
      text: currentText.join("\n").trim(),
    });
  }

  return turns;
}

function groupIntoSegments(turns: SpeakerTurn[], turnsPerSegment: number): Segment[] {
  const segments: Segment[] = [];

  for (let i = 0; i < turns.length; i += turnsPerSegment) {
    const segmentTurns = turns.slice(i, i + turnsPerSegment);
    if (segmentTurns.length === 0) continue;

    const speakerCounts = new Map<string, number>();
    for (const turn of segmentTurns) {
      speakerCounts.set(turn.speaker, (speakerCounts.get(turn.speaker) || 0) + 1);
    }
    const primarySpeaker = [...speakerCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    segments.push({
      turns: segmentTurns,
      speaker: primarySpeaker,
      startTimestamp: segmentTurns[0].timestamp,
      startTimestampSeconds: segmentTurns[0].timestampSeconds,
      text: segmentTurns.map((t) => `${t.speaker}: ${t.text}`).join("\n\n"),
    });
  }

  return segments;
}

// ============ EXTRACTION ============

const ExtractionSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string(),
      confidence: z.enum(["strong_opinion", "tentative", "anecdote"]),
    })
  ),
  frameworks: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    })
  ),
  advice: z.array(
    z.object({
      text: z.string(),
      actionable: z.boolean(),
    })
  ),
  stories: z.array(
    z.object({
      summary: z.string(),
      company: z.string().optional(),
      outcome: z.string().optional(),
    })
  ),
  qualifiers: z.array(z.string()),
  appliesWhen: z.array(z.string()),
  doesntApplyWhen: z.array(z.string()),
  references: z.array(
    z.object({
      type: z.enum(["person", "company", "book", "concept"]),
      name: z.string(),
    })
  ),
});

function buildExtractionPrompt(
  segment: Segment,
  guestSlug: string,
  episodeTitle: string
): string {
  return `You are analyzing a segment from Lenny's Podcast, a show featuring interviews with world-class product leaders and growth experts.

Episode: "${episodeTitle}"
Primary Speaker: ${segment.speaker}
Timestamp: ${segment.startTimestamp}

SEGMENT CONTENT:
---
${segment.text}
---

Extract structured insights from this segment. Focus on:

1. **Claims**: What specific assertions or opinions does the speaker make? Note how confidently they state each claim.

2. **Frameworks**: Does the speaker reference any named mental models, frameworks, or structured approaches?

3. **Advice**: What prescriptive recommendations does the speaker make?

4. **Stories**: Does the speaker use specific examples or case studies?

5. **Context Qualifiers**: Does the speaker limit when their advice applies?

6. **Applicability**: When does this advice apply? When does it NOT apply?

7. **References**: What people, companies, books, or concepts are mentioned?

Be precise and extract only what's actually stated. If there's nothing meaningful for a category, return an empty array.`;
}

// ============ DATABASE ============

async function getOrCreateEpisode(
  guestSlug: string,
  metadata: EpisodeMetadata
): Promise<string> {
  // Check if episode exists
  const { data: existing } = await supabase
    .from("episodes")
    .select("id")
    .eq("guest_slug", guestSlug)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new episode
  const { data: newEpisode, error } = await supabase
    .from("episodes")
    .insert({
      guest: metadata.guest,
      guest_slug: guestSlug,
      title: metadata.title,
      youtube_url: metadata.youtube_url,
      video_id: metadata.video_id,
      publish_date: metadata.publish_date,
      duration_seconds: metadata.duration_seconds,
      description: metadata.description,
      keywords: metadata.keywords,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create episode: ${error.message}`);
  }

  return newEpisode.id;
}

async function segmentExists(segmentKey: string): Promise<boolean> {
  const { data } = await supabase
    .from("segments")
    .select("id")
    .eq("segment_key", segmentKey)
    .single();

  return !!data;
}

async function saveSegment(
  episodeId: string,
  segmentKey: string,
  segment: Segment,
  extraction: z.infer<typeof ExtractionSchema>
): Promise<void> {
  const { error } = await supabase.from("segments").upsert(
    {
      episode_id: episodeId,
      segment_key: segmentKey,
      speaker: segment.speaker,
      timestamp: segment.startTimestamp,
      timestamp_seconds: segment.startTimestampSeconds,
      text: segment.text,
      claims: extraction.claims,
      frameworks: extraction.frameworks,
      advice: extraction.advice,
      stories: extraction.stories,
      qualifiers: extraction.qualifiers,
      applies_when: extraction.appliesWhen,
      doesnt_apply_when: extraction.doesntApplyWhen,
      references: extraction.references,
    },
    { onConflict: "segment_key" }
  );

  if (error) {
    throw new Error(`Failed to save segment: ${error.message}`);
  }
}

// ============ MAIN PIPELINE ============

async function processEpisode(guestSlug: string): Promise<{
  segments: number;
  extracted: number;
  skipped: number;
  failed: number;
}> {
  const filePath = join(PATHS.episodes, guestSlug, "transcript.md");

  // Read and parse
  const content = await readFile(filePath, "utf-8");
  const { data, content: transcriptContent } = matter(content);
  const metadata = data as EpisodeMetadata;
  const turns = parseTranscript(transcriptContent);

  if (turns.length === 0) {
    return { segments: 0, extracted: 0, skipped: 0, failed: 0 };
  }

  // Get or create episode in DB
  const episodeId = await getOrCreateEpisode(guestSlug, metadata);

  // Group into segments
  const segments = groupIntoSegments(turns, EXTRACTION.turnsPerSegment);

  let extracted = 0;
  let skipped = 0;
  let failed = 0;

  // Process each segment
  for (const segment of segments) {
    const segmentKey = `${guestSlug}-${segment.startTimestampSeconds}`;

    // Skip if already processed
    if (await segmentExists(segmentKey)) {
      skipped++;
      pipelineLog.summary.skipped++;
      continue;
    }

    try {
      // Extract
      const prompt = buildExtractionPrompt(segment, guestSlug, metadata.title);
      const extraction = await llmExtract(
        [{ role: "user", content: prompt }],
        ExtractionSchema,
        { temperature: 0.1 }
      );

      // Save to DB
      await saveSegment(episodeId, segmentKey, segment, extraction);

      extracted++;
      logSuccess(segmentKey, extraction.claims.length, extraction.frameworks.length);

      console.log(
        `  [${extracted + skipped + failed}/${segments.length}] ${guestSlug} @ ${segment.startTimestamp}: ` +
          `${extraction.claims.length} claims, ${extraction.frameworks.length} frameworks`
      );
    } catch (error) {
      failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      logFailure(segmentKey, errorMsg);

      console.error(
        `  [${extracted + skipped + failed}/${segments.length}] FAILED ${segmentKey}: ${errorMsg.slice(0, 100)}`
      );
    }

    // Delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, EXTRACTION.delayBetweenSegmentsMs));

    // Save log periodically (every 10 segments)
    if ((extracted + skipped + failed) % 10 === 0) {
      await saveLog();
    }
  }

  return { segments: segments.length, extracted, skipped, failed };
}

async function main() {
  if (!isDbConfigured()) {
    console.error("Supabase credentials not configured in .env");
    process.exit(1);
  }

  // Initialize log
  initLog();

  console.log("Starting pipeline...");
  console.log(`Transcripts path: ${PATHS.episodes}`);
  console.log(`Delay between segments: ${EXTRACTION.delayBetweenSegmentsMs}ms`);

  // Get all episode directories
  const entries = await readdir(PATHS.episodes, { withFileTypes: true });
  const guestSlugs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .slice(0, EXTRACTION.maxEpisodes);

  console.log(`Found ${guestSlugs.length} episodes to process\n`);

  for (const guestSlug of guestSlugs) {
    console.log(`Processing ${guestSlug}...`);

    try {
      const result = await processEpisode(guestSlug);
      pipelineLog.summary.episodesProcessed++;
      pipelineLog.summary.totalSegments += result.segments;

      if (result.segments === 0) {
        console.log(`  Skipped (no turns parsed)`);
      } else if (result.skipped === result.segments) {
        console.log(`  Already processed (${result.skipped} segments)`);
      } else {
        console.log(
          `  Done: ${result.extracted} extracted, ${result.skipped} skipped, ${result.failed} failed`
        );
      }
    } catch (error) {
      console.error(`  Error processing ${guestSlug}:`, error);
    }

    // Save log after each episode
    await saveLog();
    console.log();
  }

  // Final summary
  pipelineLog.completedAt = new Date().toISOString();
  pipelineLog.status = pipelineLog.summary.failed > 0 ? "completed" : "completed";
  await saveLog();

  console.log("=== PIPELINE COMPLETE ===");
  console.log(`Episodes processed: ${pipelineLog.summary.episodesProcessed}`);
  console.log(`Total segments: ${pipelineLog.summary.totalSegments}`);
  console.log(`Extracted: ${pipelineLog.summary.extracted}`);
  console.log(`Already in DB: ${pipelineLog.summary.skipped}`);
  console.log(`Failed: ${pipelineLog.summary.failed}`);

  if (pipelineLog.summary.failed > 0) {
    console.log(`\n⚠️  ${pipelineLog.summary.failed} segments failed. Check data/pipeline-log.json for details.`);
    console.log(`Run 'npm run retry-failed' to retry failed segments.`);
  }

  console.log(`\nFull log saved to: data/pipeline-log.json`);
}

main().catch(async (error) => {
  console.error("Pipeline failed:", error);
  if (pipelineLog) {
    pipelineLog.status = "failed";
    pipelineLog.completedAt = new Date().toISOString();
    await saveLog();
  }
  process.exit(1);
});
