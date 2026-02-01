# LennyTapes — Design Document

> Search, explore, and pressure-test ideas from Lenny's Podcast

**Last updated:** 2026-01-31

---

## Vision

Go deeper than "chat with transcripts." LennyTapes surfaces hidden connections, contradictions, and enables pressure-testing ideas against 300+ hours of operator wisdom from Lenny's Podcast.

**Key differentiator:** We don't just retrieve quotes — we understand context, detect disagreements, and let users explore nuance through simulated debates.

---

## Target User

Product manager, founder, or growth person who:
- Listens to Lenny's Podcast
- Faces a specific challenge (hiring, pricing, PMF, etc.)
- Wants actionable advice, not generic AI answers
- Values knowing WHO said something and IN WHAT CONTEXT
- Understands that smart people disagree, and wants to explore the tradeoffs

---

## Features

### 1. AI Advisor / Problem Solver (Search)

**User story:** "I have a problem, help me get synthesized expert guidance."

**Key UX Principle:** AI synthesis over raw results. Users don't want to read through raw transcripts — they want actionable guidance with the option to dig deeper.

**Flow:**
1. User enters their challenge/problem
2. System retrieves relevant segments via semantic search (threshold 0.3)
3. LLM synthesizes guidance with structured output:
   - **Key Insight:** One paragraph summary of the main takeaway
   - **Frameworks:** Applicable mental models with guest attribution
   - **Actionable Steps:** 3-5 concrete steps to take
   - **Where Experts Differ:** Notes on disagreements (when applicable)
4. Guest avatars show WHO contributed to the answer (clickable)
5. Clicking a guest avatar opens a popover with:
   - AI synthesis of their specific contribution
   - Collapsible raw Q&A transcript
   - "Go Deeper with [Guest]" button to continue in full chat

**Key UX:**
- Always show WHO contributed (guest avatar row)
- AI synthesis first, raw transcripts as drill-down
- One click to "Go Deeper" with any contributing guest
- Sources expandable for verification

### 2. Go Deeper (Contextual Chat)

**User story:** "I want to explore this topic further with the expert who advised me."

**Flow:**
1. User clicks "Go Deeper with [Guest]" from problem solver results
2. Full-page chat opens with context preserved:
   - Shows the original problem
   - Shows which segments informed the previous answer
3. User can ask follow-up questions
4. AI responds as the guest, grounded in actual podcast content
5. After AI responses, **Related Views** appear:
   - System finds OTHER guests who discussed similar topics
   - Shows AI synthesis of their perspective + relationship (agrees/differs)
   - Collapsible raw Q&A for each related view
   - "Go Deeper with [Other Guest]" button to switch context

**Key UX:**
- Context continuity from problem solver → chat
- Related/contradicting views surface automatically
- AI synthesis over raw quotes throughout
- One click to explore another guest's perspective

### 3. Debate Mode (Integrated Contradiction Handling)

**User story:** "Brian just told me X, but I sense there might be other views."

**Flow:**
1. User is chatting with Guest X
2. AI detects that Guest Y has a contradictory/different POV
3. UI shows contextual intervention:
   ```
   ⚡ Marty Cagan has a different take on this.

   [Ask Brian about this]  [Bring Marty in]  [Noted ✕]
   ```
4. User chooses:
   - **"Ask Brian about this"** → System asks current guest to address the disagreement
   - **"Bring Marty in"** → Spawns debate mode with both guests
   - **"Noted"** → Dismiss, continue single-guest chat

**Debate Mode UI:**
- Shows both guests with their backgrounds
- Guests take turns responding
- User can address questions to both or specific guest (@Brian, @Marty)
- Each response still cites sources

**Key UX:**
- Contradictions emerge IN CONTEXT, not as separate feature
- Debate feels like a natural escalation, not a mode switch
- Always explain the CONTEXT behind disagreement
- Provide "resolution hints" (why both might be right in different situations)

### 4. Knowledge Graph (Explore)

**User story:** "I want to discover connections I didn't know to look for."

**Flow:**
1. Visual graph of topics, guests, frameworks, companies
2. Start zoomed out (topic clusters only)
3. Click to drill down into specific topics/guests
4. Filter by: topic area, guest, time period, connection strength
5. Click any node to see related episodes and insights

