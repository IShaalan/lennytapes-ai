import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

interface GraphNode {
  id: string;
  type: "guest" | "topic" | "framework" | "company";
  label: string;
  size: number;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  relationship: string;
}

export async function GET() {
  try {
    // Get all episodes with their segments
    const { data: episodes, error: epError } = await supabase
      .from("episodes")
      .select("id, guest, guest_slug, title");

    if (epError) throw new Error(`Failed to fetch episodes: ${epError.message}`);

    // Get segments with frameworks and references
    const { data: segments, error: segError } = await supabase
      .from("segments")
      .select("episode_id, frameworks, references, claims")
      .not("frameworks", "eq", "[]");

    if (segError) throw new Error(`Failed to fetch segments: ${segError.message}`);

    const nodes: Map<string, GraphNode> = new Map();
    const edgeMap: Map<string, GraphEdge> = new Map();

    // Add guest nodes
    for (const ep of episodes || []) {
      const guestId = `guest:${ep.guest_slug}`;
      if (!nodes.has(guestId)) {
        nodes.set(guestId, {
          id: guestId,
          type: "guest",
          label: ep.guest,
          size: 1,
          metadata: { slug: ep.guest_slug },
        });
      }
    }

    // Build episode to guest mapping
    const episodeToGuest = new Map(
      (episodes || []).map((e) => [e.id, `guest:${e.guest_slug}`])
    );

    // Process segments to extract frameworks and references
    for (const seg of segments || []) {
      const guestId = episodeToGuest.get(seg.episode_id);
      if (!guestId) continue;

      // Increment guest node size
      const guestNode = nodes.get(guestId);
      if (guestNode) {
        guestNode.size += 1;
      }

      // Add framework nodes and edges
      for (const fw of seg.frameworks || []) {
        const fwId = `framework:${fw.name.toLowerCase().replace(/\s+/g, "-")}`;

        if (!nodes.has(fwId)) {
          nodes.set(fwId, {
            id: fwId,
            type: "framework",
            label: fw.name,
            size: 1,
            metadata: { description: fw.description },
          });
        } else {
          nodes.get(fwId)!.size += 1;
        }

        // Edge from guest to framework
        const edgeId = `${guestId}|${fwId}`;
        if (edgeMap.has(edgeId)) {
          edgeMap.get(edgeId)!.weight += 1;
        } else {
          edgeMap.set(edgeId, {
            source: guestId,
            target: fwId,
            weight: 1,
            relationship: "discusses",
          });
        }
      }

      // Add reference nodes (companies, people, concepts)
      for (const ref of seg.references || []) {
        const refId = `${ref.type}:${ref.name.toLowerCase().replace(/\s+/g, "-")}`;

        if (!nodes.has(refId)) {
          nodes.set(refId, {
            id: refId,
            type: ref.type === "company" ? "company" : "topic",
            label: ref.name,
            size: 1,
          });
        } else {
          nodes.get(refId)!.size += 1;
        }

        // Edge from guest to reference
        const edgeId = `${guestId}|${refId}`;
        if (edgeMap.has(edgeId)) {
          edgeMap.get(edgeId)!.weight += 1;
        } else {
          edgeMap.set(edgeId, {
            source: guestId,
            target: refId,
            weight: 1,
            relationship: "references",
          });
        }
      }
    }

    // Find shared frameworks/topics between guests (guest-to-guest edges)
    const frameworkToGuests = new Map<string, Set<string>>();
    for (const [edgeId, edge] of edgeMap) {
      if (edge.target.startsWith("framework:") || edge.target.startsWith("company:")) {
        if (!frameworkToGuests.has(edge.target)) {
          frameworkToGuests.set(edge.target, new Set());
        }
        frameworkToGuests.get(edge.target)!.add(edge.source);
      }
    }

    // Create guest-to-guest edges based on shared frameworks
    for (const [, guests] of frameworkToGuests) {
      const guestArray = Array.from(guests);
      for (let i = 0; i < guestArray.length; i++) {
        for (let j = i + 1; j < guestArray.length; j++) {
          const g2gEdgeId = `${guestArray[i]}|${guestArray[j]}`;
          if (edgeMap.has(g2gEdgeId)) {
            edgeMap.get(g2gEdgeId)!.weight += 1;
          } else {
            edgeMap.set(g2gEdgeId, {
              source: guestArray[i],
              target: guestArray[j],
              weight: 1,
              relationship: "shares_topic",
            });
          }
        }
      }
    }

    // Filter to only significant nodes and edges
    const significantNodes = Array.from(nodes.values())
      .filter((n) => n.size >= 2 || n.type === "guest")
      .slice(0, 150); // Limit for performance

    const nodeIds = new Set(significantNodes.map((n) => n.id));
    const significantEdges = Array.from(edgeMap.values())
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target) && e.weight >= 1)
      .slice(0, 300); // Limit for performance

    return NextResponse.json({
      nodes: significantNodes,
      edges: significantEdges,
      stats: {
        totalNodes: nodes.size,
        totalEdges: edgeMap.size,
        displayedNodes: significantNodes.length,
        displayedEdges: significantEdges.length,
      },
    });
  } catch (error) {
    console.error("Graph API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build graph" },
      { status: 500 }
    );
  }
}
