const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in environment variables. Skipping DB initialization.');
    return;
  }

  console.log('Connecting to the database to apply schema...');
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Database connection successful.');

    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying database schema from schema.sql...');
    await client.query(schemaSql);
    console.log('✅ Database schema applied successfully.');

  } catch (error) {
    console.error('❌ Error during database initialization:', error.message);
    // Log the error but don't exit, as the app might still run if the schema already exists.
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

// Run the initialization
initializeDatabase();