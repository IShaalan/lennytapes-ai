"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Users, AlertCircle } from "lucide-react";

interface Guest {
  name: string;
  slug: string;
  episodes: Array<{ title: string; videoId: string }>;
  insightCount: number;
}

interface GuestsResponse {
  totalGuests: number;
  guests: Guest[];
}

export default function GuestsPage() {
  const [data, setData] = useState<GuestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    async function fetchGuests() {
      try {
        const response = await fetch("/api/guests");
        if (!response.ok) {
          throw new Error("Failed to load guests");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load guests");
      } finally {
        setLoading(false);
      }
    }

    fetchGuests();
  }, []);

  const filteredGuests =
    data?.guests.filter((g) =>
      g.name.toLowerCase().includes(searchFilter.toLowerCase())
    ) || [];

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="tape-spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-foreground-muted">Loading guests...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <p className="text-foreground font-medium mb-2">Failed to load guests</p>
          <p className="text-foreground-muted text-sm">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border-light">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground-secondary" />
            </Link>

            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h1 className="font-headline text-xl font-bold">All Guests</h1>
              <span className="text-foreground-muted text-sm">
                ({data?.totalGuests || 0})
              </span>
            </div>

            <div className="flex-1 max-w-xs ml-auto">
              <div className="relative">
                <Search className="w-4 h-4 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter guests..."
                  className="w-full pl-9 pr-4 py-2 bg-background-secondary border border-border-light rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Guest Grid */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {filteredGuests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-foreground-muted">No guests found</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGuests.map((guest) => (
              <Link
                key={guest.slug}
                href={`/guest/${guest.slug}`}
                className="card p-5 hover:border-primary transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-background-tertiary rounded-full flex items-center justify-center group-hover:bg-primary-muted transition-colors">
                    <span className="text-foreground-muted group-hover:text-primary font-headline font-bold">
                      {guest.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline font-bold truncate group-hover:text-primary transition-colors">
                      {guest.name}
                    </h3>
                    <p className="text-foreground-muted text-xs">
                      {guest.episodes.length} episode
                      {guest.episodes.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Episode title preview */}
                <p className="text-foreground-secondary text-sm line-clamp-2 mb-3">
                  {guest.episodes[0].title}
                </p>

                {/* Insight count */}
                {guest.insightCount > 0 && (
                  <div className="text-xs text-primary">
                    {guest.insightCount} insights
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
