/**
 * Retry failed segments from the pipeline log
 *
 * This script:
 * 1. Reads the pipeline log
 * 2. Retries each failed segment
 * 3. Updates the log with results
 */

import { readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
import matter from "gray-matter";
import { z } from "zod";
import { supabase, isDbConfigured } from "../lib/db.js";
import { llmExtract } from "../lib/llm.js";
import { PATHS, EXTRACTION } from "../lib/config.js";
import type { EpisodeMetadata, SpeakerTurn, Segment } from "../lib/types.js";

interface PipelineLog {
  startedAt: string;
  completedAt?: string;
  status: string;
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

// Extraction schema (same as pipeline.ts)
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

async function getEpisodeId(guestSlug: string): Promise<string | null> {
  const { data } = await supabase
    .from("episodes")
    .select("id")
    .eq("guest_slug", guestSlug)
    .single();

  return data?.id || null;
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

async function main() {
  if (!isDbConfigured()) {
    console.error("Supabase credentials not configured in .env");
    process.exit(1);
  }

  // Read pipeline log
  const logPath = resolve(process.cwd(), "data", "pipeline-log.json");
  let log: PipelineLog;

  try {
    const content = await readFile(logPath, "utf-8");
    log = JSON.parse(content);
  } catch (error) {
    console.error("No pipeline log found. Run the pipeline first.");
    process.exit(1);
  }

  const failures = log.failures;
  if (failures.length === 0) {
    console.log("No failed segments to retry.");
    process.exit(0);
  }

  console.log(`Found ${failures.length} failed segments to retry\n`);

  let retried = 0;
  let succeeded = 0;
  let stillFailed = 0;
  const newFailures: typeof failures = [];

  for (const failure of failures) {
    const [guestSlug, timestampStr] = failure.segmentKey.split("-");
    const timestampSeconds = parseInt(timestampStr);

    console.log(`Retrying ${failure.segmentKey}...`);

    try {
      // Get episode ID
      const episodeId = await getEpisodeId(guestSlug);
      if (!episodeId) {
        throw new Error(`Episode not found for ${guestSlug}`);
      }

      // Read and parse transcript
      const filePath = join(PATHS.episodes, guestSlug, "transcript.md");
      const content = await readFile(filePath, "utf-8");
      const { data, content: transcriptContent } = matter(content);
      const metadata = data as EpisodeMetadata;
      const turns = parseTranscript(transcriptContent);
      const segments = groupIntoSegments(turns, EXTRACTION.turnsPerSegment);

      // Find the specific segment
      const segment = segments.find((s) => s.startTimestampSeconds === timestampSeconds);
      if (!segment) {
        throw new Error(`Segment not found at timestamp ${timestampSeconds}`);
      }

      // Build prompt and extract
      const prompt = `You are analyzing a segment from Lenny's Podcast, a show featuring interviews with world-class product leaders and growth experts.

Episode: "${metadata.title}"
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

      const extraction = await llmExtract(
        [{ role: "user", content: prompt }],
        ExtractionSchema,
        { temperature: 0.1 }
      );

      // Save to DB
      await saveSegment(episodeId, failure.segmentKey, segment, extraction);

      succeeded++;
      console.log(
        `  ✓ Success: ${extraction.claims.length} claims, ${extraction.frameworks.length} frameworks`
      );

      // Add to successes in log
      log.successes.push({
        segmentKey: failure.segmentKey,
        timestamp: new Date().toISOString(),
        claims: extraction.claims.length,
        frameworks: extraction.frameworks.length,
      });
    } catch (error) {
      stillFailed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ Still failed: ${errorMsg.slice(0, 100)}`);

      newFailures.push({
        segmentKey: failure.segmentKey,
        timestamp: new Date().toISOString(),
        error: errorMsg,
      });
    }

    retried++;

    // Delay between retries
    await new Promise((resolve) => setTimeout(resolve, EXTRACTION.delayBetweenSegmentsMs));
  }

  // Update log
  log.failures = newFailures;
  log.summary.extracted += succeeded;
  log.summary.failed = newFailures.length;

  await writeFile(logPath, JSON.stringify(log, null, 2));

  console.log("\n=== RETRY COMPLETE ===");
  console.log(`Retried: ${retried}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Still failed: ${stillFailed}`);

  if (stillFailed > 0) {
    console.log(`\n${stillFailed} segments still failing. Check data/pipeline-log.json for details.`);
  }
}

main().catch(console.error);
