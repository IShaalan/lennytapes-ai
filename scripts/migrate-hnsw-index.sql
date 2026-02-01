-- Migration: Replace IVFFlat with HNSW index
-- Run this in Supabase SQL Editor
--
-- HNSW provides better accuracy than IVFFlat, especially for smaller result sets.
-- This fixes the issue where relevant results were missed with low match_count values.

-- Step 1: Drop the existing IVFFlat index
DROP INDEX IF EXISTS segments_embedding_idx;

-- Step 2: Create HNSW index
-- Parameters:
--   m = 16: Number of connections per layer (default, good balance of speed/accuracy)
--   ef_construction = 64: Build-time quality (higher = better index, slower build)
CREATE INDEX segments_embedding_hnsw_idx ON segments
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 3: Set search parameters for better recall
-- ef_search = 100: Query-time quality (higher = better recall, slightly slower)
-- This is set at the session level; for production, set it in your connection pooler config
-- or at the beginning of each query session
ALTER SYSTEM SET hnsw.ef_search = 100;

-- Reload config to apply changes
SELECT pg_reload_conf();

-- Verify the new index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'segments' AND indexname LIKE '%embedding%';
