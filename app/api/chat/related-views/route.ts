import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/db";
import { generateEmbedding, llmExtract, getOrCreateTrace, endTrace } from "@/lib/llm";
import { searchSegments } from "@/lib/search";

interface RelatedView {
  type: "agrees" | "differs";
  guestName: string;
  guestSlug: string;
  avatarInitials: string;
  synthesis: string;
  rawText: string;
  timestamp: string;
  youtubeUrl: string;
}

const SynthesisSchema = z.object({
  synthesis: z.string().describe("A 2-3 sentence synthesis of what this guest thinks about the topic"),
  relationship: z.enum(["agrees", "differs"]).describe("Whether this guest agrees or has a different perspective"),
});

export async function POST(request: NextRequest) {
  // Create a single trace for this request
  const traceInfo = getOrCreateTrace({
    name: "related-views",
    metadata: { feature: "related-views" },
  });
  const traceId = traceInfo?.traceId;

  try {
    const body = await request.json();
    const { guestSlug, topic, mainGuestSegmentIds = [] } = body;

    if (!guestSlug || !topic) {
      return NextResponse.json(
        { error: "guestSlug and topic are required" },
        { status: 400 }
      );
    }

    // Get guest's episode IDs to exclude
    const { data: episodes } = await supabase
      .from("episodes")
      .select("id, guest")
      .eq("guest_slug", guestSlug);

    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ relatedViews: [] });
    }

    const episodeIds = episodes.map((e) => e.id);
    const mainGuestName = episodes[0].guest;

    // Get the main guest's ACTUAL transcript (not AI-generated response)
    let mainGuestExcerpt = "";
    if (mainGuestSegmentIds.length > 0) {
      const { data: mainSegments } = await supabase
        .from("segments")
        .select("text")
        .in("id", mainGuestSegmentIds);

      mainGuestExcerpt = (mainSegments || [])
        .map((s: any) => s.text)
        .join("\n\n")
        .slice(0, 800);
    } else {
      // Fallback: search for relevant segments from main guest using hybrid search
      const embedding = await generateEmbedding(topic, { traceId });
      const segments = await searchSegments(topic, embedding, {
        matchCount: 5,
        matchThreshold: 0.3,
      });

      const mainGuestSegments = (segments || []).filter((s: any) =>
        episodeIds.includes(s.episode_id)
      );

      mainGuestExcerpt = mainGuestSegments
        .map((s: any) => s.text)
        .join("\n\n")
        .slice(0, 800);
    }

    // Generate embedding for topic
    const topicEmbedding = await generateEmbedding(topic, { traceId });

    // Search for segments from OTHER guests using hybrid search
    const otherSegments = await searchSegments(topic, topicEmbedding, {
      matchCount: 15,
      matchThreshold: 0.35,
    });

    // Filter to other guests
    const otherGuestSegments = (otherSegments || []).filter(
      (s: any) => !episodeIds.includes(s.episode_id)
    );

    if (otherGuestSegments.length === 0) {
      return NextResponse.json({ relatedViews: [] });
    }

    // Get episode info for these segments
    const otherEpisodeIds = [
      ...new Set(otherGuestSegments.map((s: any) => s.episode_id)),
    ];

    const { data: otherEpisodes } = await supabase
      .from("episodes")
      .select("id, guest, guest_slug, youtube_url")
      .in("id", otherEpisodeIds);

    const otherEpisodeMap = new Map(
      (otherEpisodes || []).map((e) => [e.id, e])
    );

    // Group by guest and take top segment per guest
    const guestSegmentMap = new Map<string, any>();
    for (const seg of otherGuestSegments) {
      const ep = otherEpisodeMap.get(seg.episode_id);
      if (!ep) continue;

      if (!guestSegmentMap.has(ep.guest_slug)) {
        guestSegmentMap.set(ep.guest_slug, { segment: seg, episode: ep });
      }
    }

    // Synthesize related views (limit to 2 for speed)
    const guestEntries = Array.from(guestSegmentMap.values()).slice(0, 2);
    const relatedViews: RelatedView[] = [];

    // Process in parallel for speed
    const synthesisPromises = guestEntries.map(async ({ segment, episode: otherEp }) => {
      try {
        // Compare REAL transcript to REAL transcript
        const synthesisResult = await llmExtract(
          [
            {
              role: "system",
              content: `You are comparing perspectives from two podcast guests on a similar topic.

TOPIC: "${topic}"

${mainGuestName}'s perspective (from their podcast episode):
"${mainGuestExcerpt}"

Now analyze what ${otherEp.guest} thinks about this topic based on their excerpt. Determine if they generally agree or have a different perspective from ${mainGuestName}.`,
            },
            {
              role: "user",
              content: `${otherEp.guest}'s excerpt:\n"${segment.text}"`,
            },
          ],
          SynthesisSchema,
          { temperature: 0.3, traceId }
        );

        const initials = otherEp.guest
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        return {
          type: synthesisResult.relationship,
          guestName: otherEp.guest,
          guestSlug: otherEp.guest_slug,
          avatarInitials: initials,
          synthesis: synthesisResult.synthesis,
          rawText: segment.text,
          timestamp: segment.timestamp,
          youtubeUrl: `${otherEp.youtube_url}&t=${segment.timestamp_seconds}s`,
        } as RelatedView;
      } catch (error) {
        console.error("Failed to synthesize related view:", error);
        return null;
      }
    });

    const results = await Promise.all(synthesisPromises);
    for (const result of results) {
      if (result) {
        relatedViews.push(result);
      }
    }

    // Clean up trace
    if (traceId) endTrace(traceId);

    return NextResponse.json({ relatedViews });
  } catch (error) {
    // Clean up trace on error too
    if (traceId) endTrace(traceId);

    console.error("Related views error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch related views" },
      { status: 500 }
    );
  }
}