**Key UX:**
- Progressive disclosure (start simple, add complexity on demand)
- Node size = importance (episode count, centrality)
- Edge thickness = connection strength
- Cluster coloring for visual grouping

---

## Information Architecture

```
LennyTapes
├── Home / Search
│   └── Results (grouped by type)
│       └── Individual insight cards with citations
├── Roleplay
│   ├── Guest picker (cards with signatures)
│   └── Chat interface
│       └── Debate mode (when contradiction triggered)
├── Explore (Graph)
│   ├── Overview (topic clusters)
│   └── Drill-down (guests, episodes, frameworks)
└── About
```

---

## Multi-Agent Architecture for Debates

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR AGENT                         │
│  - Manages conversation state                                   │
│  - Detects when to surface contradictions                       │
│  - Routes messages to appropriate guest agent(s)                │
│  - Determines speaking order in debates                         │
│  - Ensures all responses are grounded in actual content         │
└─────────────────────────────────────────────────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
   │ GUEST AGENT │      │ GUEST AGENT │      │ GUEST AGENT │
   │   (Brian)   │      │   (Marty)   │      │    (...)    │
   │             │      │             │      │             │
   │ - Profile   │      │ - Profile   │      │             │
   │ - Segments  │      │ - Segments  │      │             │
   │ - Style     │      │ - Style     │      │             │
   │ - Stances   │      │ - Stances   │      │             │
   └─────────────┘      └─────────────┘      └─────────────┘
```

### Conversation State

```typescript
interface ConversationState {
  mode: 'single' | 'debate';
  activeGuests: string[];           // ["brian-chesky"] or ["brian-chesky", "marty-cagan"]
  messages: Message[];
  topic: string;                    // Current discussion topic
  pendingContradiction?: {
    topic: string;
    otherGuest: string;
    otherGuestStance: string;
    segmentId: string;
  };
}

interface Message {
  role: 'user' | 'guest';
  guest?: string;                   // Which guest (for multi-guest debates)
  content: string;
  citations: Citation[];
}

interface Citation {
  episodeId: string;
  episodeTitle: string;
  guest: string;
  timestamp: string;
  youtubeUrl: string;
}
```

### Orchestrator Logic

```typescript
async function orchestrate(state: ConversationState, userMessage: string) {
  // 1. Get response from active guest(s)
  if (state.mode === 'single') {
    const response = await getGuestResponse(state.activeGuests[0], state, userMessage);

    // 2. Check for contradictions against OTHER guests (not currently active)
    const contradiction = await detectContradiction(response, state);

    return { responses: [response], contradiction };
  }

  if (state.mode === 'debate') {
    // Determine speaking order based on who was addressed
    const addressedGuest = detectAddressedGuest(userMessage, state.activeGuests);

    if (addressedGuest) {
      // Single guest responds
      const response = await getGuestResponse(addressedGuest, state, userMessage);
      return { responses: [response] };
    } else {
      // Both guests respond
      const responses = await Promise.all(
        state.activeGuests.map(guest => getGuestResponse(guest, state, userMessage))
      );
      return { responses };
    }
  }
}

