const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set. Supabase client will not be initialized.');
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

module.exports = supabase;