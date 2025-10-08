const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../config');

async function initDatabase() {
  const pool = new Pool({
    connectionString: config.database.connectionString
  });

  try {
    console.log('Initializing database...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await pool.query(schema);
    
    console.log('Database initialized successfully!');
    console.log('Tables created:');
    console.log('  - sites');
    console.log('  - company_info');
    console.log('  - design_tokens');
    console.log('  - products');
    console.log('  - brand_voice');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
