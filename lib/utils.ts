import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 * Handles conditional classes and deduplication
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format seconds to timestamp string (HH:MM:SS or MM:SS)
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Generate YouTube URL with timestamp
 */
export function getYouTubeUrl(videoId: string, timestampSeconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  if (timestampSeconds && timestampSeconds > 0) {
    return `${base}&t=${timestampSeconds}s`;
  }
  return base;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Slugify a string for URLs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Random loading message (cassette themed)
 */
const loadingMessages = [
  "Rewinding the tape...",
  "Finding the good stuff...",
  "Cueing up insights...",
  "Scanning the archive...",
  "Fast-forwarding to wisdom...",
  "Loading the reel...",
];

export function getRandomLoadingMessage(): string {
  return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
}
