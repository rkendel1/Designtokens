const { createClient } = require('@supabase/supabase-js');

// These variables are expected to be set in the environment.
// The Supabase integration in Dyad will handle this automatically.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set. Supabase client will not be initialized.');
  module.exports = null;
} else {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  module.exports = supabase;
}