const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseService = null;
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase service role key not set. Service client will not be initialized.');
} else {
  supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false
    }
  });
}

module.exports = supabaseService;