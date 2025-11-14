import { createClient } from '@supabase/supabase-js';

// Use the specific environment variables provided in the .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseService = null;
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase service client not initialized. This is okay for most operations, but PDF uploads will fail. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
} else {
  supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false
    }
  });
}

export default supabaseService;