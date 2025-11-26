
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vwqcehjjtufbrqzvscpt.supabase.co';
const supabaseKey = 'sb_publishable__6bTQj-CVRBxFCPQj3aMEg_NuawcJfN';

export const supabase = createClient(supabaseUrl, supabaseKey);
