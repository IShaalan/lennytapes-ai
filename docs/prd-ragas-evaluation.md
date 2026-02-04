# PRD: RAGAS Evaluation Integration

## 1. Executive Summary

### Problem Statement
LennyTapes has custom IR metrics (Precision@K, MRR, NDCG) for search quality but lacks LLM-as-judge evaluation for RAG output quality. There's no way to measure if generated answers are faithful to retrieved context or relevant to user questions—especially in production where expected answers don't exist.

### Proposed Solution
Integrate RAGAS evaluation framework with existing Langfuse observability to enable:
1. **Offline evaluation** with full metrics against golden dataset
2. **Production evaluation** with reference-free metrics on sampled traffic
3. Unified quality dashboard in Langfuse

### Success Criteria
- Faithfulness score > 0.85 on 90% of evaluated responses
- Answer Relevancy score > 0.80 on 90% of evaluated responses
- Context Precision score > 0.75 on 90% of evaluated responses
- All 3 RAGAS scores visible in Langfuse dashboard alongside existing IR metrics
- Production evaluation running on configurable sample rate (starting at 100%)
- Evaluation runs async and does not block user responses

---

## 2. User Experience & Functionality

### User Personas

**Primary: Developer/Maintainer (You)**
- Wants to catch quality regressions before deploy
- Needs visibility into production answer quality
- Learning AI PM best practices

**Secondary: Community Users**
- Expect accurate, grounded answers from LennyTapes
- Benefit from quality improvements driven by evaluation data

### User Stories

**US-1: Offline Golden Dataset Evaluation**
> As a developer, I want to run RAGAS evaluation against the golden dataset so that I can measure answer quality before deploying prompt changes.

**Acceptance Criteria:**
- [ ] Run `npm run eval:ragas` to evaluate against golden dataset
- [ ] Metrics calculated: Faithfulness, Answer Relevancy, Context Precision, Context Recall
- [ ] Results logged to Langfuse with trace linkage
- [ ] Summary printed to console with pass/fail against thresholds
- [ ] Supports filtering by topic, type, difficulty (like existing evaluate-search.ts)

**US-2: Production Sampling Evaluation**
> As a developer, I want production queries automatically evaluated so that I can monitor quality drift without manual intervention.

