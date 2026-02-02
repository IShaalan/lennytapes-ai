# LennyTapes

AI-powered advisor that synthesizes expert guidance from Lenny's Podcast guests.

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at localhost:3000
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run pipeline` | Process transcripts (ingest → extract → embed) |
| `npm run upload-prompts` | Upload prompts to Langfuse |
| `npm run seed-golden-dataset` | Seed evaluation dataset in Langfuse |
| `npm run evaluate-search` | Run search quality metrics |
| `npm run evaluate-search -- --compare` | Compare hybrid vs semantic search |

## Project Structure

```
app/                    # Next.js App Router
  api/solve/           # Main AI advisor endpoint
  api/chat/            # Guest chat endpoints
  api/segments/        # Segment context API
  search/              # Problem solver UI
  chat/[slug]/         # Guest chat page

lib/
  db.ts                # Supabase client
  llm.ts               # LLM calls (Gemini primary, OpenAI fallback)
  prompts.ts           # Langfuse prompt management
  search.ts            # Hybrid search utility

scripts/
  migrate-*.sql        # Database migrations (run manually in Supabase)
  *-search*.ts         # Search evaluation scripts

data/
  golden-queries.ts    # 54 evaluation queries
```

## Search Configuration

- **Index:** HNSW (replaced IVFFlat for better accuracy)
- **Method:** Hybrid search = semantic (70%) + keyword (30%)
- **Threshold:** 0.3 (lowered from 0.7)
- **Function:** `hybrid_search()` in Supabase

## Langfuse Prompts

| Name | Purpose |
|------|---------|
| `solve-synthesize` | AI advisor synthesis |
| `chat-guest` | Guest persona chat |
| `extract-segment` | Pipeline extraction |
| `synthesize-related-view` | Related views analysis |

## Environment Variables

Required in `.env`:
```
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=
```

## Important Notes

- **Migrations:** SQL files in `scripts/` must be run manually in Supabase SQL Editor
- **Prompts:** Managed in Langfuse; fallbacks exist in `lib/prompts.ts`
- **Embeddings:** 1536 dimensions (Gemini primary, OpenAI fallback)
- **Don't commit:** `.env` files (use `.env.example` as template)

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/solve` | Main AI advisor (problem → synthesized guidance) |
| `POST /api/chat/contextual` | Context-aware guest chat with related views |
| `GET /api/segments/[id]/adjacent` | Before/after segment context |
| `GET /api/guests` | List all guests |
| `GET /api/stats` | Database statistics |

## Code Patterns

- All LLM calls go through `lib/llm.ts` (handles retries, tracing)
- Prompts fetched via `getPrompt()` from `lib/prompts.ts`
- Search uses `search()` from `lib/search.ts` (wraps hybrid_search RPC)
- Supabase client from `lib/db.ts`

## See Also

- `DESIGN.md` — Full architecture, data models, design decisions
- `data/golden-queries.ts` — Search evaluation query definitions