async function addGuestToDebate(state: ConversationState, newGuest: string) {
  state.mode = 'debate';
  state.activeGuests.push(newGuest);

  // New guest "enters" with their take
  const entrance = await generateGuestEntrance(newGuest, state);

  // Original guest may respond
  const rebuttal = await generateRebuttal(state.activeGuests[0], entrance, state);

  return { entrance, rebuttal };
}
```

### Contradiction Detection

```typescript
async function detectContradiction(
  currentResponse: GuestResponse,
  state: ConversationState
): Promise<Contradiction | null> {
  // 1. Extract claims from current response
  const claims = currentResponse.claims;

  // 2. Search for opposing claims from OTHER guests
  const opposingSegments = await findOpposingClaims(
    claims,
    state.topic,
    state.activeGuests  // Exclude current guests
  );

  if (opposingSegments.length === 0) return null;

  // 3. Use LLM to determine if meaningful disagreement
  const analysis = await analyzeDisagreement(
    claims,
    opposingSegments[0].claims,
    state.topic
  );

  if (analysis.isMeaningfulDisagreement) {
    return {
      topic: state.topic,
      otherGuest: opposingSegments[0].guestSlug,
      otherGuestName: opposingSegments[0].guestName,
      stance: analysis.opposingStance,
      context: analysis.context,
      segmentId: opposingSegments[0].id,
    };
  }

  return null;
}
```

---

## UI Components

### AI Advisor Results (Problem Solver)

```
┌─────────────────────────────────────────────────────────────────┐
│ YOUR QUESTION                                                   │
│ "How should I price my B2B SaaS?"                               │
│                                                                 │
│ BASED ON INSIGHTS FROM                                          │
│ [AD] [BB] [MC] [JP]  ← Clickable guest avatars                 │
│  April Brian Marty John                                         │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 💡 KEY INSIGHT                                                  │
│ Most experts recommend starting with value-based pricing...     │
│                                                                 │
│ 📋 FRAMEWORKS TO CONSIDER                                       │
│ • Value-Based Pricing (April Dunford)                           │
│ • Growth Model Alignment (Brian Balfour)                        │
│                                                                 │
│ ⚡ ACTIONABLE STEPS                                             │
│ 1. Interview 5-10 customers about perceived value               │
│ 2. Map your pricing to outcomes, not features                   │
│ 3. Test with new customers before changing existing             │
│                                                                 │
│ 💬 WHERE EXPERTS DIFFER                                         │
│ April emphasizes positioning first, while Brian...              │
│                                                                 │
│ 📚 SOURCES  [▼ Expand]                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Guest Contribution Popover

```
┌─────────────────────────────────────────────────────────────────┐
│ April Dunford on Pricing                               [✕]     │
│                                                                 │
│ AI SYNTHESIS                                                    │
│ April emphasizes that pricing should flow from positioning.     │
│ If customers understand the value, they'll pay for it...        │
│                                                                 │
│ ▼ RAW Q&A (click to expand)                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Q: "How should founders think about pricing?"               │ │
│ │ A: "You need to start with positioning first. If you nail   │ │
│ │     your positioning, pricing becomes much easier..."       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [◄ Before] [After ►]  ← navigate context                       │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│ [🔍 Go Deeper with April]  ← opens full chat page              │
└─────────────────────────────────────────────────────────────────┘
```

### Related View Card (in Chat)

```
┌─────────────────────────────────────────────────────────────────┐
│ [BW] Ben Williams  agrees                                       │
│                                                                 │
│ Ben emphasizes that companies need adequate time and tailored   │
│ trial experiences to properly evaluate a product and reach      │
│ core value milestones...                                        │
│                                                                 │
│ ▼ View full Q&A                                                 │
│                                                                 │
│ [🔍 Go Deeper with Ben]                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Legacy Search Results Card (deprecated)

```
┌─────────────────────────────────────────────────────────────────┐
│ 💡 INSIGHT                                                      │
│                                                                 │
│ "Price before you build - pricing is positioning, not just     │
│  a number you slap on at the end."                             │
│                                                                 │
│ ┌─────────┐  Madhavan Ramanujam                                │
│ │  Photo  │  Author, "Monetizing Innovation"                   │
│ └─────────┘  Ep. 47: The art of pricing      [▶ 23:45]         │
│                                                                 │
│ Context: Discussing B2B SaaS pricing strategy                   │
└─────────────────────────────────────────────────────────────────┘
```

### Guest Card (Roleplay Selection)

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─────────────┐                                                 │
│ │             │  BRIAN CHESKY                                   │
│ │    Photo    │  Co-founder & CEO, Airbnb                       │
│ │             │                                                 │
│ └─────────────┘  ─────────────────────────────                  │
│                                                                 │
│  Known for:                                                     │
│  • "Founder Mode" - staying in the details                      │
│  • Restructuring PM org post-IPO                                │
│  • Product-led brand building                                   │
│                                                                 │
│  3 episodes │ 147 segments │ 42 frameworks                      │
│                                                                 │
│  [Start conversation]                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Contradiction Intervention Banner

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ Marty Cagan has a different take on PM org structure.        │
│                                                                 │
│ He argues for empowered PMs who own discovery, while Brian      │
│ prefers founders staying close to product decisions.            │
│                                                                 │
│ [Ask Brian about this]  [Bring Marty in]  [Noted ✕]            │
└─────────────────────────────────────────────────────────────────┘
```

