import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase credentials not configured. Database operations will fail.");
}

export const supabase = createClient(supabaseUrl || "", supabaseKey || "");

// Helper to check if DB is configured
export function isDbConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}
