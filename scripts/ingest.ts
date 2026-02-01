/**
 * Ingest script: Parse all transcripts and prepare for extraction
 *
 * This script:
 * 1. Reads all transcript files from the transcripts repo
 * 2. Parses YAML frontmatter and transcript content
 * 3. Splits transcripts into speaker turns
 * 4. Groups turns into segments
 * 5. Outputs structured data for the extraction phase
 */

import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, resolve } from "path";
import matter from "gray-matter";
import { PATHS, EXTRACTION } from "../lib/config.js";
import type { EpisodeMetadata, ParsedEpisode, SpeakerTurn, Segment } from "../lib/types.js";

// Parse timestamp string (HH:MM:SS) to seconds
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// Parse transcript content into speaker turns
function parseTranscript(content: string): SpeakerTurn[] {
  const turns: SpeakerTurn[] = [];

  // Match pattern: "Speaker Name (HH:MM:SS):" or just "(HH:MM:SS):" for continuation
  const turnPattern = /^(?:([^(]+?)\s*)?\((\d{1,2}:\d{2}:\d{2})\):\s*$/gm;

  const lines = content.split("\n");
  let currentTurn: Partial<SpeakerTurn> | null = null;
  let currentText: string[] = [];
  let lastSpeaker = "";

  for (const line of lines) {
    const match = line.match(/^(?:([^(]+?)\s*)?\((\d{1,2}:\d{2}:\d{2})\):$/);

    if (match) {
      // Save previous turn if exists
      if (currentTurn && currentText.length > 0) {
        turns.push({
          speaker: currentTurn.speaker!,
          timestamp: currentTurn.timestamp!,
          timestampSeconds: currentTurn.timestampSeconds!,
          text: currentText.join("\n").trim(),
        });
      }

      // Start new turn
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
      // Continuation of current turn
      if (line.trim()) {
        currentText.push(line);
      }
    }
  }

  // Don't forget the last turn
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

// Group speaker turns into segments
function groupIntoSegments(turns: SpeakerTurn[], turnsPerSegment: number): Segment[] {
  const segments: Segment[] = [];

  for (let i = 0; i < turns.length; i += turnsPerSegment) {
    const segmentTurns = turns.slice(i, i + turnsPerSegment);
    if (segmentTurns.length === 0) continue;

    // Determine primary speaker (most turns or first speaker)
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

// Read and parse a single episode
async function parseEpisode(guestSlug: string): Promise<ParsedEpisode | null> {
  const filePath = join(PATHS.episodes, guestSlug, "transcript.md");

  try {
    const content = await readFile(filePath, "utf-8");
    const { data, content: transcriptContent } = matter(content);

    const metadata = data as EpisodeMetadata;
    const turns = parseTranscript(transcriptContent);

    if (turns.length === 0) {
      console.warn(`No turns parsed for ${guestSlug}`);
      return null;
    }

    return {
      metadata,
      guestSlug,
      filePath,
      turns,
    };
  } catch (error) {
    console.error(`Error parsing ${guestSlug}:`, error);
    return null;
  }
}

// Main ingestion function
async function ingest() {
  console.log("Starting ingestion...");
  console.log(`Transcripts path: ${PATHS.episodes}`);

  // Get all episode directories
  const entries = await readdir(PATHS.episodes, { withFileTypes: true });
  const guestSlugs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .slice(0, EXTRACTION.maxEpisodes); // Limit for testing

  console.log(`Found ${guestSlugs.length} episodes to process`);

  // Parse all episodes
  const episodes: ParsedEpisode[] = [];
  const allSegments: Array<Segment & { guestSlug: string; episodeTitle: string }> = [];

  for (const guestSlug of guestSlugs) {
    const episode = await parseEpisode(guestSlug);
    if (episode) {
      episodes.push(episode);

      // Group into segments
      const segments = groupIntoSegments(episode.turns, EXTRACTION.turnsPerSegment);
      for (const segment of segments) {
        allSegments.push({
          ...segment,
          guestSlug,
          episodeTitle: episode.metadata.title,
        });
      }

      console.log(
        `Parsed ${guestSlug}: ${episode.turns.length} turns, ${segments.length} segments`
      );
    }
  }

  // Output directory
  const outputDir = resolve(process.cwd(), "data");
  await mkdir(outputDir, { recursive: true });

  // Save parsed episodes
  await writeFile(
    join(outputDir, "episodes.json"),
    JSON.stringify(episodes.map((e) => ({ ...e, turns: undefined })), null, 2)
  );

  // Save all segments (for extraction phase)
  await writeFile(join(outputDir, "segments.json"), JSON.stringify(allSegments, null, 2));

  // Summary stats
  const stats = {
    totalEpisodes: episodes.length,
    totalTurns: episodes.reduce((sum, e) => sum + e.turns.length, 0),
    totalSegments: allSegments.length,
    uniqueGuests: new Set(episodes.map((e) => e.metadata.guest)).size,
    averageTurnsPerEpisode: Math.round(
      episodes.reduce((sum, e) => sum + e.turns.length, 0) / episodes.length
    ),
    averageSegmentsPerEpisode: Math.round(allSegments.length / episodes.length),
  };

  await writeFile(join(outputDir, "stats.json"), JSON.stringify(stats, null, 2));

  console.log("\nIngestion complete!");
  console.log(`Episodes: ${stats.totalEpisodes}`);
  console.log(`Total turns: ${stats.totalTurns}`);
  console.log(`Total segments: ${stats.totalSegments}`);
  console.log(`Unique guests: ${stats.uniqueGuests}`);
  console.log(`\nOutput saved to ${outputDir}`);
}

// Run
ingest().catch(console.error);
