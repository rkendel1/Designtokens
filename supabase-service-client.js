const { createClient } = require('@supabase/supabase-js');

// These variables are expected to be set in the environment.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase service role key not set. Service client will not be initialized.');
  module.exports = null;
} else {
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false
    }
  });
  module.exports = supabaseService;
}