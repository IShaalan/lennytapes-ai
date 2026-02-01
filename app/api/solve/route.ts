import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/db";
import { generateEmbedding, llmExtract } from "@/lib/llm";
import { getPrompt } from "@/lib/prompts";
import { searchSegments } from "@/lib/search";

// Response schema for structured output
const SolveResponseSchema = z.object({
  keyInsight: z.string().describe("One paragraph summary of the main takeaway"),
  frameworks: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      from: z.string().describe("Guest name who mentioned this framework"),
    })
  ),
  actionableSteps: z.array(z.string()).describe("3-5 concrete steps the user can take"),
  whereTheyDiffer: z
    .string()
    .optional()
    .describe("Note any disagreements or different approaches between experts"),
});

interface Contributor {
  name: string;
  slug: string;
  avatarInitials: string;
  segments: Array<{
    id: string;
    timestamp: string;
    timestampSeconds: number;
    text: string;
    youtubeUrl: string;
    episodeTitle: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problem } = body;

    if (!problem || typeof problem !== "string") {
      return NextResponse.json(
        { error: "Problem description is required" },
        { status: 400 }
      );
    }

    // Generate embedding for the problem
    const problemEmbedding = await generateEmbedding(problem);

    // Retrieve relevant segments via hybrid search (semantic + keyword)
    const segments = await searchSegments(problem, problemEmbedding, {
      matchCount: 20,
      matchThreshold: 0.3,
    });

    if (!segments || segments.length === 0) {
      return NextResponse.json({
        problem,
        answer: null,
        contributors: [],
        message: "No relevant insights found for this problem.",
      });
    }

    // Get episode info for segments
    const episodeIds = [...new Set(segments.map((s: any) => s.episode_id))];
    const { data: episodes } = await supabase
      .from("episodes")
      .select("id, guest, guest_slug, title, youtube_url")
      .in("id", episodeIds);

    const episodeMap = new Map(episodes?.map((e) => [e.id, e]) || []);

    // Group segments by guest for contributors
    const contributorMap = new Map<string, Contributor>();

    for (const seg of segments) {
      const episode = episodeMap.get(seg.episode_id);
      if (!episode) continue;

      const existing = contributorMap.get(episode.guest_slug);
      const segmentData = {
        id: seg.id,
        timestamp: seg.timestamp,
        timestampSeconds: seg.timestamp_seconds,
        text: seg.text,
        youtubeUrl: `${episode.youtube_url}&t=${seg.timestamp_seconds}s`,
        episodeTitle: episode.title,
      };

      if (existing) {
        existing.segments.push(segmentData);
      } else {
        const initials = episode.guest
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        contributorMap.set(episode.guest_slug, {
          name: episode.guest,
          slug: episode.guest_slug,
          avatarInitials: initials,
          segments: [segmentData],
        });
      }
    }

    // Build context string for LLM with guest attribution
    const contextParts: string[] = [];
    for (const seg of segments) {
      const episode = episodeMap.get(seg.episode_id);
      if (!episode) continue;

      let segmentContext = `[${episode.guest} - ${seg.timestamp}]\n`;
      segmentContext += seg.text + "\n";

      if (seg.claims?.length > 0) {
        segmentContext +=
          "Claims: " + seg.claims.map((c: any) => c.text).join("; ") + "\n";
      }
      if (seg.frameworks?.length > 0) {
        segmentContext +=
          "Frameworks: " +
          seg.frameworks.map((f: any) => `${f.name}: ${f.description}`).join("; ") +
          "\n";
      }
      if (seg.advice?.length > 0) {
        segmentContext +=
          "Advice: " + seg.advice.map((a: any) => a.text).join("; ") + "\n";
      }

      contextParts.push(segmentContext);
    }

    const context = contextParts.join("\n---\n");

    // Get prompt from Langfuse
    const systemPrompt = await getPrompt("solve-synthesize", {
      problem,
      context,
    });

    // Generate synthesized answer using structured output
    const answer = await llmExtract(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Please provide guidance for: ${problem}` },
      ],
      SolveResponseSchema,
      {
        temperature: 0.7,
        metadata: {
          feature: "solve",
          problemLength: problem.length,
          segmentCount: segments.length,
          contributorCount: contributorMap.size,
        },
      }
    );

    // Convert contributors map to array, sorted by segment count
    const contributors = Array.from(contributorMap.values())
      .sort((a, b) => b.segments.length - a.segments.length)
      .slice(0, 8); // Limit to top 8 contributors

    return NextResponse.json({
      problem,
      answer,
      contributors,
    });
  } catch (error) {
    console.error("Solve error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to solve" },
      { status: 500 }
    );
  }
}
