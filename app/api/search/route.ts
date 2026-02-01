import { NextRequest, NextResponse } from "next/server";
import { search, groupResultsByType, getUniqueGuests } from "@/lib/search";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 20, guestSlug } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Perform search
    const results = await search(query, {
      limit,
      guestSlug,
    });

    // Group results by type
    const grouped = groupResultsByType(results);

    // Get unique guests
    const guests = getUniqueGuests(results);

    return NextResponse.json({
      query,
      totalResults: results.length,
      results,
      grouped,
      guests,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}

// Also support GET for simple queries
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = searchParams.get("limit");
  const guestSlug = searchParams.get("guest");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  try {
    const results = await search(query, {
      limit: limit ? parseInt(limit) : 20,
      guestSlug: guestSlug || undefined,
    });

    const grouped = groupResultsByType(results);
    const guests = getUniqueGuests(results);

    return NextResponse.json({
      query,
      totalResults: results.length,
      results,
      grouped,
      guests,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
