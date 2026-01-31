import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// NOTE: This client bypasses RLS policies! Use only server-side.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Updated to use the modern "Secret" key name
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase Admin environment variables');
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});