-- Vector similarity search function for LennyTapes
-- Run this in Supabase SQL Editor

-- Create the match_segments function for semantic search
CREATE OR REPLACE FUNCTION match_segments(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  episode_id uuid,
  segment_key text,
  speaker text,
  "timestamp" text,
  timestamp_seconds int,
  "text" text,
  claims jsonb,
  frameworks jsonb,
  advice jsonb,
  stories jsonb,
  qualifiers text[],
  applies_when text[],
  doesnt_apply_when text[],
  "references" jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
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
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM segments s
  WHERE s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create index for faster similarity search (if not exists)
CREATE INDEX IF NOT EXISTS segments_embedding_idx
ON segments
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Grant access to the function
GRANT EXECUTE ON FUNCTION match_segments TO anon, authenticated, service_role;
