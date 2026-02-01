-- Migration: Fix Hybrid Search to use OR logic for keywords
-- Run this in Supabase SQL Editor to UPDATE the existing function
--
-- PROBLEM: plainto_tsquery('I'm building an onboarding flow') requires ALL words
-- SOLUTION: Use OR logic so ANY keyword match boosts the result

-- Step 1: Create helper function to convert text to OR-based tsquery
CREATE OR REPLACE FUNCTION text_to_or_tsquery(query_text TEXT)
RETURNS tsquery
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  words TEXT[];
  word TEXT;
  tsq tsquery;
  word_tsq tsquery;
BEGIN
  -- Split query into words, remove short words and common stop words
  words := regexp_split_to_array(lower(query_text), '\s+');
  tsq := NULL;

  FOREACH word IN ARRAY words
  LOOP
    -- Skip short words (likely stop words) and empty strings
    IF length(word) >= 3 THEN
      -- Remove punctuation and create tsquery for this word
      word := regexp_replace(word, '[^a-z0-9]', '', 'g');
      IF length(word) >= 3 THEN
        BEGIN
          word_tsq := to_tsquery('english', word || ':*');  -- Prefix matching
          IF tsq IS NULL THEN
            tsq := word_tsq;
          ELSE
            tsq := tsq || word_tsq;  -- OR logic
          END IF;
        EXCEPTION WHEN OTHERS THEN
          -- Skip words that can't be converted to tsquery
          NULL;
        END;
      END IF;
    END IF;
  END LOOP;

  -- Return empty tsquery if no valid words
  IF tsq IS NULL THEN
    RETURN to_tsquery('');
  END IF;

  RETURN tsq;
END;
$$;

-- Step 2: Update hybrid_search function with OR-based keyword matching
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
  or_tsquery tsquery;
BEGIN
  -- Convert query to OR-based tsquery (matches ANY word)
  or_tsquery := text_to_or_tsquery(query_text);

  -- First, get the max keyword rank for normalization
  SELECT MAX(ts_rank_cd(to_tsvector('english', s.text), or_tsquery))
  INTO max_keyword_rank
  FROM segments s
  WHERE to_tsvector('english', s.text) @@ or_tsquery;

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
    -- Get keyword matches using OR logic
    SELECT
      s.id,
      ts_rank_cd(to_tsvector('english', s.text), or_tsquery) / max_keyword_rank AS normalized_rank
    FROM segments s
    WHERE to_tsvector('english', s.text) @@ or_tsquery
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
      AND to_tsvector('english', s.text) @@ or_tsquery
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

-- Step 3: Grant access to the functions
GRANT EXECUTE ON FUNCTION text_to_or_tsquery TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION hybrid_search TO anon, authenticated, service_role;

-- Step 4: Test the OR tsquery conversion
SELECT text_to_or_tsquery('I''m building an onboarding flow');
-- Should return something like: 'build':* | 'onboard':* | 'flow':*

-- Step 5: Verify keyword matching improvement
-- This should now return more results for "onboarding"
SELECT COUNT(*) as onboarding_matches
FROM segments
WHERE to_tsvector('english', text) @@ text_to_or_tsquery('I''m building an onboarding flow');
