/**
 * Search functionality for LennyTapes
 *
 * Hybrid search combining semantic similarity + keyword matching
 */

import { supabase } from "./db";
import { generateEmbedding } from "./llm";
import { EXTRACTION } from "./config";

// Hybrid search configuration
export const SEARCH_CONFIG = {
  // Default weights for combining semantic and keyword scores
  semanticWeight: 0.7,
  keywordWeight: 0.3,
  // Default result limit
  defaultLimit: 20,
  // Minimum similarity threshold
  defaultThreshold: 0.0,
} as const;

export interface SearchResult {
  id: string;
  segmentKey: string;
  text: string;
  speaker: string;
  timestamp: string;
  timestampSeconds: number;
  similarity: number;

  // Episode info
  episodeId: string;
  episodeTitle: string;
  guest: string;
  guestSlug: string;
  videoId: string;
  youtubeUrl: string;

  // Extracted content
  claims: Array<{ text: string; confidence: string }>;
  frameworks: Array<{ name: string; description: string }>;
  advice: Array<{ text: string; actionable: boolean }>;
  stories: Array<{ summary: string; company?: string; outcome?: string }>;
  references: Array<{ type: string; name: string }>;

  // Hybrid search scores (optional, only present with hybrid search)
  semanticSimilarity?: number;
  keywordRank?: number;
  combinedScore?: number;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  guestSlug?: string;
  // Hybrid search options
  semanticWeight?: number;
  keywordWeight?: number;
  // If true, use legacy semantic-only search
  semanticOnly?: boolean;
  // Trace ID for observability
  traceId?: string;
}

/**
 * Low-level function to search segments using hybrid search
 * Returns raw segment data without episode enrichment
 */
export async function searchSegments(
  query: string,
  embedding: number[],
  options: {
    matchCount?: number;
    semanticWeight?: number;
    keywordWeight?: number;
    matchThreshold?: number;
  } = {}
) {
  const {
    matchCount = SEARCH_CONFIG.defaultLimit,
    semanticWeight = SEARCH_CONFIG.semanticWeight,
    keywordWeight = SEARCH_CONFIG.keywordWeight,
    matchThreshold = SEARCH_CONFIG.defaultThreshold,
  } = options;

  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: query,
    query_embedding: embedding,
    match_count: matchCount,
    semantic_weight: semanticWeight,
    keyword_weight: keywordWeight,
    match_threshold: matchThreshold,
  });

  if (error) {
    // Fallback to legacy match_segments if hybrid_search doesn't exist yet
    if (error.message.includes("hybrid_search")) {
      console.warn("hybrid_search not available, falling back to match_segments");
      const { data: fallbackData, error: fallbackError } = await supabase.rpc("match_segments", {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
      });
      if (fallbackError) throw new Error(`Search failed: ${fallbackError.message}`);
      return fallbackData || [];
    }
    throw new Error(`Search failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Search across all segments with hybrid search (semantic + keyword)
 * This is the main search function for the application
 */
export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = SEARCH_CONFIG.defaultLimit,
    threshold = SEARCH_CONFIG.defaultThreshold,
    guestSlug,
    semanticWeight = SEARCH_CONFIG.semanticWeight,
    keywordWeight = SEARCH_CONFIG.keywordWeight,
    semanticOnly = false,
    traceId,
  } = options;

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query, { traceId });

  let data: any[];

  if (semanticOnly) {
    // Legacy semantic-only search
    const { data: semanticData, error } = await supabase.rpc("match_segments", {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });
    if (error) throw new Error(`Search failed: ${error.message}`);
    data = semanticData || [];
  } else {
    // Hybrid search (semantic + keyword)
    data = await searchSegments(query, queryEmbedding, {
      matchCount: limit,
      semanticWeight,
      keywordWeight,
      matchThreshold: threshold,
    });
  }

  if (data.length === 0) {
    return [];
  }

  // Get episode details for the results
  const episodeIds = [...new Set(data.map((r: any) => r.episode_id))];
  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, title, guest, guest_slug, video_id, youtube_url")
    .in("id", episodeIds);

  const episodeMap = new Map(episodes?.map((e) => [e.id, e]) || []);

  // Transform results
  const results: SearchResult[] = data
    .map((row: any) => {
      const episode = episodeMap.get(row.episode_id);
      if (!episode) return null;

      // Filter by guest if specified
      if (guestSlug && episode.guest_slug !== guestSlug) {
        return null;
      }

      return {
        id: row.id,
        segmentKey: row.segment_key,
        text: row.text,
        speaker: row.speaker,
        timestamp: row.timestamp,
        timestampSeconds: row.timestamp_seconds,
        // Use combined_score if available (hybrid), otherwise similarity (semantic-only)
        similarity: row.combined_score ?? row.similarity,

        episodeId: row.episode_id,
        episodeTitle: episode.title,
        guest: episode.guest,
        guestSlug: episode.guest_slug,
        videoId: episode.video_id,
        youtubeUrl: `${episode.youtube_url}&t=${row.timestamp_seconds}s`,

        claims: row.claims || [],
        frameworks: row.frameworks || [],
        advice: row.advice || [],
        stories: row.stories || [],
        references: row.references || [],

        // Include hybrid search scores if available
        semanticSimilarity: row.semantic_similarity,
        keywordRank: row.keyword_rank,
        combinedScore: row.combined_score,
      };
    })
    .filter(Boolean) as SearchResult[];

  // Re-apply limit after guest filtering
  return results.slice(0, limit);
}

/**
 * Group search results by type for display
 */
export function groupResultsByType(results: SearchResult[]) {
  const insights: SearchResult[] = [];
  const frameworks: SearchResult[] = [];
  const advice: SearchResult[] = [];
  const stories: SearchResult[] = [];

  for (const result of results) {
    // Categorize based on what content the segment has
    if (result.frameworks.length > 0) {
      frameworks.push(result);
    }
    if (result.advice.length > 0) {
      advice.push(result);
    }
    if (result.stories.length > 0) {
      stories.push(result);
    }
    if (result.claims.length > 0) {
      insights.push(result);
    }
  }

  return { insights, frameworks, advice, stories };
}

/**
 * Get unique guests from search results
 */
export function getUniqueGuests(results: SearchResult[]) {
  const guestMap = new Map<string, { name: string; slug: string; count: number }>();

  for (const result of results) {
    const existing = guestMap.get(result.guestSlug);
    if (existing) {
      existing.count++;
    } else {
      guestMap.set(result.guestSlug, {
        name: result.guest,
        slug: result.guestSlug,
        count: 1,
      });
    }
  }

  return Array.from(guestMap.values()).sort((a, b) => b.count - a.count);
}
