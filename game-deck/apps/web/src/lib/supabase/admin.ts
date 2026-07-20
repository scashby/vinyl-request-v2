import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

/**
 * Secret-key client — bypasses RLS. Server-only, never import from client code.
 * Supabase's `sb_secret_...` keys are opaque tokens, not JWTs — unlike the legacy
 * app's src/lib/supabaseAdmin.ts, there is no JWT role claim to decode here.
 * Use only for the signup-time account-provisioning trigger's own concerns and
 * other trusted, account-scope-checked-in-code server operations — everything
 * else should go through the RLS-enforced server/browser clients above.
 */
export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