### Debate Header

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎭 DEBATE                                                       │
│                                                                 │
│ ┌───────────────┐           ⚔️           ┌───────────────┐     │
│ │ Brian Chesky  │                        │ Marty Cagan   │     │
│ │ Founder Mode  │                        │ Empowered PMs │     │
│ └───────────────┘                        └───────────────┘     │
│                                                                 │
│ Topic: How to structure a product organization                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Database | Supabase (Postgres + pgvector) |
| ORM | Drizzle |
| LLM Gateway | Vercel AI SDK |
| LLM Providers | Gemini 3 Flash (primary) → OpenAI (fallback) |
| Embeddings | OpenAI text-embedding-3-small |
| LLM Observability | Langfuse |
| Product Analytics | PostHog |
| Graph Visualization | D3.js or react-force-graph |
| Auth | Bypassed initially → Supabase Auth when needed |
| Hosting | Vercel |

---

## Branding & Typography

### Brand Identity

**Name:** LennyTapes
**Tagline:** "Search, explore, and pressure-test ideas from Lenny's Podcast"
**Short tagline:** "Deep dives into expert knowledge"

**Core Metaphor:** The cassette tape
- Tapes = Episodes/recordings
- Rewind/Fast-forward = Navigate through content
- Mix tape = Curated collections
- Labels = Guest names / topics

**Voice & Tone:**
- Curious and exploratory
- Playfully intelligent
- Respectfully challenging
- Never pretentious

**UI Copy Patterns:**
- Loading: "Rewinding the tape...", "Cueing up insights..."
- Empty: "This tape is blank", "Nothing recorded here yet"
- Error: "The tape got tangled", "Hit a snag in the reel"

### Theme System (Configurable)

Three typography directions, switchable at runtime. **Default: Retro-Tech**

#### Theme 1: Retro-Tech (Default)
*Playful, cassette-tape nostalgia, bold accents*

| Element | Font |
|---------|------|
| Headlines | Space Grotesk (geometric, retro-futuristic) |
| Body | Inter (clean, readable) |
| Mono | JetBrains Mono (timestamps, code) |

**Colors (Light):**
- Primary: `#FF6B35` (bold coral/orange)
- Accent: `#00D9C0` (electric teal)
- Background: `#FFFBF7` (warm cream)
- Text: `#1A1A2E` (warm dark)

**Special palette:** Purple `#6C63FF`, Yellow `#FFD93D`, Dark gray `#2D3436` (cassette elements)

#### Theme 2: Warm Knowledge
*Scholarly but warm, Substack/Readwise vibes*

| Element | Font |
|---------|------|
| Headlines | Newsreader (elegant variable serif) |
| Body | Source Sans 3 (humanist, readable) |
| Mono | IBM Plex Mono |

**Colors (Light):**
- Primary: `#2D5A47` (deep forest green)
- Accent: `#C9A227` (warm gold)
- Background: `#FDFCFA` (paper-white)
- Text: `#1C2420` (ink dark)

#### Theme 3: Modern Editorial
*Clean, tech-forward, Notion/Linear/Vercel vibes*

| Element | Font |
|---------|------|
| Headlines | Geist |
| Body | Geist |
| Mono | Geist Mono |

**Colors (Light):**
- Primary: `#000000` (pure black)
- Accent: `#7C3AED` (violet)
- Background: `#FFFFFF` (pure white)
- Text: `#0A0A0A` (near black)

### CSS Variables

All themes export to CSS variables for consistent usage:

```css
/* Typography */
--font-headline: "Space Grotesk", system-ui, sans-serif;
--font-body: "Inter", system-ui, sans-serif;
--font-mono: "JetBrains Mono", monospace;

/* Colors */
--color-primary: #FF6B35;
--color-accent: #00D9C0;
--bg-primary: #FFFBF7;
--text-primary: #1A1A2E;

/* Effects */
--radius-md: 0.5rem;
--shadow-md: 0 4px 6px rgba(26, 26, 46, 0.07);
--transition-normal: 250ms ease;
```

### Configuration Files

Theme configuration located at:
- `config/themes.ts` — Full theme definitions (colors, typography, effects)
- `config/fonts.ts` — Google Fonts URLs and Next.js font config
- `config/brand.ts` — Brand identity, logos, voice guidelines
- `config/index.ts` — Central exports

