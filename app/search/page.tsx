"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Lightbulb,
  BookOpen,
  Zap,
  MessageSquare,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Play,
  ExternalLink,
} from "lucide-react";
import GuestContributionPopover from "@/components/GuestContributionPopover";

interface Segment {
  id: string;
  timestamp: string;
  timestampSeconds: number;
  text: string;
  youtubeUrl: string;
  episodeTitle: string;
}

interface Contributor {
  name: string;
  slug: string;
  avatarInitials: string;
  segments: Segment[];
}

interface Framework {
  name: string;
  description: string;
  from: string;
}

interface SolveResponse {
  problem: string;
  answer: {
    keyInsight: string;
    frameworks: Framework[];
    actionableSteps: string[];
    whereTheyDiffer?: string;
  } | null;
  contributors: Contributor[];
  message?: string;
}

function ProblemSolverContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams?.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<SolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<Contributor | null>(null);

  // Fetch results when query changes via URL
  useEffect(() => {
    if (!initialQuery) return;

    async function solve() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problem: initialQuery }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to get guidance");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    solve();
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border-light">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground-secondary" />
            </Link>

            <form onSubmit={handleSubmit} className="flex-1">
              <div className="flex items-center bg-background-secondary border border-border-light rounded-xl">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What challenge are you facing?"
                  className="flex-1 px-4 py-3 bg-transparent text-foreground placeholder:text-foreground-muted focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-5 py-2 m-1.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? "Thinking..." : "Ask"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Empty state */}
        {!initialQuery && !loading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-primary-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Lightbulb className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-headline text-2xl font-bold mb-3">
              Get Expert Guidance
            </h2>
            <p className="text-foreground-secondary mb-8 max-w-md mx-auto">
              Describe your challenge and get synthesized advice from world-class
              product leaders.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "How do I find product-market fit?",
                "What's the best pricing strategy for SaaS?",
                "How should I hire my first PM?",
                "When should a startup pivot?",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setQuery(example);
                    router.push(`/search?q=${encodeURIComponent(example)}`);
                  }}
                  className="px-4 py-2 bg-background-secondary hover:bg-primary-muted border border-border-light hover:border-primary rounded-xl text-sm text-foreground-secondary hover:text-primary transition-all"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="tape-spinner w-10 h-10 mb-4" />
            <p className="text-foreground-secondary">
              Consulting the experts...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="w-12 h-12 text-error mb-4" />
            <p className="text-foreground font-medium mb-2">Something went wrong</p>
            <p className="text-foreground-muted text-sm">{error}</p>
          </div>
        )}

        {/* No results */}
        {data && !data.answer && !loading && (
          <div className="text-center py-16">
            <p className="text-foreground font-medium mb-2">
              No relevant insights found
            </p>
            <p className="text-foreground-muted text-sm">
              Try rephrasing your question or being more specific
            </p>
          </div>
        )}

        {/* Results */}
        {data && data.answer && !loading && (
          <div className="space-y-8">
            {/* Your question */}
            <div>
              <p className="text-foreground-muted text-sm mb-2">YOUR QUESTION</p>
              <h1 className="font-headline text-xl font-bold">{data.problem}</h1>
            </div>

            {/* Contributors */}
            {data.contributors.length > 0 && (
              <div className="bg-background-secondary border border-border-light rounded-xl p-4">
                <p className="text-foreground-muted text-sm mb-3">
                  BASED ON INSIGHTS FROM
                </p>
                <div className="flex flex-wrap gap-3">
                  {data.contributors.map((contributor) => (
                    <button
                      key={contributor.slug}
                      onClick={() => setSelectedContributor(contributor)}
                      className="flex items-center gap-2 px-3 py-2 bg-background hover:bg-primary-muted border border-border-light hover:border-primary rounded-xl transition-all group"
                    >
                      <div className="w-8 h-8 bg-primary-muted group-hover:bg-primary rounded-full flex items-center justify-center transition-colors">
                        <span className="text-primary group-hover:text-white font-bold text-xs">
                          {contributor.avatarInitials}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-foreground-secondary group-hover:text-primary">
                        {contributor.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Key Insight */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-primary-muted">
                  <Lightbulb className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-headline font-bold">Key Insight</h2>
              </div>
              <p className="text-foreground leading-relaxed pl-9">
                {data.answer.keyInsight}
              </p>
            </section>

            {/* Frameworks */}
            {data.answer.frameworks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-accent-muted">
                    <BookOpen className="w-5 h-5 text-accent" />
                  </div>
                  <h2 className="font-headline font-bold">Frameworks to Consider</h2>
                </div>
                <div className="space-y-3 pl-9">
                  {data.answer.frameworks.map((fw, i) => (
                    <div
                      key={i}
                      className="bg-background-secondary border border-border-light rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-medium text-foreground mb-1">
                            {fw.name}
                          </h3>
                          <p className="text-foreground-secondary text-sm">
                            {fw.description}
                          </p>
                        </div>
                        <span className="text-xs text-foreground-muted whitespace-nowrap">
                          via {fw.from}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Actionable Steps */}
            {data.answer.actionableSteps.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-[rgba(16,185,129,0.12)]">
                    <Zap className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <h2 className="font-headline font-bold">Actionable Steps</h2>
                </div>
                <ol className="space-y-2 pl-9">
                  {data.answer.actionableSteps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-background-secondary rounded-full flex items-center justify-center text-sm font-medium text-foreground-secondary">
                        {i + 1}
                      </span>
                      <p className="text-foreground">{step}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Where Experts Differ */}
            {data.answer.whereTheyDiffer && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-[rgba(108,99,255,0.12)]">
                    <MessageSquare className="w-5 h-5 text-special-1" />
                  </div>
                  <h2 className="font-headline font-bold">Where Experts Differ</h2>
                </div>
                <p className="text-foreground-secondary leading-relaxed pl-9">
                  {data.answer.whereTheyDiffer}
                </p>
              </section>
            )}

            {/* Sources (expandable) */}
            <section className="border-t border-border-light pt-6">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors"
              >
                {showSources ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
                <span className="font-medium">
                  Sources ({data.contributors.reduce((acc, c) => acc + c.segments.length, 0)} clips)
                </span>
              </button>

              {showSources && (
                <div className="mt-4 space-y-3">
                  {data.contributors.map((contributor) =>
                    contributor.segments.map((seg) => (
                      <div
                        key={seg.id}
                        className="bg-background-secondary border border-border-light rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-primary-muted rounded-full flex items-center justify-center">
                              <span className="text-primary font-bold text-xs">
                                {contributor.avatarInitials}
                              </span>
                            </div>
                            <span className="font-medium text-sm">
                              {contributor.name}
                            </span>
                          </div>
                          <a
                            href={seg.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-foreground-muted hover:text-primary transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            {seg.timestamp}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-foreground-secondary text-sm line-clamp-3">
                          {seg.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Guest Contribution Popover */}
      {selectedContributor && (
        <GuestContributionPopover
          contributor={selectedContributor}
          onClose={() => setSelectedContributor(null)}
          problem={data?.problem || initialQuery}
        />
      )}
    </main>
  );
}

function LoadingFallback() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="tape-spinner w-8 h-8 mx-auto mb-4" />
        <p className="text-foreground-muted">Loading...</p>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProblemSolverContent />
    </Suspense>
  );
}
