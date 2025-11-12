const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function setupSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('Supabase environment variables not set. Skipping Supabase setup.');
    return;
  }

  console.log('Connecting to Supabase to verify schema...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Run the schema.sql file to create tables
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    const { error: rpcError } = await supabase.rpc('eval', { query: schemaSql });
    if (rpcError) {
      // Ignore "already exists" errors for idempotency
      if (rpcError.message.includes('already exists')) {
        console.log('Tables and extensions already exist.');
      } else {
        throw rpcError;
      }
    } else {
      console.log('Successfully applied database schema.');
    }

    // 2. Check for 'brand-kits' storage bucket and create if not exists
    const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
    if (bucketListError) throw bucketListError;

    const bucketExists = buckets.some(bucket => bucket.name === 'brand-kits');

    if (!bucketExists) {
      console.log("Creating 'brand-kits' storage bucket...");
      const { error: createBucketError } = await supabase.storage.createBucket('brand-kits', {
        public: true, // Make files publicly accessible via URL
      });
      if (createBucketError) throw createBucketError;
      console.log("'brand-kits' bucket created successfully.");
    } else {
      console.log("'brand-kits' storage bucket already exists.");
    }

    console.log('Supabase setup verified successfully.');

  } catch (error) {
    console.error('Error during Supabase setup:', error.message);
    // Exit gracefully if setup fails, as the app likely can't run.
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupSupabase().catch(console.error);
}

module.exports = setupSupabase;