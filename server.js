require('dotenv').config(); // Load environment variables first
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const config = require('./config');
const crawler = require('./crawler');
const { processCrawl } = require('./core-logic');

const app = express();
const cache = new NodeCache({ stdTTL: config.cache.ttl });

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/crawl', async (req, res) => {
  try {
    const { url, skipCache = false } = req.body;

    if (!url) return res.status(400).json({ error: 'URL is required' });
    try { new URL(url); } catch (e) { return res.status(400).json({ error: 'Invalid URL format' }); }

    const cacheKey = `crawl:${url}`;
    if (!skipCache) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json({ ...cached, fromCache: true });
    }

    const finalResponse = await processCrawl(url);

    cache.set(cacheKey, finalResponse);
    res.json(finalResponse);

  } catch (error) {
    console.error('Crawl error:', error);
    res.status(500).json({ error: 'Failed to crawl site', message: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  const PORT = config.port;
  const server = app.listen(PORT, () => {
    console.log(`Design Tokens API server running on port ${PORT}`);
  });

  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    server.close(async () => {
      await crawler.close();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;