const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const config = require('./config');
const crawler = require('./crawler');
const llm = require('./llm');
const store = require('./store');

const app = express();
const cache = new NodeCache({ stdTTL: config.cache.ttl });

// Check if LLM is configured
const isLlmConfigured = config.openai.apiKey && config.openai.apiKey !== 'your_openai_api_key_here';

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

    let site = await store.getSiteByUrl(url);
    let crawlData = await crawler.crawlDeep(url, { depth, takeScreenshot: true }) || {};

    // Ensure safe defaults for crawl data
    crawlData.structuredData = crawlData.structuredData || {};
    crawlData.cssVariables = crawlData.cssVariables || {};
    crawlData.computedStyles = crawlData.computedStyles || {};
    crawlData.meta = crawlData.meta || {};
    crawlData.textContent = crawlData.textContent || "";
    crawlData.structuredData.products = crawlData.structuredData.products || [];
    crawlData.structuredData.emails = crawlData.structuredData.emails || [];
    crawlData.structuredData.phones = crawlData.structuredData.phones || [];
    crawlData.structuredData.addresses = crawlData.structuredData.addresses || [];
    crawlData.structuredData.socialLinks = crawlData.structuredData.socialLinks || [];

    // Extract raw design tokens
    const designTokens = [];
    Object.entries(crawlData.cssVariables).forEach(([key, value]) => {
      designTokens.push({ tokenKey: key, tokenType: 'css-variable', tokenValue: value, source: 'css' });
    });
    crawler.extractMajorColors(crawlData.computedStyles).forEach((color, i) => {
      designTokens.push({ tokenKey: `color-${i + 1}`, tokenType: 'color', tokenValue: color, source: 'computed' });
    });
    crawler.extractMajorFonts(crawlData.computedStyles).forEach((font, i) => {
      designTokens.push({ tokenKey: `font-family-${i + 1}`, tokenType: 'typography', tokenValue: font, source: 'computed' });
    });
    crawler.extractSpacingScale(crawlData.computedStyles).forEach((spacing, i) => {
      designTokens.push({ tokenKey: `spacing-${i + 1}`, tokenType: 'spacing', tokenValue: spacing, source: 'computed' });
    });

    // --- AI Enrichment (Optional) ---
    let normalizedTokens, brandVoiceAnalysis, embedding, companyMetadata;

    if (isLlmConfigured) {
      normalizedTokens = await llm.normalizeDesignTokens(designTokens.slice(0, 50));
      brandVoiceAnalysis = await llm.summarizeBrandVoice(crawlData.textContent);
      const brandVoiceText = `${brandVoiceAnalysis.tone} ${brandVoiceAnalysis.personality}`;
      const embeddingVector = await llm.generateEmbedding(brandVoiceText);
      embedding = `[${embeddingVector.join(',')}]`;
      companyMetadata = await llm.extractCompanyMetadata(crawlData.html, crawlData.structuredData);
    } else {
      console.log('OpenAI API key not configured. Skipping LLM enrichment.');
      normalizedTokens = designTokens.map(t => ({ ...t, normalizedKey: t.tokenKey, category: t.tokenType, value: t.tokenValue, description: 'Raw token' }));
      brandVoiceAnalysis = { tone: 'N/A', personality: 'N/A', themes: [], guidelines: {} };
      embedding = null;
      companyMetadata = { companyName: 'N/A', description: 'N/A' };
    }

    // --- Database Operations ---
    if (!site) {
      site = await store.createSite({ url: crawlData.url, domain: crawlData.domain, title: crawlData.meta.title, description: crawlData.meta.description || companyMetadata.description, rawHtml: crawlData.html, screenshot: crawlData.screenshot });
    } else {
      site = await store.updateSite(site.id, { title: crawlData.meta.title, description: crawlData.meta.description || companyMetadata.description, rawHtml: crawlData.html, screenshot: crawlData.screenshot });
    }

    const companyInfo = await store.createCompanyInfo({ siteId: site.id, companyName: companyMetadata.companyName, legalName: companyMetadata.legalName, contactEmails: crawlData.structuredData.emails, contactPhones: crawlData.structuredData.phones, addresses: crawlData.structuredData.addresses, structuredJson: { socialLinks: crawlData.structuredData.socialLinks, industry: companyMetadata.industry, ...companyMetadata.metadata } });
    
    const tokensToStore = normalizedTokens.map(t => ({ siteId: site.id, tokenKey: t.normalizedKey, tokenType: t.category, tokenValue: t.value, source: isLlmConfigured ? 'normalized' : t.source, meta: { originalKey: t.originalKey || t.tokenKey, description: t.description } }));
    const storedTokens = await store.createDesignTokensBulk(tokensToStore);

    if (crawlData.structuredData.products.length > 0) {
      await store.createProductsBulk(crawlData.structuredData.products.map(p => ({ siteId: site.id, name: p.name, slug: p.name.toLowerCase().replace(/\s+/g, '-'), price: p.price, productUrl: p.url })));
    }

    await store.createBrandVoice({ siteId: site.id, summary: JSON.stringify(brandVoiceAnalysis), guidelines: brandVoiceAnalysis.guidelines, embedding });

    // --- Prepare Response ---
    const response = {
      site: { id: site.id, url: site.url, domain: site.domain, title: site.title, description: site.description },
      companyInfo: { name: companyInfo.company_name, emails: companyInfo.contact_emails, phones: companyInfo.contact_phones, socialLinks: companyInfo.structured_json?.socialLinks || [] },
      designTokens: storedTokens.slice(0, 20),
      brandVoice: { tone: brandVoiceAnalysis.tone, personality: brandVoiceAnalysis.personality, themes: brandVoiceAnalysis.themes },
      stats: { totalTokens: storedTokens.length, totalProducts: crawlData.structuredData.products.length, crawledAt: site.crawled_at }
    };

    cache.set(cacheKey, response);
    res.json(response);

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