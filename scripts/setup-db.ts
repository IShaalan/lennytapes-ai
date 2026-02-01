/**
 * Setup database schema in Supabase
 *
 * This script:
 * 1. Tests the connection
 * 2. Enables pgvector extension
 * 3. Creates all tables
 * 4. Creates indexes
 */

import { supabase, isDbConfigured } from "../lib/db.js";

const SCHEMA_SQL = `
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Episodes table (source metadata)
CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest TEXT NOT NULL,
  guest_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  youtube_url TEXT,
  video_id TEXT,
  publish_date DATE,
  duration_seconds INTEGER,
  description TEXT,
  keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on guest_slug to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS episodes_guest_slug_idx ON episodes(guest_slug);

-- Segments table (chunked + extracted)
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  segment_key TEXT NOT NULL,
  speaker TEXT NOT NULL,
  timestamp TEXT,
  timestamp_seconds INTEGER,
  text TEXT NOT NULL,

  -- Extracted data (JSONB for flexibility)
  claims JSONB DEFAULT '[]',
  frameworks JSONB DEFAULT '[]',
  advice JSONB DEFAULT '[]',
  stories JSONB DEFAULT '[]',
  qualifiers TEXT[] DEFAULT '{}',
  applies_when TEXT[] DEFAULT '{}',
  doesnt_apply_when TEXT[] DEFAULT '{}',
  "references" JSONB DEFAULT '[]',

  -- Vector embedding (1536 dimensions for OpenAI embeddings)
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicate segments
CREATE UNIQUE INDEX IF NOT EXISTS segments_key_idx ON segments(segment_key);

-- Index for episode lookups
CREATE INDEX IF NOT EXISTS segments_episode_id_idx ON segments(episode_id);

-- Index for speaker filtering
CREATE INDEX IF NOT EXISTS segments_speaker_idx ON segments(speaker);

-- Guest profiles table (synthesized)
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  episode_count INTEGER DEFAULT 0,
  core_beliefs TEXT[] DEFAULT '{}',
  signature_frameworks TEXT[] DEFAULT '{}',
  recurring_phrases TEXT[] DEFAULT '{}',
  thinking_patterns TEXT[] DEFAULT '{}',
  background TEXT,
  companies_referenced TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tensions table (contradictions)
CREATE TABLE IF NOT EXISTS tensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  positions JSONB NOT NULL,
  resolution_hint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for topic searches
CREATE INDEX IF NOT EXISTS tensions_topic_idx ON tensions(topic);

-- Frameworks table
CREATE TABLE IF NOT EXISTS frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  description TEXT,
  coined_by TEXT,
  used_by TEXT[] DEFAULT '{}',
  mention_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on normalized name
CREATE UNIQUE INDEX IF NOT EXISTS frameworks_name_normalized_idx ON frameworks(name_normalized);

-- Graph edges table (flexible relationship storage)
CREATE TABLE IF NOT EXISTS graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  weight FLOAT DEFAULT 1.0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for graph traversal
CREATE INDEX IF NOT EXISTS graph_edges_source_idx ON graph_edges(source_type, source_id);
CREATE INDEX IF NOT EXISTS graph_edges_target_idx ON graph_edges(target_type, target_id);
CREATE INDEX IF NOT EXISTS graph_edges_relationship_idx ON graph_edges(relationship);
`;

async function testConnection(): Promise<boolean> {
  console.log("Testing Supabase connection...");

  // Use a simple health check - try to access the API
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY || "",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    });

    if (response.ok || response.status === 200) {
      console.log("✓ Connection successful");
      return true;
    }

    console.error("Connection error: HTTP", response.status);
    return false;
  } catch (error) {
    console.error("Connection error:", error);
    return false;
  }
}

async function setupSchema(): Promise<boolean> {
  console.log("\nSetting up database schema...");

  // Split SQL into individual statements
  const statements = SCHEMA_SQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    const { error } = await supabase.rpc("exec_sql", { sql: statement + ";" }).single();

    if (error) {
      // Try direct execution for CREATE EXTENSION
      if (statement.includes("CREATE EXTENSION")) {
        console.log("Note: pgvector extension may need to be enabled in Supabase dashboard");
        continue;
      }

      // Ignore "already exists" errors
      if (
        error.message.includes("already exists") ||
        error.message.includes("duplicate key")
      ) {
        continue;
      }

      console.error(`Error executing: ${statement.slice(0, 50)}...`);
      console.error(error.message);
    }
  }

  return true;
}

async function setupSchemaDirectly(): Promise<boolean> {
  console.log("\nSetting up database schema via direct SQL...");
  console.log("Please run the following SQL in your Supabase SQL Editor:\n");
  console.log("--- COPY FROM HERE ---");
  console.log(SCHEMA_SQL);
  console.log("--- COPY TO HERE ---\n");
  console.log("Go to: Supabase Dashboard → SQL Editor → New Query → Paste → Run");
  return true;
}

async function verifyTables(): Promise<boolean> {
  console.log("\nVerifying tables...");

  const tables = ["episodes", "segments", "guests", "tensions", "frameworks", "graph_edges"];

  for (const table of tables) {
    const { error } = await supabase.from(table).select("*").limit(1);

    if (error && error.code === "42P01") {
      console.log(`✗ Table '${table}' does not exist`);
      return false;
    } else if (error) {
      console.log(`? Table '${table}': ${error.message}`);
    } else {
      console.log(`✓ Table '${table}' exists`);
    }
  }

  return true;
}

async function main() {
  if (!isDbConfigured()) {
    console.error("Supabase credentials not configured in .env");
    process.exit(1);
  }

  // Test connection
  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }

  // Check if tables exist
  const tablesExist = await verifyTables();

  if (!tablesExist) {
    console.log("\n⚠️  Tables not found. Please create them manually:");
    await setupSchemaDirectly();
    console.log("\nAfter running the SQL, run this script again to verify.");
    process.exit(0);
  }

  console.log("\n✓ Database setup complete!");
}

main().catch(console.error);