---

## Data Models

### Database Schema (Supabase)

```sql
-- Episodes (source metadata)
episodes (
  id UUID PRIMARY KEY,
  guest TEXT,
  guest_slug TEXT UNIQUE,
  title TEXT,
  youtube_url TEXT,
  video_id TEXT,
  publish_date DATE,
  duration_seconds INTEGER,
  description TEXT,
  keywords TEXT[]
)

-- Segments (chunked + extracted)
segments (
  id UUID PRIMARY KEY,
  episode_id UUID REFERENCES episodes,
  segment_key TEXT UNIQUE,
  speaker TEXT,
  timestamp TEXT,
  timestamp_seconds INTEGER,
  text TEXT,
  claims JSONB,           -- [{text, confidence}]
  frameworks JSONB,       -- [{name, description}]
  advice JSONB,           -- [{text, actionable}]
  stories JSONB,          -- [{summary, company, outcome}]
  qualifiers TEXT[],
  applies_when TEXT[],
  doesnt_apply_when TEXT[],
  "references" JSONB,     -- [{type, name}]
  embedding vector(1536)
)

-- Guest profiles (synthesized)
guests (
  id UUID PRIMARY KEY,
  name TEXT,
  slug TEXT UNIQUE,
  episode_count INTEGER,
  core_beliefs TEXT[],
  signature_frameworks TEXT[],
  recurring_phrases TEXT[],
  thinking_patterns TEXT[],
  background TEXT,
  companies_referenced TEXT[]
)

-- Tensions (pre-computed contradictions)
tensions (
  id UUID PRIMARY KEY,
  topic TEXT,
  positions JSONB,        -- [{guest, stance, context, segment_id}]
  resolution_hint TEXT
)

-- Graph edges
graph_edges (
  id UUID PRIMARY KEY,
  source_type TEXT,
  source_id TEXT,
  target_type TEXT,
  target_id TEXT,
  relationship TEXT,
  weight FLOAT,
  metadata JSONB
)
```

### Extracted Segment Structure

```typescript
interface ExtractedSegment {
  id: string;
  episodeId: string;
  speaker: string;
  timestamp: string;
  timestampSeconds: number;
  text: string;

  // Extracted content
  claims: Array<{
    text: string;
    confidence: 'strong_opinion' | 'tentative' | 'anecdote';
  }>;

  frameworks: Array<{
    name: string;
    description: string;
  }>;

  advice: Array<{
    text: string;
    actionable: boolean;
  }>;

  stories: Array<{
    summary: string;
    company?: string;
    outcome?: string;
  }>;

  // Context
  qualifiers: string[];      // "at our scale", "for B2B"
  appliesWhen: string[];
  doesntApplyWhen: string[];

  // References
  references: Array<{
    type: 'person' | 'company' | 'book' | 'concept';
    name: string;
  }>;

  // Vector (for semantic search)
  embedding: number[];
}
```

### Guest Profile Structure

```typescript
interface GuestProfile {
  name: string;
  slug: string;
  episodeIds: string[];

  // Intellectual fingerprint
  coreBeliefs: string[];
  signatureFrameworks: string[];
  recurringPhrases: string[];
  thinkingPatterns: string[];

  // Context
  background: string;
  companiesReferenced: string[];

  // Relationships
  agreesWith: string[];
  disagreesWith: string[];
}
```

---

## Langfuse Prompt Management

All prompts are stored and managed in Langfuse for:
- Version control and history
- A/B testing different prompt variations
- Iterating without code deployments
- Observability of prompt performance

### Prompts

| Prompt Name | Purpose | Variables |
|-------------|---------|-----------|
| `solve-synthesize` | Main synthesis for /api/solve | `{problem}`, `{context}` |
| `chat-guest` | Guest chat persona | `{guestName}`, `{guestProfile}`, `{relevantSegments}` |
| `extract-segment` | Pipeline extraction | `{transcript}` |
| `synthesize-related-view` | Analyze related guest views | `{mainResponse}`, `{otherGuestName}`, `{otherExcerpt}` |

### Implementation

- **`lib/prompts.ts`** — Fetches prompts from Langfuse with fallback to hardcoded
- **`scripts/upload-prompts.ts`** — Uploads prompts to Langfuse (`npm run upload-prompts`)
- **`USE_LANGFUSE_PROMPTS`** env var — Defaults to `true`, always use Langfuse

