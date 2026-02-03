// src/lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from 'types/supabase';

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const publishableKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ''
).trim();

if (!url || !publishableKey) {
  throw new Error(
    'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY).'
  );
}

export function supabaseServer(authHeader?: string) {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false },
    global: authHeader
      ? {
          headers: {
            Authorization: authHeader,
          },
        }
      : undefined,
  });
}

export function getAuthHeader(request: Request) {
  return request.headers.get('authorization') ?? undefined;
}
