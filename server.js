const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const config = require('./config');
const crawler = require('./crawler');
const llm = require('./llm');
const store = require('./store');
const { resizeLogo } = require('./image-processor');
const { v4: uuidv4 } = require('uuid');

const app = express();
const cache = new NodeCache({ stdTTL: config.cache.ttl });

// Check if LLM is configured
const isLlmConfigured = config.openai.apiKey && config.openai.apiKey.startsWith('sk-');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /crawl - Main crawling endpoint
app.post('/api/crawl', async (req, res) => {
  try {
    const { url, depth = 1, skipCache = false } = req.body;

    // Validate URL
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check cache
    const cacheKey = `crawl:${url}`;
    if (!skipCache) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json({ ...cached, fromCache: true });
    }

    // --- Crawl and Extract Raw Data ---
    const crawlData = await crawler.crawlDeep(url, { depth, takeScreenshot: true }) || {};

    // Ensure safe defaults for crawl data
    crawlData.structuredData = crawlData.structuredData || {};
    crawlData.cssVariables = crawlData.cssVariables || {};
    crawlData.computedStyles = crawlData.computedStyles || {};
    crawlData.meta = crawlData.meta || {};
    crawlData.textContent = crawlData.textContent || "";

    // --- AI Synthesis ---
    if (!isLlmConfigured) {
      return res.status(400).json({ error: 'LLM is not configured. Cannot generate semantic brand kit.' });
    }

    const semanticBrandKit = await llm.generateSemanticBrandKit(crawlData);

    if (!semanticBrandKit) {
      return res.status(500).json({ error: 'Failed to generate brand kit from LLM.' });
    }

    // --- Finalize and Respond ---
    const brandId = uuidv4();
    const finalResponse = {
      ...semanticBrandKit,
      brandId: brandId,
      url: crawlData.url,
      logo: {
        ...semanticBrandKit.logo,
        url: crawlData.logoUrl // Ensure we use the direct URL
      },
      generatedAt: new Date().toISOString(),
      pdfKitUrl: `https://your-supabase.supabase.co/storage/v1/object/public/brand-kits/${brandId}.pdf`, // Placeholder
      status: "ready"
    };

    cache.set(cacheKey, finalResponse);
    res.json(finalResponse);

  } catch (error) {
    console.error('Crawl error:', error);
    res.status(500).json({ error: 'Failed to crawl site', message: error.message });
  }
});

// GET /sites/:id - Get complete site data
app.get('/api/sites/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await store.getCompleteSiteData(id);
    if (!data.site) return res.status(404).json({ error: 'Site not found' });
    res.json(data);
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ error: 'Failed to retrieve site data' });
  }
});

// GET /sites/:id/tokens - Get design tokens
app.get('/api/sites/:id/tokens', async (req, res) => {
  try {
    const { id } = req.params;
    const tokens = await store.getDesignTokensBySiteId(id);
    res.json({ tokens });
  } catch (error) {
    console.error('Get tokens error:', error);
    res.status(500).json({ error: 'Failed to retrieve design tokens' });
  }
});

// GET /sites/:id/brand-profile - Generate brand profile PDF
app.get('/api/sites/:id/brand-profile', async (req, res) => {
  try {
    const { id } = req.params;
    const generatePDF = require('./pdf-generator');
    const data = await store.getCompleteSiteData(id);
    if (!data.site) return res.status(404).json({ error: 'Site not found' });

    const pdfBuffer = await generatePDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="brand-profile-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  const PORT = config.port;
  const server = app.listen(PORT, () => {
    console.log(`Design Tokens API server running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    server.close(async () => {
      await crawler.close();
      await store.close();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;