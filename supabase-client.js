import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key not set. Please check SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.');
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export default supabase;