### Fallback Behavior

If Langfuse is unavailable or a prompt doesn't exist:
1. Silently fall back to hardcoded prompts in `lib/prompts.ts`
2. No noisy error logs
3. `getPromptWithMeta()` returns `promptVersion: "fallback"` for tracing

---

## Chat Guardrails

All chat responses must be grounded in retrieved transcript content:

```typescript
const SYSTEM_PROMPT = `You are simulating a conversation with ${guestName} based on their
appearances on Lenny's Podcast.

STRICT RULES:
1. ONLY express views ${guestName} has actually stated in the provided transcript excerpts
2. ALWAYS cite the episode and timestamp for each claim
3. If asked about something they haven't discussed, say:
   "I haven't addressed this specifically on the podcast, but based on my general philosophy..."
4. NEVER fabricate quotes or opinions
5. Stay in character but maintain intellectual honesty

GUEST PROFILE:
${guestProfile}

RELEVANT TRANSCRIPT EXCERPTS:
${relevantSegments}
`;
```

---

## API Routes

```
/api/solve  [NEW - Primary entry point]
  POST { problem: string }
  → {
      problem: string,
      answer: {
        keyInsight: string,
        frameworks: [{ name, description, from }],
        actionableSteps: string[],
        whereTheyDiffer?: string
      },
      contributors: [{
        name, slug, avatarInitials,
        segments: [{ id, timestamp, text, youtubeUrl, episodeTitle }]
      }]
    }

/api/chat/contextual  [NEW - Context-aware chat with related views]
  POST { guestSlug, messages, problem?, segmentIds? }
  → {
      response: string,
      citations: Citation[],
      relatedViews: [{
        type: "agrees" | "differs",
        guestName, guestSlug, avatarInitials,
        synthesis: string,
        rawText: string,
        timestamp, youtubeUrl
      }]
    }

/api/segments/[id]/adjacent  [NEW - Before/after context]
  GET ?direction=before|after
  → { segment: Segment | null }

/api/search  [Legacy - still works]
  POST { query: string }
  → { results: SearchResult[], contradictions?: Contradiction[] }

/api/chat  [Legacy - basic chat]
  POST { guestSlug: string, messages: Message[] }
  → { response: GuestResponse }

/api/graph
  GET ?filter=topic&value=hiring
  → { nodes: GraphNode[], edges: GraphEdge[] }

/api/guests
  GET
  → { guests: GuestSummary[] }

/api/guests/:slug
  GET
  → { profile: GuestProfile, episodes: Episode[], topFrameworks: Framework[] }

/api/explore
  GET ?topic=string
  → { viewpoints: Viewpoint[] }

/api/stats
  GET
  → { episodes, segments, guests, lastUpdated }
```

---

## Project Structure

