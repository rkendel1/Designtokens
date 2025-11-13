import { createClient } from '@supabase/supabase-js';

// Use the specific environment variables provided in the .env file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseService = null;
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase URL or Service Role Key not set. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables.');
} else {
  supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false
    }
  });
}

export default supabaseService;