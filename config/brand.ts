/**
 * LennyTapes Brand Configuration
 *
 * Central place for all brand assets, metadata, and identity elements.
 * The cassette tape is our core visual metaphor.
 */

export const BRAND = {
  // Core identity
  name: "LennyTapes",
  tagline: "Search, explore, and pressure-test ideas from Lenny's Podcast",
  shortTagline: "Deep dives into expert knowledge",

  // Meta descriptions
  description:
    "Go beyond basic search. Discover hidden connections, surface expert disagreements, and pressure-test ideas from 300+ hours of Lenny's Podcast with world-class product leaders.",

  // Domain (update when decided)
  domain: "lennytapes.com",
  url: "https://lennytapes.com",

  // Social handles (update when created)
  twitter: "@lennytapes",
  github: "lennytapes",

  // Attribution
  attribution: {
    podcast: "Lenny's Podcast",
    podcastUrl: "https://www.lennyspodcast.com/",
    transcriptsRepo: "https://github.com/ChatPRD/lennys-podcast-transcripts",
    host: "Lenny Rachitsky",
  },

  // Legal
  disclaimer:
    "LennyTapes is an independent project and is not affiliated with or endorsed by Lenny Rachitsky or Lenny's Podcast.",
} as const;

/**
 * Logo variants and usage guidelines
 */
export const LOGO = {
  // Primary logo - cassette tape icon + wordmark
  primary: {
    description: "Full logo with cassette icon and LennyTapes wordmark",
    minWidth: 120, // px - don't use smaller than this
    clearSpace: "0.5em", // minimum clear space around logo
  },

  // Icon only - for favicons, app icons, tight spaces
  icon: {
    description: "Cassette tape icon only",
    minWidth: 24,
    sizes: [16, 32, 48, 64, 128, 256, 512], // Standard icon sizes
  },

  // Wordmark only - text "LennyTapes" without icon
  wordmark: {
    description: "LennyTapes text only",
    minWidth: 80,
  },

  // Usage contexts
  usage: {
    header: "primary", // Full logo in site header
    favicon: "icon", // Just the cassette
    socialShare: "primary", // OG images
    footer: "wordmark", // Text only in footer
    loading: "icon", // Animated icon for loading states
  },
} as const;

/**
 * Visual metaphors and iconography
 *
 * The cassette tape is our core visual metaphor:
 * - Tapes = Episodes/recordings
 * - Rewind/Fast-forward = Navigate through content
 * - Pause = Deep dive / focus mode
 * - Mix tape = Curated collections / playlists
 * - Labels = Guest names / topics
 */
export const VISUAL_METAPHORS = {
  cassette: {
    meaning: "Each episode is a 'tape' - a recorded conversation",
    usage: ["Episode cards", "Loading states", "Empty states"],
  },
  reels: {
    meaning: "Progress through content, time navigation",
    usage: ["Timestamp indicators", "Progress bars", "Seek controls"],
  },
  label: {
    meaning: "Categorization, identity, guest attribution",
    usage: ["Guest tags", "Topic badges", "Episode metadata"],
  },
  play: {
    meaning: "Start exploring, begin conversation",
    usage: ["CTAs", "Start roleplay", "Begin search"],
  },
  pause: {
    meaning: "Deep focus, examine closely",
    usage: ["Contradiction found", "Important insight", "Slow down moment"],
  },
  mixtape: {
    meaning: "Curated collection of insights",
    usage: ["Saved collections", "Tension compilations", "User playlists"],
  },
} as const;

/**
 * Tone of voice guidelines
 */
export const VOICE = {
  personality: [
    "Curious and exploratory",
    "Playfully intelligent",
    "Respectfully challenging",
    "Never pretentious",
  ],

  // How we talk about features
  featureDescriptions: {
    search: "Dig into the archive",
    roleplay: "Talk it through with an expert",
    contradictions: "Surface the disagreements",
    graph: "See the connections",
  },

  // UI copy patterns
  patterns: {
    loading: [
      "Rewinding the tape...",
      "Finding the good stuff...",
      "Cueing up insights...",
      "Scanning the archive...",
    ],
    empty: [
      "This tape is blank",
      "Nothing recorded here yet",
      "No hits on this track",
    ],
    error: [
      "The tape got tangled",
      "Hit a snag in the reel",
      "Something's not playing right",
    ],
    success: [
      "Found it!",
      "Here's what we've got",
      "Playing back the highlights",
    ],
  },

  // Do's and Don'ts
  guidelines: {
    do: [
      "Use tape/audio metaphors naturally",
      "Be conversational but substantive",
      "Acknowledge when experts disagree",
      "Credit the original source",
    ],
    dont: [
      "Overuse cassette puns (one per screen max)",
      "Claim definitive truth - present perspectives",
      "Hide that this is AI-assisted",
      "Be sycophantic to any expert's views",
    ],
  },
} as const;

/**
 * Social sharing / OG image templates
 */
export const SOCIAL = {
  og: {
    defaultImage: "/og-default.png",
    dimensions: { width: 1200, height: 630 },
  },
  twitter: {
    cardType: "summary_large_image" as const,
  },
  templates: {
    home: {
      title: "LennyTapes",
      description: BRAND.description,
    },
    search: {
      title: (query: string) => `"${query}" - LennyTapes`,
      description: "Search insights from 300+ hours of expert interviews",
    },
    roleplay: {
      title: (guest: string) => `Talk with ${guest} - LennyTapes`,
      description: (guest: string) =>
        `Explore ${guest}'s perspectives on product, growth, and leadership`,
    },
    tension: {
      title: (topic: string) => `Expert Disagreements: ${topic} - LennyTapes`,
      description: "See where world-class experts disagree",
    },
  },
} as const;
