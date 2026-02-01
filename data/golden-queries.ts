/**
 * Golden Dataset Query Definitions
 *
 * This file contains 50+ queries distributed across:
 * - Query Types: keyword, semantic, guest-specific, mixed
 * - Topics: growth, hiring, culture, roadmap, retention, onboarding, pricing, activation, OKR, PMF, positioning, metrics
 * - Difficulty: easy, medium, hard
 *
 * These queries are used for:
 * - Regression testing search quality
 * - Comparing semantic vs hybrid search algorithms
 * - Tracking Precision@K, Recall@K, MRR, NDCG over time
 */

export type QueryType = "keyword" | "semantic" | "guest-specific" | "mixed";
export type Difficulty = "easy" | "medium" | "hard";
export type ExpectedOutcome = "single-expert" | "multi-expert" | "framework-match" | "no-good-match";

export interface GoldenQuery {
  id: string;
  query: string;
  type: QueryType;
  topic: string;
  difficulty: Difficulty;
  expectedOutcome: ExpectedOutcome;
  expectedGuests?: string[];
  mustIncludeKeywords?: string[];
  notes?: string;
}

/**
 * Golden dataset queries organized by topic and type
 */
export const GOLDEN_QUERIES: GoldenQuery[] = [
  // ========================================
  // GROWTH (High coverage topic - 8 queries)
  // ========================================
  {
    id: "growth-001",
    query: "What are the best growth strategies for B2B SaaS?",
    type: "semantic",
    topic: "growth",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    notes: "Should return diverse growth perspectives from multiple guests",
  },
  {
    id: "growth-002",
    query: "growth loops and flywheel effects",
    type: "keyword",
    topic: "growth",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["growth", "loop", "flywheel"],
    notes: "Direct keyword match for growth frameworks",
  },
  {
    id: "growth-003",
    query: "How do I scale my startup without burning out the team?",
    type: "semantic",
    topic: "growth",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
    notes: "Requires understanding context about sustainable growth",
  },
  {
    id: "growth-004",
    query: "viral coefficient and word of mouth",
    type: "keyword",
    topic: "growth",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["viral", "word of mouth"],
  },
  {
    id: "growth-005",
    query: "What does Brian Balfour say about growth?",
    type: "guest-specific",
    topic: "growth",
    difficulty: "easy",
    expectedOutcome: "single-expert",
    expectedGuests: ["Brian Balfour"],
    mustIncludeKeywords: ["brian", "balfour"],
  },
  {
    id: "growth-006",
    query: "acquisition channels and CAC payback",
    type: "mixed",
    topic: "growth",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["acquisition", "cac"],
  },
  {
    id: "growth-007",
    query: "When should a startup focus on growth vs profitability?",
    type: "semantic",
    topic: "growth",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
    notes: "Trade-off question requiring nuanced perspectives",
  },
  {
    id: "growth-008",
    query: "product-led growth PLG strategy",
    type: "keyword",
    topic: "growth",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["product-led", "plg"],
  },

  // ========================================
  // HIRING (High coverage topic - 6 queries)
  // ========================================
  {
    id: "hiring-001",
    query: "How should I hire my first product manager?",
    type: "semantic",
    topic: "hiring",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    notes: "Common question with diverse perspectives",
  },
  {
    id: "hiring-002",
    query: "interview questions for PM candidates",
    type: "keyword",
    topic: "hiring",
    difficulty: "easy",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["interview", "question"],
  },
  {
    id: "hiring-003",
    query: "What qualities make a great product manager?",
    type: "semantic",
    topic: "hiring",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "hiring-004",
    query: "hiring senior engineers startup",
    type: "mixed",
    topic: "hiring",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["hiring", "engineer"],
  },
  {
    id: "hiring-005",
    query: "When to hire generalists vs specialists?",
    type: "semantic",
    topic: "hiring",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
    notes: "Trade-off question requiring context understanding",
  },
  {
    id: "hiring-006",
    query: "reference checks best practices",
    type: "keyword",
    topic: "hiring",
    difficulty: "easy",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["reference"],
  },

  // ========================================
  // CULTURE (High coverage topic - 5 queries)
  // ========================================
  {
    id: "culture-001",
    query: "How do you build a strong company culture?",
    type: "semantic",
    topic: "culture",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "culture-002",
    query: "Brian Chesky Airbnb culture",
    type: "guest-specific",
    topic: "culture",
    difficulty: "easy",
    expectedOutcome: "single-expert",
    expectedGuests: ["Brian Chesky"],
    mustIncludeKeywords: ["chesky", "airbnb"],
  },
  {
    id: "culture-003",
    query: "remote work culture challenges",
    type: "mixed",
    topic: "culture",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["remote"],
  },
  {
    id: "culture-004",
    query: "How do you maintain culture as you scale?",
    type: "semantic",
    topic: "culture",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
    notes: "Requires understanding of scaling challenges",
  },
  {
    id: "culture-005",
    query: "values and mission statements",
    type: "keyword",
    topic: "culture",
    difficulty: "easy",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["values", "mission"],
  },

  // ========================================
  // ROADMAP (Medium coverage topic - 4 queries)
  // ========================================
  {
    id: "roadmap-001",
    query: "How should I prioritize my product roadmap?",
    type: "semantic",
    topic: "roadmap",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "roadmap-002",
    query: "RICE prioritization framework",
    type: "keyword",
    topic: "roadmap",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["rice", "prioritization"],
  },
  {
    id: "roadmap-003",
    query: "How do you balance customer requests with your vision?",
    type: "semantic",
    topic: "roadmap",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
  },
  {
    id: "roadmap-004",
    query: "quarterly planning OKR alignment",
    type: "mixed",
    topic: "roadmap",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["okr", "planning"],
  },

  // ========================================
  // RETENTION (Medium coverage topic - 4 queries)
  // ========================================
  {
    id: "retention-001",
    query: "How do I improve user retention?",
    type: "semantic",
    topic: "retention",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "retention-002",
    query: "churn rate reduction strategies",
    type: "keyword",
    topic: "retention",
    difficulty: "easy",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["churn", "retention"],
  },
  {
    id: "retention-003",
    query: "What makes users come back to your product?",
    type: "semantic",
    topic: "retention",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    notes: "Semantic question about user stickiness",
  },
  {
    id: "retention-004",
    query: "cohort analysis retention curves",
    type: "keyword",
    topic: "retention",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["cohort", "retention"],
  },

  // ========================================
  // ONBOARDING (Medium coverage topic - 4 queries)
  // ========================================
  {
    id: "onboarding-001",
    query: "How do I improve my onboarding flow?",
    type: "semantic",
    topic: "onboarding",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "onboarding-002",
    query: "onboarding best practices checklist",
    type: "keyword",
    topic: "onboarding",
    difficulty: "easy",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["onboarding"],
  },
  {
    id: "onboarding-003",
    query: "What does Adam Fishman say about onboarding?",
    type: "guest-specific",
    topic: "onboarding",
    difficulty: "easy",
    expectedOutcome: "single-expert",
    expectedGuests: ["Adam Fishman"],
    mustIncludeKeywords: ["adam", "fishman"],
  },
  {
    id: "onboarding-004",
    query: "time to value first user experience",
    type: "mixed",
    topic: "onboarding",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["time to value", "experience"],
  },

  // ========================================
  // PRICING (Low coverage topic - 3 queries)
  // ========================================
  {
    id: "pricing-001",
    query: "How should I price my B2B SaaS product?",
    type: "semantic",
    topic: "pricing",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "pricing-002",
    query: "value-based pricing strategy",
    type: "keyword",
    topic: "pricing",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["pricing", "value"],
  },
  {
    id: "pricing-003",
    query: "When should I raise my prices?",
    type: "semantic",
    topic: "pricing",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
  },

  // ========================================
  // ACTIVATION (Low coverage topic - 3 queries)
  // ========================================
  {
    id: "activation-001",
    query: "How do I improve user activation?",
    type: "semantic",
    topic: "activation",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "activation-002",
    query: "aha moment magic moment activation",
    type: "keyword",
    topic: "activation",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["aha", "moment", "activation"],
  },
  {
    id: "activation-003",
    query: "Getting users to experience value quickly",
    type: "semantic",
    topic: "activation",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },

  // ========================================
  // OKR (Low coverage topic - 3 queries)
  // ========================================
  {
    id: "okr-001",
    query: "How should I set OKRs for my product team?",
    type: "semantic",
    topic: "okr",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "okr-002",
    query: "OKR objectives key results examples",
    type: "keyword",
    topic: "okr",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["okr", "objectives"],
  },
  {
    id: "okr-003",
    query: "Why do OKRs fail and how to fix them?",
    type: "semantic",
    topic: "okr",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
  },

  // ========================================
  // PMF (Very low coverage topic - 3 queries)
  // ========================================
  {
    id: "pmf-001",
    query: "How do I know if I have product-market fit?",
    type: "semantic",
    topic: "pmf",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    notes: "Core PMF question",
  },
  {
    id: "pmf-002",
    query: "product market fit indicators signals",
    type: "keyword",
    topic: "pmf",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["product-market fit", "pmf"],
  },
  {
    id: "pmf-003",
    query: "Signs my startup is working",
    type: "semantic",
    topic: "pmf",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
    notes: "Requires understanding context - maps to PMF",
  },

  // ========================================
  // POSITIONING (Low coverage topic - 3 queries)
  // ========================================
  {
    id: "positioning-001",
    query: "How do I position my product in the market?",
    type: "semantic",
    topic: "positioning",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "positioning-002",
    query: "April Dunford positioning strategy",
    type: "guest-specific",
    topic: "positioning",
    difficulty: "easy",
    expectedOutcome: "single-expert",
    expectedGuests: ["April Dunford"],
    mustIncludeKeywords: ["april", "dunford"],
  },
  {
    id: "positioning-003",
    query: "competitive differentiation messaging",
    type: "keyword",
    topic: "positioning",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["positioning", "differentiation"],
  },

  // ========================================
  // METRICS (Medium coverage topic - 4 queries)
  // ========================================
  {
    id: "metrics-001",
    query: "What metrics should I track for my startup?",
    type: "semantic",
    topic: "metrics",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "metrics-002",
    query: "north star metric examples",
    type: "keyword",
    topic: "metrics",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["north star", "metric"],
  },
  {
    id: "metrics-003",
    query: "How do I avoid vanity metrics?",
    type: "semantic",
    topic: "metrics",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "metrics-004",
    query: "DAU MAU engagement metrics",
    type: "keyword",
    topic: "metrics",
    difficulty: "easy",
    expectedOutcome: "framework-match",
    mustIncludeKeywords: ["dau", "mau", "engagement"],
  },

  // ========================================
  // ADDITIONAL MIXED QUERIES
  // ========================================
  {
    id: "misc-001",
    query: "When should a startup pivot?",
    type: "semantic",
    topic: "strategy",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
  },
  {
    id: "misc-002",
    query: "founder-led sales enterprise",
    type: "mixed",
    topic: "sales",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
    mustIncludeKeywords: ["founder", "sales"],
  },
  {
    id: "misc-003",
    query: "How do I communicate with my board?",
    type: "semantic",
    topic: "leadership",
    difficulty: "medium",
    expectedOutcome: "multi-expert",
  },
  {
    id: "misc-004",
    query: "What makes a great CEO?",
    type: "semantic",
    topic: "leadership",
    difficulty: "hard",
    expectedOutcome: "multi-expert",
  },
];

/**
 * Get queries filtered by criteria
 */
export function filterQueries(options: {
  type?: QueryType;
  topic?: string;
  difficulty?: Difficulty;
}): GoldenQuery[] {
  return GOLDEN_QUERIES.filter((q) => {
    if (options.type && q.type !== options.type) return false;
    if (options.topic && q.topic !== options.topic) return false;
    if (options.difficulty && q.difficulty !== options.difficulty) return false;
    return true;
  });
}

/**
 * Get query distribution statistics
 */
export function getQueryStats() {
  const byType: Record<QueryType, number> = {
    keyword: 0,
    semantic: 0,
    "guest-specific": 0,
    mixed: 0,
  };

  const byDifficulty: Record<Difficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  const byTopic: Record<string, number> = {};

  for (const query of GOLDEN_QUERIES) {
    byType[query.type]++;
    byDifficulty[query.difficulty]++;
    byTopic[query.topic] = (byTopic[query.topic] || 0) + 1;
  }

  return {
    total: GOLDEN_QUERIES.length,
    byType,
    byDifficulty,
    byTopic,
  };
}
