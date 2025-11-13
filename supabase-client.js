import { createClient } from '@supabase/supabase-js';

// Use the specific environment variables provided in the .env file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This will now be the clear error message during deployment if secrets are missing.
  throw new Error('Supabase client failed to initialize. Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Please provide these environment variables to your deployment environment.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;