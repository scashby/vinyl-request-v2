import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseSecretKey = (process.env.SUPABASE_SECRET_KEY ?? '').trim();

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY).'
  );
}

export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
