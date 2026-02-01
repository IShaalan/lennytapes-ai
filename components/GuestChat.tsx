"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, X, Play, ExternalLink, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Source {
  timestamp: string;
  timestampSeconds: number;
  text: string;
}

interface GuestChatProps {
  guestSlug: string;
  guestName: string;
  youtubeUrl: string;
}

export function GuestChat({ guestSlug, guestName, youtubeUrl }: GuestChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setSources([]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestSlug,
          messages: [...messages, { role: "user", content: userMessage }],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
      setSources(data.sourcesUsed || []);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-white rounded-full shadow-lg transition-all hover:scale-105"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="font-medium">Chat with {guestName.split(" ")[0]}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] bg-background border border-border rounded-xl shadow-2xl flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-light">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-muted rounded-full flex items-center justify-center">
            <span className="text-primary font-headline font-bold text-sm">
              {guestName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </span>
          </div>
          <div>
            <h3 className="font-headline font-bold text-sm">{guestName}</h3>
            <p className="text-foreground-muted text-xs">
              Based on podcast insights
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-foreground-muted" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 text-foreground-muted mx-auto mb-3" />
            <p className="text-foreground-secondary text-sm">
              Ask {guestName.split(" ")[0]} about their insights from the
              podcast
            </p>
            <div className="mt-4 space-y-2">
              {[
                "What's your take on finding product-market fit?",
                "How do you approach hiring?",
                "What advice do you have for first-time founders?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left px-3 py-2 text-xs text-foreground-muted hover:text-foreground hover:bg-background-secondary rounded-lg transition-colors"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                message.role === "user"
                  ? "bg-primary text-white rounded-br-md"
                  : "bg-background-secondary text-foreground rounded-bl-md"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-background-secondary px-4 py-2.5 rounded-2xl rounded-bl-md">
              <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="px-4 py-2 border-t border-border-light">
          <p className="text-xs text-foreground-muted mb-2">Sources used:</p>
          <div className="flex flex-wrap gap-1">
            {sources.map((source, i) => (
              <a
                key={i}
                href={`${youtubeUrl}&t=${source.timestampSeconds}s`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 bg-background-tertiary hover:bg-primary-muted rounded text-xs text-foreground-muted hover:text-primary transition-colors"
              >
                <Play className="w-3 h-3" />
                {source.timestamp}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border-light">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${guestName.split(" ")[0]} something...`}
            className="flex-1 px-4 py-2.5 bg-background-secondary border border-border-light rounded-lg text-sm focus:outline-none focus:border-primary"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
