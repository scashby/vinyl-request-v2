import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// NOTE: Legacy alias. This client does NOT bypass RLS.
// Prefer using supabaseServer() for request-scoped auth.

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ''
).trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
  );
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
// AUDIT: inspected, no changes.
