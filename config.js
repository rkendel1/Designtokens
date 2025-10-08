const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/designtokens'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  crawler: {
    maxDepth: parseInt(process.env.MAX_CRAWL_DEPTH) || 3,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000,
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 5,
    userAgent: 'DesignTokensCrawler/1.0'
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL_SECONDS) || 3600
  }
};
