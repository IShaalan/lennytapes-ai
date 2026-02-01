import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/db";
import { generateEmbedding, llmGenerate, llmExtract, getOrCreateTrace, endTrace } from "@/lib/llm";
import { getPrompt } from "@/lib/prompts";
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
  // Create a single trace for this entire request
  const traceInfo = getOrCreateTrace({
    name: "contextual-chat",
    metadata: { feature: "contextual-chat" },
  });
  const traceId = traceInfo?.traceId;

  try {
    const body = await request.json();
    const { guestSlug, problem, messages = [], segmentIds = [], skipRelatedViews = false } = body;

    if (!guestSlug) {
      return NextResponse.json(
        { error: "guestSlug is required" },
        { status: 400 }
      );
    }

    // Get guest info
    const { data: episodes } = await supabase
      .from("episodes")
      .select("id, guest, guest_slug, title, youtube_url")
      .eq("guest_slug", guestSlug);

    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const episode = episodes[0];
    const episodeIds = episodes.map((e) => e.id);

    // Get relevant segments for this guest
    let relevantSegments: any[] = [];

    if (segmentIds.length > 0) {
      // Use provided segment IDs
      const { data: segments } = await supabase
        .from("segments")
        .select("*")
        .in("id", segmentIds);
      relevantSegments = segments || [];
    } else if (problem) {
      // Search for relevant segments using hybrid search
      const embedding = await generateEmbedding(problem, { traceId });
      const segments = await searchSegments(problem, embedding, {
        matchCount: 10,
        matchThreshold: 0.3,
      });

      relevantSegments = (segments || []).filter((s: any) =>
        episodeIds.includes(s.episode_id)
      );
    }

    // Build context for the chat
    const segmentContext = relevantSegments
      .map(
        (s: any) =>
          `[${s.timestamp}] ${s.text}\n` +
          (s.claims?.length
            ? `Key claims: ${s.claims.map((c: any) => c.text).join("; ")}\n`
            : "") +
          (s.frameworks?.length
            ? `Frameworks: ${s.frameworks.map((f: any) => `${f.name}`).join(", ")}\n`
            : "")
      )
      .join("\n---\n");

    // Build guest profile
    const { data: allSegments } = await supabase
      .from("segments")
      .select("claims, frameworks")
      .in("episode_id", episodeIds)
      .limit(30);

    const topClaims = (allSegments || [])
      .flatMap((s) => s.claims || [])
      .slice(0, 8)
      .map((c: any) => `- ${c.text}`)
      .join("\n");

    const guestProfile = `
Name: ${episode.guest}
Episode: ${episode.title}

Key beliefs:
${topClaims || "Various insights from the podcast."}
    `.trim();

    // Generate chat response
    const systemPrompt = await getPrompt("chat-guest", {
      guestName: episode.guest,
      guestProfile,
      relevantSegments: segmentContext || "No specific segments provided.",
    });

    // Build messages for LLM
    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (messages.length === 0 && problem) {
      // Initial message - introduce the topic
      chatMessages.push({
        role: "user",
        content: `I was exploring the question: "${problem}" and saw your perspective. Can you elaborate on your thinking here?`,
      });
    } else {
      // Add conversation history
      for (const msg of messages) {
        chatMessages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    const response = await llmGenerate(chatMessages, {
      temperature: 0.7,
      traceId,
      metadata: {
        feature: "contextual-chat",
        guestSlug,
      },
    });

    // Find related views from OTHER guests (skip if flag is set for faster response)
    const relatedViews: RelatedView[] = [];

    // Get the topic from the latest user message or problem
    const topic =
      messages.length > 0
        ? messages[messages.length - 1].content
        : problem || "";

    if (topic && !skipRelatedViews) {
      const topicEmbedding = await generateEmbedding(topic, { traceId });

      // Search for segments from OTHER guests using hybrid search
      const otherSegments = await searchSegments(topic, topicEmbedding, {
        matchCount: 15,
        matchThreshold: 0.35,
      });

      // Filter to other guests and get unique guests
      const otherGuestSegments = (otherSegments || []).filter(
        (s: any) => !episodeIds.includes(s.episode_id)
      );

      // Get episode info for these segments
      const otherEpisodeIds = [
        ...new Set(otherGuestSegments.map((s: any) => s.episode_id)),
      ];

      if (otherEpisodeIds.length > 0) {
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

        // Synthesize related views (limit to 2-3)
        const guestEntries = Array.from(guestSegmentMap.values()).slice(0, 3);

        // Get the main guest's ACTUAL transcript excerpt (not the AI-generated response)
        const mainGuestExcerpt = relevantSegments.length > 0
          ? relevantSegments.map((s: any) => s.text).join("\n\n").slice(0, 800)
          : "";

        for (const { segment, episode: otherEp } of guestEntries) {
          try {
            // Synthesize what this guest thinks and if they agree/differ
            // Compare REAL transcript to REAL transcript
            const synthesisResult = await llmExtract(
              [
                {
                  role: "system",
                  content: `You are comparing perspectives from two podcast guests on a similar topic.

TOPIC: "${topic}"

${episode.guest}'s perspective (from their podcast episode):
"${mainGuestExcerpt}"

Now analyze what ${otherEp.guest} thinks about this topic based on their excerpt. Determine if they generally agree or have a different perspective from ${episode.guest}.`,
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

            relatedViews.push({
              type: synthesisResult.relationship,
              guestName: otherEp.guest,
              guestSlug: otherEp.guest_slug,
              avatarInitials: initials,
              synthesis: synthesisResult.synthesis,
              rawText: segment.text,
              timestamp: segment.timestamp,
              youtubeUrl: `${otherEp.youtube_url}&t=${segment.timestamp_seconds}s`,
            });
          } catch (error) {
            console.error("Failed to synthesize related view:", error);
          }
        }
      }
    }

    // Clean up trace
    if (traceId) endTrace(traceId);

    return NextResponse.json({
      response,
      relatedViews,
    });
  } catch (error) {
    // Clean up trace on error too
    if (traceId) endTrace(traceId);

    console.error("Contextual chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    );
  }
}
