import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { generateEmbedding } from "@/lib/llm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const topic = searchParams.get("topic");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!topic) {
    return NextResponse.json(
      { error: "Topic parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Generate embedding for the topic
    const topicEmbedding = await generateEmbedding(topic);

    // Find segments related to this topic
    const { data: segments, error } = await supabase.rpc("match_segments", {
      query_embedding: topicEmbedding,
      match_threshold: 0.3,
      match_count: limit * 3, // Get more to filter
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json({
        topic,
        viewpoints: [],
        guests: [],
      });
    }

    // Get episode info for segments
    const episodeIds = [...new Set(segments.map((s: any) => s.episode_id))];
    const { data: episodes } = await supabase
      .from("episodes")
      .select("id, guest, guest_slug, title, youtube_url")
      .in("id", episodeIds);

    const episodeMap = new Map(episodes?.map((e) => [e.id, e]) || []);

    // Group viewpoints by guest, extracting their stance on the topic
    const guestViewpoints = new Map<
      string,
      {
        guest: string;
        guestSlug: string;
        episodeTitle: string;
        youtubeUrl: string;
        claims: Array<{
          text: string;
          confidence: string;
          timestamp: string;
          timestampSeconds: number;
          context: string;
          similarity: number;
        }>;
      }
    >();

    for (const seg of segments) {
      const episode = episodeMap.get(seg.episode_id);
      if (!episode) continue;

      // Get claims with any confidence level
      const claims = seg.claims || [];
      if (claims.length === 0) continue;

      const existing = guestViewpoints.get(episode.guest_slug);
      if (existing) {
        // Add claims from this segment
        for (const claim of claims) {
          existing.claims.push({
            text: claim.text,
            confidence: claim.confidence || "stated",
            timestamp: seg.timestamp,
            timestampSeconds: seg.timestamp_seconds,
            context: seg.text.slice(0, 300),
            similarity: seg.similarity,
          });
        }
      } else {
        guestViewpoints.set(episode.guest_slug, {
          guest: episode.guest,
          guestSlug: episode.guest_slug,
          episodeTitle: episode.title,
          youtubeUrl: episode.youtube_url,
          claims: claims.map((c: any) => ({
            text: c.text,
            confidence: c.confidence || "stated",
            timestamp: seg.timestamp,
            timestampSeconds: seg.timestamp_seconds,
            context: seg.text.slice(0, 300),
            similarity: seg.similarity,
          })),
        });
      }
    }

    // Convert to array and limit claims per guest
    const viewpoints = Array.from(guestViewpoints.values())
      .map((v) => ({
        ...v,
        claims: v.claims
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5),
      }))
      .filter((v) => v.claims.length > 0)
      .slice(0, limit);

    return NextResponse.json({
      topic,
      totalViewpoints: viewpoints.length,
      viewpoints,
      guests: viewpoints.map((v) => ({
        name: v.guest,
        slug: v.guestSlug,
        claimCount: v.claims.length,
      })),
    });
  } catch (error) {
    console.error("Explore error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Explore failed" },
      { status: 500 }
    );
  }
}
