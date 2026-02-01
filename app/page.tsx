"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Sparkles, GitCompare, Share2, Users } from "lucide-react";
import Link from "next/link";

interface Stats {
  episodes: number;
  guests: number;
  insights: number;
  frameworks: number;
  hoursOfContent: number;
}

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    // Navigate to search results page
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background-secondary" />

        {/* Cassette decoration - top right */}
        <div className="absolute -top-20 -right-20 w-64 h-64 opacity-5">
          <CassetteIcon className="w-full h-full" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16">
          {/* Logo & Wordmark */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <CassetteIcon className="w-12 h-12 text-primary" />
            <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight">
              Lenny<span className="text-primary">Tapes</span>
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-center text-foreground-secondary text-lg md:text-xl max-w-2xl mx-auto mb-12">
            Get expert guidance from{" "}
            <span className="text-foreground font-medium">
              {stats ? `${stats.hoursOfContent}+` : "300+"} hours
            </span>{" "}
            of conversations with world-class product leaders on Lenny&apos;s Podcast.
          </p>

          {/* Problem Input */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-16">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />
              <div className="relative flex items-center bg-background-secondary border border-border-light rounded-xl shadow-md hover:shadow-lg hover:border-border transition-all">
                <Lightbulb className="w-5 h-5 text-foreground-muted ml-4" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What challenge are you facing?"
                  className="flex-1 px-4 py-4 bg-transparent text-foreground placeholder:text-foreground-muted focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSearching || !query.trim()}
                  className="m-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <div className="tape-spinner w-4 h-4 border-2 border-white/30 border-t-white" />
                      <span>Thinking...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Get Guidance</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Example queries */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <span className="text-foreground-muted text-sm">Try:</span>
              {[
                "How to find PMF",
                "Pricing strategy",
                "Hiring your first PM",
                "When to pivot",
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuery(example)}
                  className="text-sm text-foreground-secondary hover:text-primary transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </form>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="Expert Guidance"
              description="Get synthesized advice from multiple experts. Frameworks, steps, and nuance."
              color="primary"
              href="/search"
            />
            <FeatureCard
              icon={<GitCompare className="w-6 h-6" />}
              title="Expert Debates"
              description="Surface where experts disagree. Pressure-test ideas in simulated discussions."
              color="accent"
              href="/explore"
            />
            <FeatureCard
              icon={<Share2 className="w-6 h-6" />}
              title="Connections"
              description="Discover hidden links between topics, guests, and frameworks."
              color="special"
              href="/graph"
            />
          </div>

          {/* Browse Guests CTA */}
          <div className="text-center mt-12">
            <Link
              href="/guests"
              className="inline-flex items-center gap-2 px-6 py-3 bg-background-secondary border border-border-light hover:border-primary rounded-xl text-foreground-secondary hover:text-primary transition-all"
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Browse all guests</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-background-secondary py-16 border-y border-border-light">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <Stat
              value={stats ? `${stats.hoursOfContent}+` : "..."}
              label="Hours of Content"
            />
            <Stat
              value={stats ? stats.guests.toString() : "..."}
              label="Expert Guests"
            />
            <Stat
              value={stats ? stats.insights.toLocaleString() : "..."}
              label="Insights Extracted"
            />
            <Stat
              value={stats ? stats.frameworks.toLocaleString() : "..."}
              label="Frameworks"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-foreground-muted text-sm">
        <p>
          Built with insights from{" "}
          <a
            href="https://www.lennyspodcast.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Lenny&apos;s Podcast
          </a>
          . Not affiliated with or endorsed by Lenny Rachitsky.
        </p>
      </footer>
    </main>
  );
}

// ============ Components ============

function FeatureCard({
  icon,
  title,
  description,
  color,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "primary" | "accent" | "special";
  href?: string;
}) {
  const colorClasses = {
    primary: "bg-primary-muted text-primary",
    accent: "bg-accent-muted text-accent",
    special: "bg-[rgba(108,99,255,0.12)] text-special-1",
  };

  const content = (
    <>
      <div
        className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-4`}
      >
        {icon}
      </div>
      <h3 className="font-headline text-lg font-bold mb-2">{title}</h3>
      <p className="text-foreground-secondary text-sm">{description}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="card p-6 hover:scale-[1.02] transition-transform block"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="card p-6 hover:scale-[1.02] transition-transform cursor-pointer">
      {content}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-headline text-3xl md:text-4xl font-bold text-gradient mb-1">
        {value}
      </div>
      <div className="text-foreground-muted text-sm">{label}</div>
    </div>
  );
}

// Cassette tape SVG icon
function CassetteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Cassette body */}
      <rect
        x="2"
        y="2"
        width="96"
        height="56"
        rx="4"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
      />

      {/* Label area */}
      <rect x="10" y="8" width="80" height="24" rx="2" fill="currentColor" fillOpacity="0.15" />

      {/* Left reel */}
      <circle cx="30" cy="42" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="30" cy="42" r="4" fill="currentColor" fillOpacity="0.3" />

      {/* Right reel */}
      <circle cx="70" cy="42" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="70" cy="42" r="4" fill="currentColor" fillOpacity="0.3" />

      {/* Tape window */}
      <rect
        x="38"
        y="36"
        width="24"
        height="12"
        rx="1"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1"
      />

      {/* Screw holes */}
      <circle cx="12" cy="50" r="2" fill="currentColor" fillOpacity="0.3" />
      <circle cx="88" cy="50" r="2" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}