```
lennytapes/
├── app/
│   ├── globals.css                 # ✅ Theme CSS variables
│   ├── layout.tsx                  # ✅ Root layout with fonts
│   ├── page.tsx                    # ✅ Home / Problem input
│   ├── search/
│   │   └── page.tsx                # ✅ AI Advisor results (rewritten)
│   ├── chat/
│   │   └── [slug]/
│   │       └── page.tsx            # ✅ Full-page contextual chat (NEW)
│   ├── guest/
│   │   └── [slug]/
│   │       └── page.tsx            # ✅ Guest profile page
│   ├── guests/
│   │   └── page.tsx                # ✅ Guest list
│   ├── explore/
│   │   └── page.tsx                # ✅ Explore viewpoints
│   ├── graph/
│   │   └── page.tsx                # ✅ Knowledge graph
│   └── api/
│       ├── solve/route.ts          # ✅ AI synthesis endpoint (NEW)
│       ├── search/route.ts         # ✅ Legacy search API
│       ├── chat/
│       │   ├── route.ts            # ✅ Basic chat API
│       │   └── contextual/route.ts # ✅ Context-aware chat (NEW)
│       ├── segments/
│       │   └── [id]/
│       │       └── adjacent/route.ts # ✅ Before/after segments (NEW)
│       ├── explore/route.ts        # ✅ Explore API
│       ├── graph/route.ts          # ✅ Graph data API
│       ├── guests/
│       │   ├── route.ts            # ✅ Guests list API
│       │   └── [slug]/route.ts     # ✅ Guest detail API
│       └── stats/route.ts          # ✅ Home page stats
├── components/
│   ├── GuestChat.tsx               # ✅ Chat interface
│   ├── GuestContributionPopover.tsx # ✅ Contributor popover (NEW)
│   ├── RelatedViewCard.tsx         # ✅ Related views display (NEW)
│   └── ui/                         # ✅ Reusable UI components
├── config/
│   ├── index.ts                    # ✅ Central exports
│   ├── themes.ts                   # ✅ Theme definitions
│   ├── fonts.ts                    # ✅ Google Fonts config
│   └── brand.ts                    # ✅ Brand identity
├── lib/
│   ├── config.ts                   # ✅ App config (threshold 0.3)
│   ├── db.ts                       # ✅ Supabase client
│   ├── llm.ts                      # ✅ LLM gateway with retry
│   ├── prompts.ts                  # ✅ Langfuse prompt management (NEW)
│   ├── types.ts                    # ✅ TypeScript types
│   └── utils.ts                    # ✅ Helper functions
├── scripts/
│   ├── pipeline.ts                 # ✅ Full extraction pipeline
│   ├── upload-prompts.ts           # ✅ Upload prompts to Langfuse (NEW)
│   ├── retry-failed.ts             # ✅ Retry failed segments
│   ├── verify-db.ts                # ✅ Verify DB connection
│   ├── embed.ts                    # ✅ Generate embeddings
│   ├── synthesize.ts               # ⏳ Build guest profiles
│   └── detect-tensions.ts          # ⏳ Pre-compute contradictions
├── data/
│   └── pipeline-log.json           # ✅ Extraction progress
├── next.config.mjs                 # ✅ Next.js config
├── tailwind.config.ts              # ✅ Tailwind with theme tokens
├── postcss.config.cjs              # ✅ PostCSS config
├── tsconfig.json                   # ✅ TypeScript config
├── package.json                    # ✅ Dependencies
├── .env                            # ✅ Environment variables
└── DESIGN.md                       # ✅ This document

Legend: ✅ Done | 🔄 In Progress | ⏳ Pending
```

---

## Task Tracker

> **Last updated:** 2026-01-31
> **Current focus:** AI Advisor UX redesign complete

### Phase 1: Data Foundation

| Task | Status | Notes |
|------|--------|-------|
| Set up Supabase schema | ✅ Done | episodes, segments with pgvector |
| Build extraction pipeline | ✅ Done | `scripts/pipeline.ts` with retry logic |
| Build embedding script | ✅ Done | `scripts/embed.ts` - Gemini embeddings (1536d) |
| Create match_segments RPC | ✅ Done | `scripts/setup-search.sql` |
| Run 303-episode extraction | 🔄 Running | Pipeline active in background |
| Generate embeddings | ⏳ Pending | Run `npm run embed` after pipeline |
| Build guest profile synthesis | ⏳ Pending | `scripts/synthesize.ts` |
| Pre-compute tensions | ⏳ Pending | `scripts/detect-tensions.ts` |

### Phase 2: AI Advisor (Search Redesign)

| Task | Status | Notes |
|------|--------|-------|
| Create /api/solve endpoint | ✅ Done | Structured synthesis output |
| Build contributor avatars | ✅ Done | Shows who informed the answer |
| Build GuestContributionPopover | ✅ Done | AI synthesis + raw Q&A + Go Deeper |
| Rewrite search results page | ✅ Done | `app/search/page.tsx` - problem solver UI |
| Add before/after segment nav | ✅ Done | `/api/segments/[id]/adjacent` |
| Lower similarity threshold | ✅ Done | Changed 0.7 → 0.3 for better recall |

### Phase 3: Contextual Chat

| Task | Status | Notes |
|------|--------|-------|
| Build full-page chat | ✅ Done | `/chat/[slug]` with context |
| Create contextual chat API | ✅ Done | `/api/chat/contextual` |
| Add related views | ✅ Done | Other guests who agree/differ |
| Build RelatedViewCard | ✅ Done | AI synthesis + collapsible Q&A |
| Context continuity | ✅ Done | Problem + segments passed via URL |

