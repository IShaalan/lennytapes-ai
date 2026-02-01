/**
 * Validate script: Inspect extracted data and test search
 *
 * This script helps validate extraction quality by:
 * 1. Showing sample extractions
 * 2. Searching for specific topics
 * 3. Finding potential contradictions
 * 4. Listing unique frameworks and references
 */

import { readFile } from "fs/promises";
import { join, resolve } from "path";
import type { ExtractedSegment } from "../lib/types.js";

// Load extracted data
async function loadExtracted(): Promise<ExtractedSegment[]> {
  const dataDir = resolve(process.cwd(), "data");
  const extractedPath = join(dataDir, "extracted.json");

  try {
    const content = await readFile(extractedPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading extracted.json. Run 'npm run extract' first.");
    process.exit(1);
  }
}

// Show sample extractions
function showSamples(segments: ExtractedSegment[], count: number = 3) {
  console.log("\n=== SAMPLE EXTRACTIONS ===\n");

  const withClaims = segments.filter((s) => s.claims.length > 0).slice(0, count);

  for (const segment of withClaims) {
    console.log(`--- ${segment.episodeId} @ ${segment.timestamp} ---`);
    console.log(`Speaker: ${segment.speaker}`);
    console.log(`\nText preview: ${segment.text.slice(0, 200)}...`);
    console.log(`\nClaims (${segment.claims.length}):`);
    for (const claim of segment.claims.slice(0, 3)) {
      console.log(`  [${claim.confidence}] ${claim.text}`);
    }
    if (segment.frameworks.length > 0) {
      console.log(`\nFrameworks (${segment.frameworks.length}):`);
      for (const fw of segment.frameworks) {
        console.log(`  - ${fw.name}: ${fw.description}`);
      }
    }
    if (segment.advice.length > 0) {
      console.log(`\nAdvice (${segment.advice.length}):`);
      for (const adv of segment.advice.slice(0, 2)) {
        console.log(`  - ${adv.text}`);
      }
    }
    if (segment.qualifiers.length > 0) {
      console.log(`\nQualifiers: ${segment.qualifiers.join(", ")}`);
    }
    console.log("\n");
  }
}

// Search segments by keyword
function searchByKeyword(segments: ExtractedSegment[], keyword: string) {
  console.log(`\n=== SEARCH: "${keyword}" ===\n`);

  const matches = segments.filter(
    (s) =>
      s.text.toLowerCase().includes(keyword.toLowerCase()) ||
      s.claims.some((c) => c.text.toLowerCase().includes(keyword.toLowerCase())) ||
      s.advice.some((a) => a.text.toLowerCase().includes(keyword.toLowerCase()))
  );

  console.log(`Found ${matches.length} segments mentioning "${keyword}"\n`);

  for (const segment of matches.slice(0, 5)) {
    console.log(`--- ${segment.episodeId} (${segment.speaker}) ---`);

    const relevantClaims = segment.claims.filter((c) =>
      c.text.toLowerCase().includes(keyword.toLowerCase())
    );
    if (relevantClaims.length > 0) {
      console.log("Claims:");
      for (const claim of relevantClaims) {
        console.log(`  - ${claim.text}`);
      }
    }

    const relevantAdvice = segment.advice.filter((a) =>
      a.text.toLowerCase().includes(keyword.toLowerCase())
    );
    if (relevantAdvice.length > 0) {
      console.log("Advice:");
      for (const adv of relevantAdvice) {
        console.log(`  - ${adv.text}`);
      }
    }
    console.log();
  }
}

// List all unique frameworks
function listFrameworks(segments: ExtractedSegment[]) {
  console.log("\n=== UNIQUE FRAMEWORKS ===\n");

  const frameworkMap = new Map<string, { count: number; guests: Set<string>; description: string }>();

  for (const segment of segments) {
    for (const fw of segment.frameworks) {
      const key = fw.name.toLowerCase();
      if (!frameworkMap.has(key)) {
        frameworkMap.set(key, { count: 0, guests: new Set(), description: fw.description });
      }
      const entry = frameworkMap.get(key)!;
      entry.count++;
      entry.guests.add(segment.episodeId);
    }
  }

  const sorted = [...frameworkMap.entries()].sort((a, b) => b[1].count - a[1].count);

  for (const [name, data] of sorted.slice(0, 20)) {
    console.log(`${name} (${data.count}x, ${data.guests.size} guests)`);
    console.log(`  ${data.description}`);
    console.log(`  Guests: ${[...data.guests].slice(0, 3).join(", ")}${data.guests.size > 3 ? "..." : ""}`);
    console.log();
  }
}

// Find potential contradictions by looking for opposing claims on same topics
function findPotentialContradictions(segments: ExtractedSegment[]) {
  console.log("\n=== POTENTIAL CONTRADICTIONS ===\n");

  // Group claims by topic keywords
  const topicKeywords = ["hiring", "product", "growth", "management", "marketing", "pricing", "culture"];

  for (const topic of topicKeywords) {
    const relevantClaims: Array<{ guest: string; claim: string; confidence: string }> = [];

    for (const segment of segments) {
      for (const claim of segment.claims) {
        if (claim.text.toLowerCase().includes(topic)) {
          relevantClaims.push({
            guest: segment.episodeId,
            claim: claim.text,
            confidence: claim.confidence,
          });
        }
      }
    }

    if (relevantClaims.length >= 2) {
      console.log(`--- ${topic.toUpperCase()} (${relevantClaims.length} claims) ---`);

      // Show claims from different guests
      const byGuest = new Map<string, string[]>();
      for (const c of relevantClaims) {
        if (!byGuest.has(c.guest)) byGuest.set(c.guest, []);
        byGuest.get(c.guest)!.push(c.claim);
      }

      for (const [guest, claims] of [...byGuest.entries()].slice(0, 4)) {
        console.log(`\n${guest}:`);
        for (const claim of claims.slice(0, 2)) {
          console.log(`  - ${claim}`);
        }
      }
      console.log("\n");
    }
  }
}

// List unique references
function listReferences(segments: ExtractedSegment[]) {
  console.log("\n=== TOP REFERENCES ===\n");

  const refMap = new Map<string, { type: string; count: number }>();

  for (const segment of segments) {
    for (const ref of segment.references) {
      const key = ref.name.toLowerCase();
      if (!refMap.has(key)) {
        refMap.set(key, { type: ref.type, count: 0 });
      }
      refMap.get(key)!.count++;
    }
  }

  const sorted = [...refMap.entries()].sort((a, b) => b[1].count - a[1].count);

  console.log("Companies:");
  for (const [name, data] of sorted.filter((r) => r[1].type === "company").slice(0, 10)) {
    console.log(`  ${name}: ${data.count}x`);
  }

  console.log("\nPeople:");
  for (const [name, data] of sorted.filter((r) => r[1].type === "person").slice(0, 10)) {
    console.log(`  ${name}: ${data.count}x`);
  }

  console.log("\nBooks:");
  for (const [name, data] of sorted.filter((r) => r[1].type === "book").slice(0, 10)) {
    console.log(`  ${name}: ${data.count}x`);
  }

  console.log("\nConcepts:");
  for (const [name, data] of sorted.filter((r) => r[1].type === "concept").slice(0, 10)) {
    console.log(`  ${name}: ${data.count}x`);
  }
}

// Main validation function
async function validate() {
  const segments = await loadExtracted();
  console.log(`Loaded ${segments.length} extracted segments`);

  // Get command line args
  const args = process.argv.slice(2);
  const command = args[0] || "all";
  const arg = args[1];

  switch (command) {
    case "samples":
      showSamples(segments, arg ? parseInt(arg) : 3);
      break;
    case "search":
      if (!arg) {
        console.log("Usage: npm run validate search <keyword>");
        process.exit(1);
      }
      searchByKeyword(segments, arg);
      break;
    case "frameworks":
      listFrameworks(segments);
      break;
    case "contradictions":
      findPotentialContradictions(segments);
      break;
    case "references":
      listReferences(segments);
      break;
    case "all":
    default:
      showSamples(segments, 2);
      listFrameworks(segments);
      listReferences(segments);
      findPotentialContradictions(segments);
      break;
  }
}

// Run
validate().catch(console.error);
