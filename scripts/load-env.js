const dotenv = require('dotenv');
const path = require('path');

// Resolve path to the project root from this script's directory
const projectRoot = path.resolve(__dirname, '..');

// Load .env.local first to give it priority
dotenv.config({ path: path.join(projectRoot, '.env.local') });

// Load .env, which will not override variables already set from .env.local
dotenv.config({ path: path.join(projectRoot, '.env') });