### Phase 4: Guest Features

| Task | Status | Notes |
|------|--------|-------|
| Build guests list page | ✅ Done | `/guests` |
| Build guest profile page | ✅ Done | `/guest/[slug]` with tabs |
| Create guests API routes | ✅ Done | `/api/guests`, `/api/guests/[slug]` |
| Build chat with guest | ✅ Done | `components/GuestChat.tsx` |
| Create chat API route | ✅ Done | `/api/chat` with RAG |
| Add citation system | ✅ Done | Sources shown in chat |

### Phase 5: Explore & Graph

| Task | Status | Notes |
|------|--------|-------|
| Build explore viewpoints page | ✅ Done | `/explore` - compare expert takes |
| Create explore API | ✅ Done | `/api/explore` |
| Create graph API route | ✅ Done | `/api/graph` |
| Build graph visualization | ✅ Done | `/graph` - canvas force-directed |
| Implement node drill-down | ✅ Done | Click node → panel → view profile |
| Multi-guest debate mode | ⏳ Future | Three-way debates |

### Phase 6: Infrastructure

| Task | Status | Notes |
|------|--------|-------|
| Theme system | ✅ Done | Retro-Tech theme active |
| Langfuse prompt management | ✅ Done | `lib/prompts.ts` with fallbacks |
| Upload prompts script | ✅ Done | `npm run upload-prompts` |
| Real-time stats | ✅ Done | `/api/stats` → home page |
| Loading states | ✅ Done | Tape spinner animation |
| Error/404 pages | ✅ Done | App + Pages router |
| LLM observability | ✅ Done | Langfuse tracing |
| Mobile responsiveness | ⏳ Pending | Test & fix |

---

## Completed Milestones

| Date | Milestone |
|------|-----------|
| 2026-01-30 | Project initialized, DESIGN.md created |
| 2026-01-30 | Supabase schema deployed |
| 2026-01-30 | Extraction pipeline built with retry logic |
| 2026-01-30 | Theme system (Retro-Tech default) |
| 2026-01-30 | Next.js app scaffolded |
| 2026-01-30 | Search API + UI built |
| 2026-01-30 | Guest profiles + chat feature |
| 2026-01-30 | Explore viewpoints feature |
| 2026-01-30 | Knowledge graph visualization |
| 2026-01-30 | Production build fixed |
| 2026-01-30 | Real-time stats on home page |
| 2026-01-31 | **AI Advisor UX redesign** - replaced raw search with synthesized guidance |
| 2026-01-31 | Langfuse prompt management system with fallbacks |
| 2026-01-31 | Guest contribution popovers (AI synthesis + raw Q&A) |
| 2026-01-31 | Full-page contextual chat (`/chat/[slug]`) |
| 2026-01-31 | Related/contradicting views with AI synthesis |
| 2026-01-31 | Before/after segment navigation |
| 2026-01-31 | Lowered similarity threshold (0.7 → 0.3) for better recall |

---

## Key Design Principles

1. **AI synthesis over raw results** — Users want actionable guidance, not transcripts to read through. Always synthesize first, offer raw content as drill-down.

2. **Attribution is non-negotiable** — Every insight shows who said it, when, with a link to verify. Guest avatars make contributors visible.

3. **Contradictions are features, not bugs** — Smart people disagree; surface related/differing views automatically to build trust.

4. **Context changes everything** — Advice from a post-IPO CEO vs early-stage founder is different. Preserve context through the entire flow.

5. **Grounded, not fabricated** — AI only says what guests actually said; admits gaps. Raw Q&A always available for verification.

6. **Progressive disclosure** — Start with synthesis, let users "Go Deeper" on demand with any contributing guest.

7. **YouTube is the source of truth** — One click to verify any claim at the exact timestamp.

---

## Open Questions

1. **How do we handle guests with only one episode?** Limited data for roleplay accuracy.

2. **Should debates allow 3+ guests?** More complex but richer for multi-faceted topics.

3. **How do we prevent repetitive responses?** Guest might have said the same thing multiple times.

4. **Caching strategy?** Common questions could benefit from pre-computed responses.

5. **Mobile experience for graph?** May need a different interaction model.

---

*Document maintained alongside codebase in `/Users/islamshaalan/Projects/lennytapes/DESIGN.md`*
