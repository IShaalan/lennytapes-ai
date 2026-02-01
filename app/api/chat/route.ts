import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { generateEmbedding } from "@/lib/llm";
import { chat } from "@/lib/llm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guestSlug, messages } = body;

    if (!guestSlug || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "guestSlug and messages are required" },
        { status: 400 }
      );
    }

    // Get the latest user message for context retrieval
    const latestUserMessage = messages
      .filter((m: any) => m.role === "user")
      .pop();

    if (!latestUserMessage) {
      return NextResponse.json(
        { error: "No user message found" },
        { status: 400 }
      );
    }

    // Get guest info
    const { data: episode, error: epError } = await supabase
      .from("episodes")
      .select("id, guest, guest_slug, title")
      .eq("guest_slug", guestSlug)
      .single();

    if (epError || !episode) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Generate embedding for the user's message to find relevant segments
    const queryEmbedding = await generateEmbedding(latestUserMessage.content);

    // Find relevant segments using vector similarity
    const { data: segments, error: segError } = await supabase.rpc(
      "match_segments",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 5,
      }
    );

    if (segError) {
      console.error("Segment retrieval error:", segError);
    }

    // Filter to only this guest's segments and format them
    const relevantSegments = (segments || [])
      .filter((s: any) => s.episode_id === episode.id)
      .map(
        (s: any) =>
          `[${s.timestamp}] ${s.text}\n` +
          (s.claims?.length
            ? `Claims: ${s.claims.map((c: any) => c.text).join("; ")}\n`
            : "") +
          (s.frameworks?.length
            ? `Frameworks: ${s.frameworks.map((f: any) => `${f.name}: ${f.description}`).join("; ")}\n`
            : "")
      )
      .join("\n---\n");

    // Build guest profile from their insights
    const { data: allSegments } = await supabase
      .from("segments")
      .select("claims, frameworks, advice")
      .eq("episode_id", episode.id)
      .limit(50);

    const topClaims = (allSegments || [])
      .flatMap((s) => s.claims || [])
      .filter((c: any) => c.confidence === "strong_opinion")
      .slice(0, 10)
      .map((c: any) => `- ${c.text}`)
      .join("\n");

    const topFrameworks = (allSegments || [])
      .flatMap((s) => s.frameworks || [])
      .slice(0, 5)
      .map((f: any) => `- ${f.name}: ${f.description}`)
      .join("\n");

    const guestProfile = `
Name: ${episode.guest}
Episode: ${episode.title}

Key beliefs and opinions:
${topClaims || "Not enough data extracted yet."}

Frameworks they use:
${topFrameworks || "Not enough data extracted yet."}
    `.trim();

    // Generate response
    const response = await chat(
      messages.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        guestSlug,
        guestName: episode.guest,
        guestProfile,
        relevantSegments: relevantSegments || "No relevant segments found.",
      }
    );

    return NextResponse.json({
      response,
      sourcesUsed: (segments || [])
        .filter((s: any) => s.episode_id === episode.id)
        .map((s: any) => ({
          timestamp: s.timestamp,
          timestampSeconds: s.timestamp_seconds,
          text: s.text.slice(0, 200) + (s.text.length > 200 ? "..." : ""),
        })),
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    );
  }
}
