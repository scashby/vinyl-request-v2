import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Use in Server Components, Route Handlers, and Server Actions.
 * Cookie writes silently no-op when called from a Server Component (no
 * response to attach to) — middleware.ts is what actually persists the
 * refreshed session on every request.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — no-op, middleware handles refresh.
        }
      },
    },
  });
}
