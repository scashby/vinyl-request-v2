// src/lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';
import { type Database } from 'types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
