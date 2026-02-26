import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseServiceRoleKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  ''
).trim();

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).'
  );
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const raw = parts[1] ?? '';
  const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  try {
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const getJwtRole = (token: string): string | null => {
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  if (typeof role === 'string' && role.trim().length > 0) return role.trim();

  const appMeta = payload?.app_metadata;
  if (appMeta && typeof appMeta === 'object') {
    const metaRole = (appMeta as Record<string, unknown>).role;
    if (typeof metaRole === 'string' && metaRole.trim().length > 0) return metaRole.trim();
  }

  return null;
};

export const supabaseAdminJwtRole = getJwtRole(supabaseServiceRoleKey) ?? 'unknown';
export const isSupabaseAdminServiceRole = supabaseAdminJwtRole === 'service_role';

export const requireSupabaseAdminServiceRole = () => {
  if (!isSupabaseAdminServiceRole) {
    const keyHint =
      supabaseServiceRoleKey.split('.').length >= 3
        ? 'The key looks JWT-shaped but did not include a role claim.'
        : 'The key does not look like a Supabase API key (JWT). You may have set the JWT secret or database password by mistake.';
    throw new Error(
      `Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY must be a Supabase service_role API key (Supabase Dashboard → Project Settings → API → service_role). Detected role: ${supabaseAdminJwtRole}. ${keyHint}`
    );
  }
};

export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
