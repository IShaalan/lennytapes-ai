import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  try {
    // Get episode count
    const { count: episodeCount } = await supabase
      .from("episodes")
      .select("*", { count: "exact", head: true });

    // Get segment count
    const { count: segmentCount } = await supabase
      .from("segments")
      .select("*", { count: "exact", head: true });

    // Get total claims count (approximate from segments with claims)
    const { data: segmentsWithClaims } = await supabase
      .from("segments")
      .select("claims")
      .not("claims", "eq", "[]");

    let claimCount = 0;
    let frameworkCount = 0;

    // Count claims and frameworks
    const { data: allSegments } = await supabase
      .from("segments")
      .select("claims, frameworks");

    for (const seg of allSegments || []) {
      claimCount += (seg.claims || []).length;
      frameworkCount += (seg.frameworks || []).length;
    }

    // Get unique guest count
    const { data: episodes } = await supabase
      .from("episodes")
      .select("guest_slug");

    const uniqueGuests = new Set(episodes?.map((e) => e.guest_slug) || []).size;

    // Estimate hours of content (assume ~1 hour per episode average)
    const hoursOfContent = (episodeCount || 0) * 1;

    return NextResponse.json({
      episodes: episodeCount || 0,
      guests: uniqueGuests,
      segments: segmentCount || 0,
      insights: claimCount,
      frameworks: frameworkCount,
      hoursOfContent,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
