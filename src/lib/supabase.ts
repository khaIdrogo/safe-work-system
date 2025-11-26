import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.https://vwqcehjjtufbrqzvscpt.supabase.co!;
const supabaseKey = process.env.sb_publishable__6bTQj-CVRBxFCPQj3aMEg_NuawcJfN!;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}
export const supabase = createClient(supabaseUrl, supabaseKey);