**Acceptance Criteria:**
- [ ] Configurable sampling rate via environment variable (`RAGAS_SAMPLE_RATE=1.0`)
- [ ] Evaluation runs asynchronously (doesn't block user response)
- [ ] Reference-free metrics only: Faithfulness, Answer Relevancy, Context Precision
- [ ] Scores attached to existing Langfuse traces
- [ ] Low-scoring responses flagged for review

**US-3: Unified Langfuse Dashboard**
> As a developer, I want all quality metrics in one place so that I can correlate RAGAS scores with latency, cost, and user feedback.

**Acceptance Criteria:**
- [ ] RAGAS scores appear as Langfuse scores on traces
- [ ] Can filter traces by faithfulness < 0.85 to find problems
- [ ] Historical trend visible for quality metrics

### Non-Goals
- Building a custom evaluation UI (use Langfuse)
- Real-time alerting on quality drops (future iteration)
- Automatic prompt optimization based on scores (future iteration)
- Evaluating embedding quality (existing metrics cover this)

---

## 3. AI System Requirements

### Tool Requirements

| Tool | Purpose | Notes |
|------|---------|-------|
| RAGAS | LLM-as-judge evaluation | Python library, will need Python scripts |
| Langfuse SDK | Score ingestion | Already integrated in TypeScript |
| OpenAI/Gemini | Judge LLM for RAGAS | Use existing provider setup |

### Evaluation Strategy

#### Metrics to Implement

**Phase 1: Reference-Free Metrics Only**

| Metric | Offline | Production | Needs Ground Truth |
|--------|---------|------------|-------------------|
| Faithfulness | Yes | Yes | No |
| Answer Relevancy | Yes | Yes | No |
| Context Precision | Yes | Yes | No |

**Deferred (requires manual curation):**

| Metric | Offline | Production | Needs Ground Truth |
|--------|---------|------------|-------------------|
| Context Recall | Future | No | Yes (expected docs) |
| Answer Correctness | Future | No | Yes (expected answer) |

> **Rationale**: With 300+ hours of transcripts and a single maintainer, manually curating expected answers is impractical. Reference-free metrics catch the most common RAG failures (hallucinations, off-topic responses, bad retrieval) without requiring ground truth.

#### Evaluation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ OFFLINE (CI/pre-deploy)                                     │
│                                                             │
│  Golden Dataset ──> Run Search ──> Generate Answer          │
│        │                               │                    │
│        ▼                               ▼                    │
│  Expected Answer              Retrieved Context             │
│        │                               │                    │
│        └───────────> RAGAS <───────────┘                    │
│                        │                                    │
│                        ▼                                    │
│              All 5 Metrics ──> Langfuse                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PRODUCTION (sampled)                                        │
│                                                             │
│  User Query ──> Run Search ──> Generate Answer ──> Response │
│                     │                │                      │
│                     ▼                ▼                      │
│            Retrieved Context    Actual Answer               │
│                     │                │                      │
│                     └──> RAGAS (async) <─┘                  │
│                              │                              │
│                              ▼                              │
│                   3 Reference-Free Metrics ──> Langfuse     │
└─────────────────────────────────────────────────────────────┘
```

#### Quality Thresholds

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Faithfulness | > 0.85 | < 0.70 |
| Answer Relevancy | > 0.80 | < 0.65 |
| Context Precision | > 0.75 | < 0.60 |

---

## 4. Technical Specifications

### Architecture Overview

```
lennytapes/
├── lib/
│   └── evaluation/
│       ├── ragas.ts          # RAGAS wrapper (calls Python)
│       ├── sampler.ts        # Production sampling logic
│       └── types.ts          # Evaluation types
├── scripts/
│   ├── evaluate-ragas.ts     # Offline evaluation runner
│   └── python/
│       └── ragas_eval.py     # Python RAGAS implementation
├── data/
│   └── golden-queries.ts     # Existing (add expected answers)
└── .env
    └── RAGAS_SAMPLE_RATE=1.0
```

### Integration Points

#### 1. RAGAS Python Script
RAGAS is a Python library. We'll create a Python script that:
- Accepts JSON input (question, answer, contexts, expected_answer)
- Returns JSON output (scores)
- Called from TypeScript via child_process or HTTP

```python
# scripts/python/ragas_eval.py
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
```

#### 2. TypeScript Wrapper
```typescript
// lib/evaluation/ragas.ts
export interface RagasInput {
  question: string;
  answer: string;
  contexts: string[];
  ground_truth?: string; // Optional for production
}

export interface RagasScores {
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  context_recall?: number; // Only with ground_truth
}

export async function evaluateWithRagas(input: RagasInput): Promise<RagasScores>
```

#### 3. Langfuse Score Integration
```typescript
// After RAGAS evaluation
langfuse.score({
  traceId: trace.id,
  name: "ragas_faithfulness",
  value: scores.faithfulness,
});
langfuse.score({
  traceId: trace.id,
  name: "ragas_answer_relevancy",
  value: scores.answer_relevancy,
});
```

#### 4. Production Sampling Hook
Integrate into existing chat flow in `lib/llm.ts`:
```typescript
// In chat() function, after generating response
if (shouldSample()) {
  // Fire-and-forget async evaluation
  evaluateProductionQuery({
    traceId,
    question: userMessage,
    answer: response,
    contexts: relevantSegments,
  }).catch(console.error);
}
```

### Configuration

```bash
# .env additions
RAGAS_SAMPLE_RATE=1.0           # 0.0 to 1.0 (100% initially)
RAGAS_JUDGE_MODEL=gpt-4o-mini   # LLM for evaluation
RAGAS_ENABLED=true              # Kill switch
RAGAS_ASYNC=true                # Non-blocking in production
```

### Security & Privacy
- No PII stored in evaluation logs
- User queries logged to Langfuse (already happening)
- RAGAS judge calls use existing API keys
- No new external services required

---

## 5. Risks & Roadmap

### Phased Rollout

#### Phase 1: MVP (This PR)
- [ ] Python RAGAS script with 3 reference-free metrics (Faithfulness, Answer Relevancy, Context Precision)
- [ ] TypeScript wrapper to call Python via subprocess
- [ ] Offline evaluation script (`npm run eval:ragas`)
- [ ] Langfuse score integration
- [ ] GitHub Action for path-filtered CI runs

#### Phase 2: Production Integration
- [ ] Sampling configuration (`RAGAS_SAMPLE_RATE` env var)
- [ ] Async evaluation in chat flow (non-blocking)
- [ ] Error handling that doesn't impact user experience
- [ ] Langfuse dashboard views for quality monitoring

#### Phase 3: Feedback Loop (When Usage Grows)
- [ ] Flag low-scoring responses (faithfulness < 0.70) for review
- [ ] User feedback mechanism (thumbs up/down)
- [ ] Script to export flagged queries for annotation
- [ ] Curate ground truth from production data for Answer Correctness metric

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| RAGAS Python dependency adds complexity | Medium | Medium | Containerize or use subprocess |
| Evaluation latency impacts UX | Low | High | Async evaluation, don't block response |
| LLM-as-judge costs | Low | Low | Sample rate control, use cheaper models |
| RAGAS metric inconsistency | Medium | Medium | Pin RAGAS version, track over time |

### Dependencies
- Python 3.9+ (for RAGAS)
- `ragas` pip package
- Existing: Langfuse, OpenAI/Gemini API keys

---

## 6. Decisions Made

1. **Golden dataset expected answers**: **Deferred**
   - With 300+ hours of transcripts and a single maintainer, manual curation is impractical
   - Reference-free metrics (Faithfulness, Answer Relevancy, Context Precision) catch most RAG failures
   - Will revisit when usage grows and user feedback provides natural ground truth

2. **Python integration approach**: **Subprocess**
   - Simplest path to working code
   - Python not installed in production, but eval runs locally/CI only for now
   - Can extract to microservice later if needed

3. **Evaluation frequency**: **Path-filtered GitHub Action**
   - Runs on changes to: `lib/prompts.ts`, `lib/search.ts`, `lib/llm.ts`, `data/golden-queries.ts`
   - Avoids burning API credits on unrelated PRs
   - Estimated runtime: 2-3 minutes for 50 queries

---

## Appendix: Existing Golden Dataset Analysis

Current `data/golden-queries.ts` contains 50+ queries with:
- Query types: keyword, semantic, guest-specific, mixed
- Topics: growth, hiring, culture, roadmap, retention, etc.
- Difficulty: easy, medium, hard
- Expected guests and keywords

**Status**: Sufficient for Phase 1. No modifications needed.

The existing golden queries work perfectly for reference-free RAGAS evaluation. We use:
- `query` → question input
- Retrieved chunks → contexts input
- Generated response → answer input

No expected answers required for Faithfulness, Answer Relevancy, or Context Precision.
