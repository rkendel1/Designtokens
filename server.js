const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const config = require('./config');
const crawler = require('./crawler');
const llm = require('./llm');
const store = require('./store'); // Use the refactored store
const supabase = require('./supabase-client');
const supabaseService = require('./supabase-service-client');
const generateBrandProfilePDF = require('./pdf-generator');
const { v4: uuidv4 } = require('uuid');

const app = express();
const cache = new NodeCache({ stdTTL: config.cache.ttl });

const isLlmConfigured = config.openai.apiKey && config.openai.apiKey.startsWith('sk-');

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

    const crawlData = await crawler.crawlDeep(url, { takeScreenshot: true }) || {};
    crawlData.structuredData = crawlData.structuredData || {};
    crawlData.meta = crawlData.meta || {};
    crawlData.textContent = crawlData.textContent || "";
    crawlData.designTokens = crawlData.designTokens || {};

    if (!isLlmConfigured) {
      console.warn('LLM not configured. Skipping AI synthesis and returning raw crawl data.');
      const rawResponse = {
        site: { url: crawlData.url, domain: crawlData.domain, title: crawlData.meta.title, description: crawlData.meta.description },
        companyInfo: crawlData.structuredData,
        designTokens: crawlData.designTokens,
        message: 'LLM not configured. This is raw data without AI analysis.'
      };
      cache.set(cacheKey, rawResponse);
      return res.json(rawResponse);
    }

    const semanticBrandKit = await llm.generateSemanticBrandKit(crawlData);
    if (!semanticBrandKit) {
      return res.status(500).json({ error: 'Failed to generate brand kit from LLM.' });
    }

    // --- Save all data to the structured tables ---
    const savedData = await store.saveCrawlResult(crawlData, semanticBrandKit);
    const brandId = savedData.siteId; // Use the site ID as the brandId

    let pdfUrl = null;
    if (supabaseService) {
      try {
        const pdfBuffer = await generateBrandProfilePDF({ ...savedData, url, brandId });
        const pdfPath = `${brandId}.pdf`;
        const { error: uploadError } = await supabaseService.storage
          .from('brand-kits')
          .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('brand-kits').getPublicUrl(pdfPath);
        pdfUrl = urlData.publicUrl;
      } catch (error) {
        console.error('Supabase PDF upload error:', error);
      }
    }

    const finalResponse = {
      ...savedData,
      brandId: brandId,
      url: crawlData.url,
      generatedAt: new Date().toISOString(),
      pdfKitUrl: pdfUrl,
      status: "ready"
    };

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