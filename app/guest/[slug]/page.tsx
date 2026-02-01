"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Lightbulb,
  BookOpen,
  MessageSquare,
  History,
  Play,
  ExternalLink,
  AlertCircle,
  Search,
} from "lucide-react";
import { GuestChat } from "@/components/GuestChat";

interface GuestData {
  guest: {
    name: string;
    slug: string;
    title: string;
    videoId: string;
    youtubeUrl: string;
    publishedAt: string;
  };
  episodes: Array<{
    id: string;
    title: string;
    videoId: string;
    youtubeUrl: string;
  }>;
  stats: {
    totalSegments: number;
    totalClaims: number;
    totalFrameworks: number;
    totalAdvice: number;
    totalStories: number;
  };
  claims: Array<{
    text: string;
    confidence: string;
    timestamp: string;
    timestampSeconds: number;
  }>;
  frameworks: Array<{
    name: string;
    description: string;
    timestamp: string;
    timestampSeconds: number;
  }>;
  advice: Array<{
    text: string;
    actionable: boolean;
    timestamp: string;
    timestampSeconds: number;
  }>;
  stories: Array<{
    summary: string;
    company?: string;
    outcome?: string;
    timestamp: string;
    timestampSeconds: number;
  }>;
}

export default function GuestPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [data, setData] = useState<GuestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "claims" | "frameworks" | "advice" | "stories"
  >("claims");

  useEffect(() => {
    async function fetchGuest() {
      try {
        const response = await fetch(`/api/guests/${slug}`);
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to load guest");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load guest");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchGuest();
    }
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="tape-spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-foreground-muted">Loading guest profile...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <p className="text-foreground font-medium mb-2">Guest not found</p>
          <p className="text-foreground-muted text-sm mb-4">{error}</p>
          <Link
            href="/"
            className="text-primary hover:underline text-sm"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const tabs = [
    {
      id: "claims" as const,
      label: "Insights",
      icon: Lightbulb,
      count: data.stats.totalClaims,
      color: "primary",
    },
    {
      id: "frameworks" as const,
      label: "Frameworks",
      icon: BookOpen,
      count: data.stats.totalFrameworks,
      color: "accent",
    },
    {
      id: "advice" as const,
      label: "Advice",
      icon: MessageSquare,
      count: data.stats.totalAdvice,
      color: "special",
    },
    {
      id: "stories" as const,
      label: "Stories",
      icon: History,
      count: data.stats.totalStories,
      color: "secondary",
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-secondary border-b border-border-light">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-start gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-background-tertiary rounded-lg transition-colors mt-1"
            >
              <ArrowLeft className="w-5 h-5 text-foreground-secondary" />
            </Link>

            <div className="flex-1">
              {/* Guest avatar */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-background-tertiary rounded-full flex items-center justify-center">
                  <span className="text-foreground-muted font-headline text-xl font-bold">
                    {data.guest.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h1 className="font-headline text-2xl font-bold">
                    {data.guest.name}
                  </h1>
                  <p className="text-foreground-secondary text-sm">
                    {data.guest.title}
                  </p>
                </div>
              </div>

              {/* Episode link */}
              <a
                href={data.guest.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-background-tertiary hover:bg-primary-muted rounded-lg text-sm transition-colors group"
              >
                <Play className="w-4 h-4 text-foreground-muted group-hover:text-primary" />
                <span className="text-foreground-secondary group-hover:text-primary">
                  Watch full episode
                </span>
                <ExternalLink className="w-3 h-3 text-foreground-muted group-hover:text-primary" />
              </a>

              {/* Search within guest */}
              <Link
                href={`/search?guest=${slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 ml-2 bg-background-tertiary hover:bg-primary-muted rounded-lg text-sm transition-colors group"
              >
                <Search className="w-4 h-4 text-foreground-muted group-hover:text-primary" />
                <span className="text-foreground-secondary group-hover:text-primary">
                  Search insights
                </span>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-6 pt-6 border-t border-border-light">
            <div>
              <div className="font-headline text-2xl font-bold text-gradient">
                {data.stats.totalSegments}
              </div>
              <div className="text-foreground-muted text-xs">Segments</div>
            </div>
            <div>
              <div className="font-headline text-2xl font-bold text-primary">
                {data.stats.totalClaims}
              </div>
              <div className="text-foreground-muted text-xs">Insights</div>
            </div>
            <div>
              <div className="font-headline text-2xl font-bold text-accent">
                {data.stats.totalFrameworks}
              </div>
              <div className="text-foreground-muted text-xs">Frameworks</div>
            </div>
            <div>
              <div className="font-headline text-2xl font-bold text-special-1">
                {data.stats.totalAdvice}
              </div>
              <div className="text-foreground-muted text-xs">Advice</div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-background border-b border-border-light">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground-secondary hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <span className="text-xs text-foreground-muted">
                  ({tab.count})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === "claims" && (
          <ClaimsList claims={data.claims} youtubeUrl={data.guest.youtubeUrl} />
        )}
        {activeTab === "frameworks" && (
          <FrameworksList
            frameworks={data.frameworks}
            youtubeUrl={data.guest.youtubeUrl}
          />
        )}
        {activeTab === "advice" && (
          <AdviceList advice={data.advice} youtubeUrl={data.guest.youtubeUrl} />
        )}
        {activeTab === "stories" && (
          <StoriesList
            stories={data.stories}
            youtubeUrl={data.guest.youtubeUrl}
          />
        )}
      </div>

      {/* Chat with guest */}
      <GuestChat
        guestSlug={data.guest.slug}
        guestName={data.guest.name}
        youtubeUrl={data.guest.youtubeUrl}
      />
    </main>
  );
}

function ClaimsList({
  claims,
  youtubeUrl,
}: {
  claims: GuestData["claims"];
  youtubeUrl: string;
}) {
  if (claims.length === 0) {
    return <EmptyState message="No insights extracted yet" />;
  }

  return (
    <div className="space-y-4">
      {claims.map((claim, i) => (
        <div key={i} className="card p-5">
          <p className="text-foreground leading-relaxed mb-3">{claim.text}</p>
          <div className="flex items-center justify-between">
            <span
              className={`badge ${
                claim.confidence === "strong_opinion"
                  ? "bg-primary-muted text-primary"
                  : "bg-background-tertiary text-foreground-secondary"
              }`}
            >
              {claim.confidence === "strong_opinion" ? "Strong" : claim.confidence}
            </span>
            <TimestampLink
              timestamp={claim.timestamp}
              seconds={claim.timestampSeconds}
              youtubeUrl={youtubeUrl}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FrameworksList({
  frameworks,
  youtubeUrl,
}: {
  frameworks: GuestData["frameworks"];
  youtubeUrl: string;
}) {
  if (frameworks.length === 0) {
    return <EmptyState message="No frameworks extracted yet" />;
  }

  return (
    <div className="space-y-4">
      {frameworks.map((fw, i) => (
        <div key={i} className="card p-5">
          <h3 className="font-headline font-bold text-accent mb-2">{fw.name}</h3>
          <p className="text-foreground-secondary leading-relaxed mb-3">
            {fw.description}
          </p>
          <TimestampLink
            timestamp={fw.timestamp}
            seconds={fw.timestampSeconds}
            youtubeUrl={youtubeUrl}
          />
        </div>
      ))}
    </div>
  );
}

function AdviceList({
  advice,
  youtubeUrl,
}: {
  advice: GuestData["advice"];
  youtubeUrl: string;
}) {
  if (advice.length === 0) {
    return <EmptyState message="No advice extracted yet" />;
  }

  return (
    <div className="space-y-4">
      {advice.map((adv, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-start gap-3">
            {adv.actionable && (
              <span className="px-2 py-0.5 bg-accent-muted text-accent text-xs rounded-full">
                Actionable
              </span>
            )}
          </div>
          <p className="text-foreground leading-relaxed mb-3 mt-2">{adv.text}</p>
          <TimestampLink
            timestamp={adv.timestamp}
            seconds={adv.timestampSeconds}
            youtubeUrl={youtubeUrl}
          />
        </div>
      ))}
    </div>
  );
}

function StoriesList({
  stories,
  youtubeUrl,
}: {
  stories: GuestData["stories"];
  youtubeUrl: string;
}) {
  if (stories.length === 0) {
    return <EmptyState message="No stories extracted yet" />;
  }

  return (
    <div className="space-y-4">
      {stories.map((story, i) => (
        <div key={i} className="card p-5">
          {story.company && (
            <span className="text-sm font-medium text-foreground-secondary">
              {story.company}
            </span>
          )}
          <p className="text-foreground leading-relaxed mb-3 mt-1">
            {story.summary}
          </p>
          {story.outcome && (
            <p className="text-foreground-secondary text-sm italic mb-3">
              Outcome: {story.outcome}
            </p>
          )}
          <TimestampLink
            timestamp={story.timestamp}
            seconds={story.timestampSeconds}
            youtubeUrl={youtubeUrl}
          />
        </div>
      ))}
    </div>
  );
}

function TimestampLink({
  timestamp,
  seconds,
  youtubeUrl,
}: {
  timestamp: string;
  seconds: number;
  youtubeUrl: string;
}) {
  const url = `${youtubeUrl}&t=${seconds}s`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-primary transition-colors"
    >
      <Play className="w-3 h-3" />
      <span className="font-mono">{timestamp}</span>
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-foreground-muted">{message}</p>
    </div>
  );
}
