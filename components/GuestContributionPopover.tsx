"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, MessageSquare, ExternalLink, Play } from "lucide-react";
import Link from "next/link";

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

interface GuestContributionPopoverProps {
  contributor: Contributor;
  onClose: () => void;
  initialSegmentIndex?: number;
  problem?: string;
}

export default function GuestContributionPopover({
  contributor,
  onClose,
  initialSegmentIndex = 0,
  problem = "",
}: GuestContributionPopoverProps) {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(initialSegmentIndex);
  const [adjacentSegment, setAdjacentSegment] = useState<any>(null);
  const [loadingAdjacent, setLoadingAdjacent] = useState(false);
  const [showingAdjacent, setShowingAdjacent] = useState<"before" | "after" | null>(null);

  const currentSegment = contributor.segments[currentSegmentIndex];

  const fetchAdjacentSegment = async (direction: "before" | "after") => {
    if (loadingAdjacent) return;

    // If already showing this direction, go back to main
    if (showingAdjacent === direction) {
      setShowingAdjacent(null);
      setAdjacentSegment(null);
      return;
    }

    setLoadingAdjacent(true);
    try {
      const response = await fetch(
        `/api/segments/${currentSegment.id}/adjacent?direction=${direction}`
      );
      const data = await response.json();

      if (data.segment) {
        setAdjacentSegment(data.segment);
        setShowingAdjacent(direction);
      } else {
        // No adjacent segment available
        setAdjacentSegment(null);
        setShowingAdjacent(null);
      }
    } catch (error) {
      console.error("Failed to fetch adjacent segment:", error);
    } finally {
      setLoadingAdjacent(false);
    }
  };

  const displaySegment = showingAdjacent && adjacentSegment ? adjacentSegment : currentSegment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Popover */}
      <div className="relative bg-background border border-border-light rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-muted rounded-full flex items-center justify-center">
              <span className="text-primary font-bold text-sm">
                {contributor.avatarInitials}
              </span>
            </div>
            <div>
              <h3 className="font-headline font-bold">{contributor.name}</h3>
              <p className="text-foreground-muted text-sm">
                {contributor.segments.length} contribution{contributor.segments.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        {/* Segment navigation (if multiple) */}
        {contributor.segments.length > 1 && (
          <div className="flex items-center justify-between px-4 py-2 bg-background-secondary border-b border-border-light">
            <button
              onClick={() => {
                setCurrentSegmentIndex(Math.max(0, currentSegmentIndex - 1));
                setShowingAdjacent(null);
                setAdjacentSegment(null);
              }}
              disabled={currentSegmentIndex === 0}
              className="p-1 hover:bg-background-tertiary rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-foreground-secondary">
              Segment {currentSegmentIndex + 1} of {contributor.segments.length}
            </span>
            <button
              onClick={() => {
                setCurrentSegmentIndex(
                  Math.min(contributor.segments.length - 1, currentSegmentIndex + 1)
                );
                setShowingAdjacent(null);
                setAdjacentSegment(null);
              }}
              disabled={currentSegmentIndex === contributor.segments.length - 1}
              className="p-1 hover:bg-background-tertiary rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Episode info */}
          <div className="mb-4">
            <p className="text-foreground-muted text-sm mb-1">
              {showingAdjacent && adjacentSegment
                ? adjacentSegment.episodeTitle
                : currentSegment.episodeTitle}
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-primary">
                {displaySegment.timestamp}
              </span>
              {showingAdjacent && (
                <span className="px-2 py-0.5 bg-accent-muted text-accent text-xs rounded-full">
                  {showingAdjacent === "before" ? "Previous" : "Next"} context
                </span>
              )}
            </div>
          </div>

          {/* Transcript text */}
          <div className="bg-background-secondary rounded-xl p-4 mb-4">
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {displaySegment.text}
            </p>
          </div>

          {/* Context navigation */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <button
              onClick={() => fetchAdjacentSegment("before")}
              disabled={loadingAdjacent}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showingAdjacent === "before"
                  ? "bg-accent text-white"
                  : "bg-background-secondary hover:bg-background-tertiary text-foreground-secondary"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Before
            </button>
            {showingAdjacent && (
              <button
                onClick={() => {
                  setShowingAdjacent(null);
                  setAdjacentSegment(null);
                }}
                className="px-3 py-1.5 bg-primary-muted text-primary rounded-lg text-sm"
              >
                Back to main
              </button>
            )}
            <button
              onClick={() => fetchAdjacentSegment("after")}
              disabled={loadingAdjacent}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showingAdjacent === "after"
                  ? "bg-accent text-white"
                  : "bg-background-secondary hover:bg-background-tertiary text-foreground-secondary"
              }`}
            >
              After
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Watch on YouTube */}
          <a
            href={displaySegment.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-background-secondary hover:bg-background-tertiary rounded-lg text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            <Play className="w-4 h-4" />
            Watch on YouTube at {displaySegment.timestamp}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Sticky footer with chat button */}
        <div className="p-4 border-t border-border-light bg-background">
          <Link
            href={`/chat/${contributor.slug}?problem=${encodeURIComponent(problem)}&segments=${contributor.segments.map(s => s.id).join(",")}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            Go Deeper with {contributor.name.split(" ")[0]}
          </Link>
        </div>
      </div>
    </div>
  );
}
