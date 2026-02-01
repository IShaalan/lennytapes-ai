import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    const { data: episodes, error } = await supabase
      .from("episodes")
      .select("guest, guest_slug, title, video_id")
      .order("guest", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch guests: ${error.message}`);
    }

    // Get segment counts per episode
    const { data: segmentCounts } = await supabase
      .from("segments")
      .select("episode_id")
      .not("claims", "eq", "[]");

    // Count segments per episode
    const countMap = new Map<string, number>();
    segmentCounts?.forEach((s) => {
      countMap.set(s.episode_id, (countMap.get(s.episode_id) || 0) + 1);
    });

    // Build guest list with episode count and insight count
    const guestMap = new Map<
      string,
      {
        name: string;
        slug: string;
        episodes: Array<{ title: string; videoId: string }>;
        insightCount: number;
      }
    >();

    for (const ep of episodes || []) {
      const existing = guestMap.get(ep.guest_slug);
      if (existing) {
        existing.episodes.push({ title: ep.title, videoId: ep.video_id });
      } else {
        guestMap.set(ep.guest_slug, {
          name: ep.guest,
          slug: ep.guest_slug,
          episodes: [{ title: ep.title, videoId: ep.video_id }],
          insightCount: 0,
        });
      }
    }

    // Add insight counts
    for (const ep of episodes || []) {
      const guest = guestMap.get(ep.guest_slug);
      if (guest) {
        // We need to get the episode ID to look up counts
        const { data: epData } = await supabase
          .from("episodes")
          .select("id")
          .eq("guest_slug", ep.guest_slug)
          .single();

        if (epData) {
          guest.insightCount += countMap.get(epData.id) || 0;
        }
      }
    }

    const guests = Array.from(guestMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      totalGuests: guests.length,
      guests,
    });
  } catch (error) {
    console.error("Guests API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch guests" },
      { status: 500 }
    );
  }
}
