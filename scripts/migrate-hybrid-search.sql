-- Migration: Add Hybrid Search (Semantic + Full-Text)
-- Run this in Supabase SQL Editor AFTER migrate-hnsw-index.sql
--
-- Hybrid search combines vector similarity with keyword matching for better recall.
-- This ensures queries like "onboarding" or "Adam Fishman" return expected results.

-- Step 1: Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS segments_text_search_idx ON segments
USING gin(to_tsvector('english', text));

-- Step 2: Create hybrid_search function
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 20,
  semantic_weight FLOAT DEFAULT 0.7,
  keyword_weight FLOAT DEFAULT 0.3,
  match_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  episode_id UUID,
  segment_key TEXT,
  speaker TEXT,
  "timestamp" TEXT,
  timestamp_seconds INT,
  "text" TEXT,
  claims JSONB,
  frameworks JSONB,
  advice JSONB,
  stories JSONB,
  qualifiers TEXT[],
  applies_when TEXT[],
  doesnt_apply_when TEXT[],
  "references" JSONB,
  semantic_similarity FLOAT,
  keyword_rank FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  max_keyword_rank FLOAT;
BEGIN
  -- First, get the max keyword rank for normalization
  SELECT MAX(ts_rank_cd(to_tsvector('english', s.text), plainto_tsquery('english', query_text)))
  INTO max_keyword_rank
  FROM segments s
  WHERE to_tsvector('english', s.text) @@ plainto_tsquery('english', query_text);

  -- Handle case where no keyword matches (avoid division by zero)
  IF max_keyword_rank IS NULL OR max_keyword_rank = 0 THEN
    max_keyword_rank := 1;
  END IF;

  RETURN QUERY
  WITH semantic AS (
    -- Get top candidates by semantic similarity
    SELECT
      s.id,
      s.episode_id,
      s.segment_key,
      s.speaker,
      s."timestamp",
      s.timestamp_seconds,
      s."text",
      s.claims,
      s.frameworks,
      s.advice,
      s.stories,
      s.qualifiers,
      s.applies_when,
      s.doesnt_apply_when,
      s."references",
      1 - (s.embedding <=> query_embedding) AS sim
    FROM segments s
    WHERE s.embedding IS NOT NULL
      AND 1 - (s.embedding <=> query_embedding) > match_threshold
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count * 5  -- Get more candidates for merging
  ),
  keyword AS (
    -- Get keyword matches
    SELECT
      s.id,
      ts_rank_cd(to_tsvector('english', s.text), plainto_tsquery('english', query_text)) / max_keyword_rank AS normalized_rank
    FROM segments s
    WHERE to_tsvector('english', s.text) @@ plainto_tsquery('english', query_text)
  ),
  keyword_only AS (
    -- Get segments that match keywords but might not be in semantic top results
    SELECT
      s.id,
      s.episode_id,
      s.segment_key,
      s.speaker,
      s."timestamp",
      s.timestamp_seconds,
      s."text",
      s.claims,
      s.frameworks,
      s.advice,
      s.stories,
      s.qualifiers,
      s.applies_when,
      s.doesnt_apply_when,
      s."references",
      1 - (s.embedding <=> query_embedding) AS sim
    FROM segments s
    WHERE s.embedding IS NOT NULL
      AND to_tsvector('english', s.text) @@ plainto_tsquery('english', query_text)
      AND s.id NOT IN (SELECT sem.id FROM semantic sem)
    LIMIT match_count
  ),
  combined AS (
    SELECT * FROM semantic
    UNION
    SELECT * FROM keyword_only
  )
  SELECT
    c.id,
    c.episode_id,
    c.segment_key,
    c.speaker,
    c."timestamp",
    c.timestamp_seconds,
    c."text",
    c.claims,
    c.frameworks,
    c.advice,
    c.stories,
    c.qualifiers,
    c.applies_when,
    c.doesnt_apply_when,
    c."references",
    c.sim AS semantic_similarity,
    COALESCE(kw.normalized_rank, 0)::FLOAT AS keyword_rank,
    ((c.sim * semantic_weight) + (COALESCE(kw.normalized_rank, 0) * keyword_weight))::FLOAT AS combined_score
  FROM combined c
  LEFT JOIN keyword kw ON c.id = kw.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Step 3: Grant access to the function
GRANT EXECUTE ON FUNCTION hybrid_search TO anon, authenticated, service_role;

-- Step 4: Verify the function and indexes
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('match_segments', 'hybrid_search');

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'segments';
