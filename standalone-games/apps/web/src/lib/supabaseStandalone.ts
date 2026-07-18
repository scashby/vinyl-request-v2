import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getStandaloneSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.STANDALONE_SUPABASE_URL;
  const key = process.env.STANDALONE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Standalone Supabase is not configured. Set STANDALONE_SUPABASE_URL and STANDALONE_SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}

export function isStandaloneSupabaseConfigured(): boolean {
  return Boolean(
    process.env.STANDALONE_SUPABASE_URL &&
      process.env.STANDALONE_SUPABASE_SERVICE_ROLE_KEY
  );
}
