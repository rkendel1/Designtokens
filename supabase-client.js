import { createClient } from '@supabase/supabase-js';

// Use the specific environment variables provided in the .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This will now be the clear error message during deployment if secrets are missing.
  throw new Error('Supabase client failed to initialize. Missing SUPABASE_URL or SUPABASE_ANON_KEY. Please provide these environment variables to your deployment environment.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;