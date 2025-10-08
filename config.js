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
  llm: {
    provider: process.env.LLM_PROVIDER || 'openai', // 'openai' or 'ollama'
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama2'
  },
  crawler: {
    maxDepth: parseInt(process.env.MAX_CRAWL_DEPTH) || 3,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT_MS) || 60000,
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 5,
    userAgent: 'DesignTokensCrawler/1.0',
    rotateUserAgents: process.env.ROTATE_USER_AGENTS === 'true',
    browser: process.env.BROWSER_TYPE || 'chromium', // 'chromium', 'firefox', 'webkit', or 'random'
    rotateBrowsers: process.env.ROTATE_BROWSERS === 'true',
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.RETRY_DELAY_MS) || 1000,
    handleLazyLoad: process.env.HANDLE_LAZY_LOAD !== 'false',
    scrollSteps: parseInt(process.env.SCROLL_STEPS) || 3,
    scrollDelay: parseInt(process.env.SCROLL_DELAY_MS) || 500
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL_SECONDS) || 3600
  }
};
