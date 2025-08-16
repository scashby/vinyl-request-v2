// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from 'types/supabase';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // add in Vercel

export function supabaseAdmin() {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false }
  });
}