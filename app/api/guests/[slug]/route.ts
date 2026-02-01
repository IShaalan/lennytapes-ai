import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get episode(s) for this guest
    const { data: episodes, error: epError } = await supabase
      .from("episodes")
      .select("*")
      .eq("guest_slug", slug);

    if (epError) {
      throw new Error(`Failed to fetch episode: ${epError.message}`);
    }

    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const episode = episodes[0];
    const episodeIds = episodes.map((e) => e.id);

    // Get all segments for this guest's episodes
    const { data: segments, error: segError } = await supabase
      .from("segments")
      .select(
        "id, segment_key, speaker, timestamp, timestamp_seconds, text, claims, frameworks, advice, stories, references"
      )
      .in("episode_id", episodeIds)
      .order("timestamp_seconds", { ascending: true });

    if (segError) {
      throw new Error(`Failed to fetch segments: ${segError.message}`);
    }

    // Aggregate insights
    const allClaims: Array<{
      text: string;
      confidence: string;
      timestamp: string;
      timestampSeconds: number;
    }> = [];
    const allFrameworks: Array<{
      name: string;
      description: string;
      timestamp: string;
      timestampSeconds: number;
    }> = [];
    const allAdvice: Array<{
      text: string;
      actionable: boolean;
      timestamp: string;
      timestampSeconds: number;
    }> = [];
    const allStories: Array<{
      summary: string;
      company?: string;
      outcome?: string;
      timestamp: string;
      timestampSeconds: number;
    }> = [];

    for (const seg of segments || []) {
      for (const claim of seg.claims || []) {
        allClaims.push({
          ...claim,
          timestamp: seg.timestamp,
          timestampSeconds: seg.timestamp_seconds,
        });
      }
      for (const fw of seg.frameworks || []) {
        allFrameworks.push({
          ...fw,
          timestamp: seg.timestamp,
          timestampSeconds: seg.timestamp_seconds,
        });
      }
      for (const adv of seg.advice || []) {
        allAdvice.push({
          ...adv,
          timestamp: seg.timestamp,
          timestampSeconds: seg.timestamp_seconds,
        });
      }
      for (const story of seg.stories || []) {
        allStories.push({
          ...story,
          timestamp: seg.timestamp,
          timestampSeconds: seg.timestamp_seconds,
        });
      }
    }

    return NextResponse.json({
      guest: {
        name: episode.guest,
        slug: episode.guest_slug,
        title: episode.title,
        videoId: episode.video_id,
        youtubeUrl: episode.youtube_url,
        publishedAt: episode.published_at,
      },
      episodes: episodes.map((e) => ({
        id: e.id,
        title: e.title,
        videoId: e.video_id,
        youtubeUrl: e.youtube_url,
      })),
      stats: {
        totalSegments: segments?.length || 0,
        totalClaims: allClaims.length,
        totalFrameworks: allFrameworks.length,
        totalAdvice: allAdvice.length,
        totalStories: allStories.length,
      },
      claims: allClaims,
      frameworks: allFrameworks,
      advice: allAdvice,
      stories: allStories,
      segments: segments?.map((s) => ({
        id: s.id,
        segmentKey: s.segment_key,
        speaker: s.speaker,
        timestamp: s.timestamp,
        timestampSeconds: s.timestamp_seconds,
        text: s.text,
        hasClaims: (s.claims?.length || 0) > 0,
        hasFrameworks: (s.frameworks?.length || 0) > 0,
        hasAdvice: (s.advice?.length || 0) > 0,
        hasStories: (s.stories?.length || 0) > 0,
      })),
    });
  } catch (error) {
    console.error("Guest API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch guest" },
      { status: 500 }
    );
  }
}
