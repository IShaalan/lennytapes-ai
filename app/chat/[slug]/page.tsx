"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  relatedViews?: RelatedView[];
  loadingRelatedViews?: boolean;
}

interface RelatedView {
  type: "agrees" | "differs";
  guestName: string;
  guestSlug: string;
  avatarInitials: string;
  synthesis: string;
  rawText: string;
  timestamp: string;
  youtubeUrl: string;
}

interface GuestInfo {
  name: string;
  slug: string;
  title: string;
}

function ChatContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const problem = searchParams?.get("problem") || "";
  // Use raw string for segments to avoid creating new array on every render
  const segmentsParam = searchParams?.get("segments") || "";

  // Memoize segmentIds array to prevent infinite re-renders
  const segmentIds = useMemo(() =>
    segmentsParam ? segmentsParam.split(",") : [],
    [segmentsParam]
  );

  const [guest, setGuest] = useState<GuestInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track active requests to prevent duplicates and allow cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const relatedViewsAbortRef = useRef<AbortController | null>(null);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (relatedViewsAbortRef.current) {
        relatedViewsAbortRef.current.abort();
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize chat with context
  useEffect(() => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let isCancelled = false;

    async function initialize() {
      if (!slug) return;

      try {
        // Fetch guest info
        const guestRes = await fetch(`/api/guests/${slug}`, {
          signal: abortController.signal,
        });

        if (isCancelled) return;

        if (guestRes.ok) {
          const guestData = await guestRes.json();
          setGuest({
            name: guestData.guest.name,
            slug: guestData.guest.slug,
            title: guestData.guest.episodes?.[0]?.title || "",
          });
        }

        // If we have context, start the conversation
        if (problem && segmentIds.length > 0) {
          // Generate initial response based on context (without related views for speed)
          const response = await fetch("/api/chat/contextual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              guestSlug: slug,
              problem,
              segmentIds,
              skipRelatedViews: true, // Fast initial load
            }),
            signal: abortController.signal,
          });

          if (isCancelled) return;

          if (response.ok) {
            const data = await response.json();
            setMessages([
              {
                role: "assistant",
                content: data.response,
                relatedViews: [],
                loadingRelatedViews: true,
              },
            ]);

            // Load related views in background (only if not cancelled)
            if (!isCancelled) {
              fetchRelatedViews(slug, problem, segmentIds, 0);
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was cancelled, ignore
          return;
        }
        console.error("Failed to initialize chat:", error);
      } finally {
        if (!isCancelled) {
          setInitializing(false);
        }
      }
    }

    initialize();

    // Cleanup function
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [slug, problem, segmentIds]);

  // Fetch related views separately (lazy loading)
  async function fetchRelatedViews(
    guestSlug: string,
    topic: string,
    mainGuestSegmentIds: string[],
    messageIndex: number
  ) {
    // Cancel any previous related views request
    if (relatedViewsAbortRef.current) {
      relatedViewsAbortRef.current.abort();
    }

    const abortController = new AbortController();
    relatedViewsAbortRef.current = abortController;

    try {
      const response = await fetch("/api/chat/related-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestSlug,
          topic,
          mainGuestSegmentIds, // Pass actual segment IDs, not AI response
        }),
        signal: abortController.signal,
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) =>
          prev.map((msg, idx) =>
            idx === messageIndex
              ? { ...msg, relatedViews: data.relatedViews || [], loadingRelatedViews: false }
              : msg
          )
        );
      } else {
        // Clear loading state on error
        setMessages((prev) =>
          prev.map((msg, idx) =>
            idx === messageIndex
              ? { ...msg, loadingRelatedViews: false }
              : msg
          )
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      console.error("Failed to fetch related views:", error);
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === messageIndex
            ? { ...msg, loadingRelatedViews: false }
            : msg
        )
      );
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    const newMessageIndex = messages.length + 1; // +1 for the user message we're about to add
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat/contextual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestSlug: slug,
          problem,
          messages: [...messages, { role: "user", content: userMessage }],
          skipRelatedViews: true, // Fast response
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            relatedViews: [],
            loadingRelatedViews: true,
          },
        ]);

        // Load related views in background (empty segmentIds - API will search)
        fetchRelatedViews(slug, userMessage, [], newMessageIndex);
      } else {
        throw new Error("Failed to get response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (initializing) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="tape-spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-foreground-muted">Starting conversation...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border-light">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={problem ? `/search?q=${encodeURIComponent(problem)}` : "/"}
              className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground-secondary" />
            </Link>

            {guest && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-muted rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">
                    {guest.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h1 className="font-headline font-bold">{guest.name}</h1>
                  {problem && (
                    <p className="text-foreground-muted text-sm truncate max-w-md">
                      Re: {problem}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {messages.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-foreground-muted">
                {problem
                  ? "Starting conversation about your question..."
                  : `Ask ${guest?.name || "the guest"} anything about their expertise.`}
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index}>
              {message.role === "user" ? (
                <div className="flex justify-end">
                  <div className="bg-primary text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Assistant message */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-muted rounded-full flex items-center justify-center">
                      <span className="text-primary font-bold text-xs">
                        {guest?.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2) || "?"}
                      </span>
                    </div>
                    <div className="bg-background-secondary border border-border-light rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>

                  {/* Related views */}
                  {message.loadingRelatedViews && (
                    <div className="ml-11">
                      <div className="flex items-center gap-2 text-foreground-muted text-sm py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Finding related perspectives...</span>
                      </div>
                    </div>
                  )}
                  {message.relatedViews && message.relatedViews.length > 0 && (
                    <div className="ml-11 space-y-3">
                      {message.relatedViews.map((view, viewIndex) => (
                        <RelatedViewCard key={viewIndex} view={view} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-muted rounded-full flex items-center justify-center">
                <span className="text-primary font-bold text-xs">
                  {guest?.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2) || "?"}
                </span>
              </div>
              <div className="bg-background-secondary border border-border-light rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-foreground-muted rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-foreground-muted rounded-full animate-bounce [animation-delay:0.1s]" />
                  <div className="w-2 h-2 bg-foreground-muted rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border-light">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 bg-background-secondary border border-border-light rounded-xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up question..."
                rows={1}
                className="w-full px-4 py-3 bg-transparent text-foreground placeholder:text-foreground-muted focus:outline-none resize-none"
                style={{ minHeight: "48px", maxHeight: "120px" }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="p-3 bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function RelatedViewCard({ view }: { view: RelatedView }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-background border border-border-light rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center gap-2 ${
          view.type === "agrees"
            ? "bg-[rgba(16,185,129,0.08)]"
            : "bg-[rgba(245,158,11,0.08)]"
        }`}
      >
        {view.type === "agrees" ? (
          <ThumbsUp className="w-4 h-4 text-[#10B981]" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
        )}
        <span className="text-sm font-medium">
          {view.guestName} {view.type === "agrees" ? "agrees" : "has a different take"}
        </span>
      </div>

      {/* Synthesis */}
      <div className="px-4 py-3">
        <p className="text-foreground-secondary text-sm leading-relaxed">
          {view.synthesis}
        </p>
      </div>

      {/* Raw Q&A toggle */}
      <div className="border-t border-border-light">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 flex items-center gap-2 text-foreground-muted hover:text-foreground-secondary text-sm transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          See original Q&A
        </button>

        {expanded && (
          <div className="px-4 pb-3">
            <div className="bg-background-secondary rounded-lg p-3 text-sm text-foreground-muted">
              <p className="whitespace-pre-wrap">{view.rawText}</p>
              <a
                href={view.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-primary hover:underline text-xs"
              >
                Watch at {view.timestamp} →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Go deeper */}
      <div className="px-4 pb-3">
        <Link
          href={`/chat/${view.guestSlug}?problem=${encodeURIComponent(view.synthesis)}`}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-background-secondary hover:bg-primary-muted border border-border-light hover:border-primary rounded-lg text-sm text-foreground-secondary hover:text-primary transition-all"
        >
          <MessageSquare className="w-4 h-4" />
          Go Deeper with {view.guestName.split(" ")[0]}
        </Link>
      </div>
    </div>
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

export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChatContent />
    </Suspense>
  );
}
