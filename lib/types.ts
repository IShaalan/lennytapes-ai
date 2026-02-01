// Source data types (from transcript files)

export interface EpisodeMetadata {
  guest: string;
  title: string;
  youtube_url?: string;
  video_id?: string;
  publish_date?: string;
  description?: string;
  duration_seconds?: number;
  duration?: string;
  view_count?: number;
  channel?: string;
  keywords?: string[];
}

export interface SpeakerTurn {
  speaker: string;
  timestamp: string;
  timestampSeconds: number;
  text: string;
}

export interface ParsedEpisode {
  metadata: EpisodeMetadata;
  guestSlug: string;
  filePath: string;
  turns: SpeakerTurn[];
}

// Extracted data types

export interface Claim {
  text: string;
  confidence: "strong_opinion" | "tentative" | "anecdote";
}

export interface Framework {
  name: string;
  description: string;
}

export interface Advice {
  text: string;
  actionable: boolean;
}

export interface Story {
  summary: string;
  company?: string;
  outcome?: string;
}

export interface Reference {
  type: "person" | "company" | "book" | "concept";
  name: string;
}

export interface ExtractedSegment {
  id: string;
  episodeId: string;
  speaker: string;
  timestamp: string;
  timestampSeconds: number;
  text: string;

  // Extracted content
  claims: Claim[];
  frameworks: Framework[];
  advice: Advice[];
  stories: Story[];

  // Context
  qualifiers: string[];
  appliesWhen: string[];
  doesntApplyWhen: string[];

  // References
  references: Reference[];

  // Vector (added after embedding)
  embedding?: number[];
}

export interface Segment {
  turns: SpeakerTurn[];
  speaker: string;
  startTimestamp: string;
  startTimestampSeconds: number;
  text: string;
}

// Guest profile (synthesized across appearances)

export interface GuestProfile {
  name: string;
  slug: string;
  episodeIds: string[];

  coreBeliefs: string[];
  signatureFrameworks: string[];
  recurringPhrases: string[];
  thinkingPatterns: string[];

  background: string;
  companiesReferenced: string[];

  agreesWith: string[];
  disagreesWith: string[];
}

// Tensions (contradictions)

export interface Position {
  guest: string;
  stance: string;
  context: string;
  segmentId: string;
}

export interface Tension {
  id: string;
  topic: string;
  positions: Position[];
  resolutionHint: string;
}

// Graph

export interface GraphNode {
  id: string;
  type: "guest" | "topic" | "framework" | "company";
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  sourceType: string;
  targetId: string;
  targetType: string;
  relationship: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

// Database row types

export interface EpisodeRow {
  id: string;
  guest: string;
  guest_slug: string;
  title: string;
  youtube_url: string | null;
  video_id: string | null;
  publish_date: string | null;
  duration_seconds: number | null;
  description: string | null;
  keywords: string[] | null;
  created_at: string;
}

export interface SegmentRow {
  id: string;
  episode_id: string;
  speaker: string;
  timestamp: string | null;
  timestamp_seconds: number | null;
  text: string;
  claims: Claim[] | null;
  frameworks: Framework[] | null;
  advice: Advice[] | null;
  qualifiers: string[] | null;
  applies_when: string[] | null;
  references: Reference[] | null;
  embedding: number[] | null;
  created_at: string;
}
