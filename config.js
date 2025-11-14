// Environment variables are now loaded by server.js or init-db.js

export default {
  port: process.env.PORT || 3000,
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/designtokens'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  onkernel: {
    apiKey: process.env.KERNEL_API_KEY
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
    scrollDelay: parseInt(process.env.SCROLL_DELAY_MS) || 500,
    // Browser optimization settings
    headless: process.env.BROWSER_HEADLESS !== 'false', // Default to true, set to 'false' to disable
    blockResources: process.env.BLOCK_RESOURCES !== 'false', // Block images, fonts, media by default
    useOnKernel: process.env.USE_ONKERNEL !== 'false', // Use OnKernel for Chromium when available
    maxBrowserInstances: parseInt(process.env.MAX_BROWSER_INSTANCES) || 3,
    maxContextsPerBrowser: parseInt(process.env.MAX_CONTEXTS_PER_BROWSER) || 5,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MS) || 300000, // 5 minutes
    pageTimeout: parseInt(process.env.PAGE_TIMEOUT_MS) || 30000,
    navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT_MS) || 60000,
    interceptRequests: process.env.INTERCEPT_REQUESTS === 'true',
    proxy: process.env.PROXY_URL || null,
    // Parallel execution settings
    parallelSteps: process.env.PARALLEL_STEPS === 'true',
    maxParallelJobs: parseInt(process.env.MAX_PARALLEL_JOBS) || 2
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL_SECONDS) || 3600
  }
};