"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  GitCompare,
  Play,
  ExternalLink,
  AlertCircle,
  Lightbulb,
} from "lucide-react";

interface Claim {
  text: string;
  confidence: string;
  timestamp: string;
  timestampSeconds: number;
  context: string;
  similarity: number;
}

interface Viewpoint {
  guest: string;
  guestSlug: string;
  episodeTitle: string;
  youtubeUrl: string;
  claims: Claim[];
}

interface ExploreResponse {
  topic: string;
  totalViewpoints: number;
  viewpoints: Viewpoint[];
  guests: Array<{ name: string; slug: string; claimCount: number }>;
}

const SUGGESTED_TOPICS = [
  "product-market fit",
  "hiring your first PM",
  "when to pivot",
  "pricing strategy",
  "founder-led sales",
  "building a team",
  "growth vs profitability",
  "remote work",
];

export default function ExplorePage() {
  const [topic, setTopic] = useState("");
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (searchTopic: string) => {
    if (!searchTopic.trim()) return;

    setTopic(searchTopic);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/explore?topic=${encodeURIComponent(searchTopic.trim())}`
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Search failed");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(topic);
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-secondary border-b border-border-light">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/"
              className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground-secondary" />
            </Link>
            <div className="flex items-center gap-2">
              <GitCompare className="w-6 h-6 text-accent" />
              <h1 className="font-headline text-2xl font-bold">
                Explore Viewpoints
              </h1>
            </div>
          </div>

          <p className="text-foreground-secondary mb-6 max-w-2xl">
            Enter a topic to see how different experts approach it. Compare their
            perspectives and discover where they agree or disagree.
          </p>

          {/* Search */}
          <form onSubmit={handleSubmit} className="max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-foreground-muted absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter a topic (e.g., product-market fit, hiring, pricing)"
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border-light rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !topic.trim()}
                className="px-6 py-3 bg-accent hover:bg-accent/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Searching..." : "Explore"}
              </button>
            </div>
          </form>

          {/* Suggested topics */}
          {!data && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-foreground-muted text-sm">Try:</span>
              {SUGGESTED_TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => handleSearch(t)}
                  className="px-3 py-1 bg-background-tertiary hover:bg-primary-muted text-foreground-secondary hover:text-primary text-sm rounded-full transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="tape-spinner w-8 h-8 mb-4" />
            <p className="text-foreground-muted">
              Finding expert perspectives...
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="w-12 h-12 text-error mb-4" />
            <p className="text-foreground font-medium mb-2">Search failed</p>
            <p className="text-foreground-muted text-sm">{error}</p>
          </div>
        )}

        {/* No results */}
        {data && data.viewpoints.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-foreground font-medium mb-2">
              No viewpoints found
            </p>
            <p className="text-foreground-muted text-sm">
              Try a different topic or broader search term
            </p>
          </div>
        )}

        {/* Results */}
        {data && data.viewpoints.length > 0 && !loading && (
          <>
            <div className="mb-8">
              <h2 className="font-headline text-xl font-bold mb-2">
                Expert perspectives on &ldquo;{data.topic}&rdquo;
              </h2>
              <p className="text-foreground-secondary text-sm">
                {data.totalViewpoints} experts shared their views
              </p>
            </div>

            {/* Viewpoints grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {data.viewpoints.map((viewpoint) => (
                <ViewpointCard key={viewpoint.guestSlug} viewpoint={viewpoint} />
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!data && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20">
            <GitCompare className="w-16 h-16 text-foreground-muted mb-4 opacity-50" />
            <p className="text-foreground-secondary text-center max-w-md">
              Enter a topic above to discover how different product leaders think
              about it. Find areas of agreement, disagreement, and nuance.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function ViewpointCard({ viewpoint }: { viewpoint: Viewpoint }) {
  const [expanded, setExpanded] = useState(false);
  const displayClaims = expanded ? viewpoint.claims : viewpoint.claims.slice(0, 2);

  return (
    <div className="card p-5">
      {/* Guest header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/guest/${viewpoint.guestSlug}`}
          className="w-12 h-12 bg-background-tertiary hover:bg-primary-muted rounded-full flex items-center justify-center transition-colors"
        >
          <span className="text-foreground-muted font-headline font-bold">
            {viewpoint.guest
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </span>
        </Link>
        <div className="flex-1">
          <Link
            href={`/guest/${viewpoint.guestSlug}`}
            className="font-headline font-bold hover:text-primary transition-colors"
          >
            {viewpoint.guest}
          </Link>
          <p className="text-foreground-muted text-xs truncate">
            {viewpoint.episodeTitle}
          </p>
        </div>
      </div>

      {/* Claims */}
      <div className="space-y-3">
        {displayClaims.map((claim, i) => (
          <div
            key={i}
            className="pl-4 border-l-2 border-accent/30 hover:border-accent transition-colors"
          >
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <p className="text-foreground text-sm leading-relaxed">
                {claim.text}
              </p>
            </div>
            <a
              href={`${viewpoint.youtubeUrl}&t=${claim.timestampSeconds}s`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-foreground-muted hover:text-primary transition-colors"
            >
              <Play className="w-3 h-3" />
              {claim.timestamp}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        ))}
      </div>

      {/* Expand/collapse */}
      {viewpoint.claims.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 text-sm text-accent hover:underline"
        >
          {expanded
            ? "Show less"
            : `Show ${viewpoint.claims.length - 2} more claims`}
        </button>
      )}
    </div>
  );
}
