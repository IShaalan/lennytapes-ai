import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const segmentId = params?.id;
  const searchParams = request.nextUrl.searchParams;
  const direction = searchParams.get("direction") || "after";

  if (!segmentId) {
    return NextResponse.json(
      { error: "Segment ID is required" },
      { status: 400 }
    );
  }

  if (direction !== "before" && direction !== "after") {
    return NextResponse.json(
      { error: "Direction must be 'before' or 'after'" },
      { status: 400 }
    );
  }

  try {
    // Get the current segment to find its episode and timestamp
    const { data: currentSegment, error: segError } = await supabase
      .from("segments")
      .select("id, episode_id, timestamp_seconds, segment_key")
      .eq("id", segmentId)
      .single();

    if (segError || !currentSegment) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    // Find the adjacent segment in the same episode
    let query = supabase
      .from("segments")
      .select("id, episode_id, segment_key, speaker, timestamp, timestamp_seconds, text, claims, frameworks, advice, stories")
      .eq("episode_id", currentSegment.episode_id);

    if (direction === "before") {
      query = query
        .lt("timestamp_seconds", currentSegment.timestamp_seconds)
        .order("timestamp_seconds", { ascending: false })
        .limit(1);
    } else {
      query = query
        .gt("timestamp_seconds", currentSegment.timestamp_seconds)
        .order("timestamp_seconds", { ascending: true })
        .limit(1);
    }

    const { data: adjacentSegments, error: adjError } = await query;

    if (adjError) {
      throw new Error(`Failed to fetch adjacent segment: ${adjError.message}`);
    }

    if (!adjacentSegments || adjacentSegments.length === 0) {
      return NextResponse.json({
        segment: null,
        message: direction === "before"
          ? "This is the first segment of the episode"
          : "This is the last segment of the episode",
      });
    }

    const adjacent = adjacentSegments[0];

    // Get episode info
    const { data: episode } = await supabase
      .from("episodes")
      .select("guest, guest_slug, title, youtube_url")
      .eq("id", adjacent.episode_id)
      .single();

    return NextResponse.json({
      segment: {
        id: adjacent.id,
        segmentKey: adjacent.segment_key,
        speaker: adjacent.speaker,
        timestamp: adjacent.timestamp,
        timestampSeconds: adjacent.timestamp_seconds,
        text: adjacent.text,
        claims: adjacent.claims || [],
        frameworks: adjacent.frameworks || [],
        advice: adjacent.advice || [],
        stories: adjacent.stories || [],
        guest: episode?.guest || "Unknown",
        guestSlug: episode?.guest_slug || "",
        episodeTitle: episode?.title || "",
        youtubeUrl: episode
          ? `${episode.youtube_url}&t=${adjacent.timestamp_seconds}s`
          : "",
      },
    });
  } catch (error) {
    console.error("Adjacent segment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch adjacent segment" },
      { status: 500 }
    );
  }
}
