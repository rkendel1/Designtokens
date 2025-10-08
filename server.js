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

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

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

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check cache
    const cacheKey = `crawl:${url}`;
    if (!skipCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({ ...cached, fromCache: true });
      }
    }

    // Check if site already exists in DB
    let site = await store.getSiteByUrl(url);
    
    // Crawl the site
    console.log(`Crawling ${url}...`);
    const crawlData = await crawler.crawl(url, { depth, takeScreenshot: true });

    // Extract design tokens from CSS variables and computed styles
    const designTokens = [];
    
    // CSS Variables
    Object.entries(crawlData.cssVariables).forEach(([key, value]) => {
      designTokens.push({
        tokenKey: key,
        tokenType: 'css-variable',
        tokenValue: value,
        source: 'css'
      });
    });

    // Major colors
    const majorColors = crawler.extractMajorColors(crawlData.computedStyles);
    majorColors.forEach((color, index) => {
      designTokens.push({
        tokenKey: `color-${index + 1}`,
        tokenType: 'color',
        tokenValue: color,
        source: 'computed'
      });
    });

    // Major fonts
    const majorFonts = crawler.extractMajorFonts(crawlData.computedStyles);
    majorFonts.forEach((font, index) => {
      designTokens.push({
        tokenKey: `font-family-${index + 1}`,
        tokenType: 'typography',
        tokenValue: font,
        source: 'computed'
      });
    });

    // Spacing scale
    const spacingScale = crawler.extractSpacingScale(crawlData.computedStyles);
    spacingScale.forEach((spacing, index) => {
      designTokens.push({
        tokenKey: `spacing-${index + 1}`,
        tokenType: 'spacing',
        tokenValue: spacing,
        source: 'computed'
      });
    });

    // Use OpenAI to normalize design tokens
    console.log('Normalizing design tokens with AI...');
    const normalizedTokens = await llm.normalizeDesignTokens(designTokens.slice(0, 50)); // Limit for API

    // Analyze brand voice
    console.log('Analyzing brand voice...');
    const brandVoiceAnalysis = await llm.summarizeBrandVoice(crawlData.textContent);

    // Generate brand voice embedding
    const brandVoiceText = `${brandVoiceAnalysis.tone} ${brandVoiceAnalysis.personality} ${JSON.stringify(brandVoiceAnalysis.themes)}`;
    const embedding = await llm.generateEmbedding(brandVoiceText);

    // Extract company metadata
    console.log('Extracting company metadata...');
    const companyMetadata = await llm.extractCompanyMetadata(
      crawlData.html,
      crawlData.structuredData
    );

    // Store in database
    if (!site) {
      site = await store.createSite({
        url: crawlData.url,
        domain: crawlData.domain,
        title: crawlData.meta.title,
        description: crawlData.meta.description || companyMetadata.description,
        rawHtml: crawlData.html,
        screenshot: crawlData.screenshot
      });
    } else {
      site = await store.updateSite(site.id, {
        title: crawlData.meta.title,
        description: crawlData.meta.description || companyMetadata.description,
        rawHtml: crawlData.html,
        screenshot: crawlData.screenshot
      });
    }

    // Store company info
    const companyInfo = await store.createCompanyInfo({
      siteId: site.id,
      companyName: companyMetadata.companyName,
      legalName: companyMetadata.legalName,
      contactEmails: crawlData.structuredData.emails,
      contactPhones: crawlData.structuredData.phones,
      addresses: crawlData.structuredData.addresses,
      structuredJson: {
        socialLinks: crawlData.structuredData.socialLinks,
        industry: companyMetadata.industry,
        ...companyMetadata.metadata
      }
    });

    // Store design tokens
    const tokensToStore = normalizedTokens.map(token => ({
      siteId: site.id,
      tokenKey: token.normalizedKey || token.originalKey,
      tokenType: token.category,
      tokenValue: token.value,
      source: 'normalized',
      meta: {
        originalKey: token.originalKey,
        description: token.description
      }
    }));
    
    const storedTokens = await store.createDesignTokensBulk(tokensToStore);

    // Store products
    if (crawlData.structuredData.products.length > 0) {
      const productsToStore = crawlData.structuredData.products.map(product => ({
        siteId: site.id,
        name: product.name,
        slug: product.name.toLowerCase().replace(/\s+/g, '-'),
        price: product.price,
        description: null,
        productUrl: product.url,
        metadata: {}
      }));
      
      await store.createProductsBulk(productsToStore);
    }

    // Store brand voice
    const brandVoice = await store.createBrandVoice({
      siteId: site.id,
      summary: JSON.stringify(brandVoiceAnalysis),
      guidelines: brandVoiceAnalysis.guidelines || {},
      embedding: `[${embedding.join(',')}]` // PostgreSQL vector format
    });

    // Prepare response
    const response = {
      site: {
        id: site.id,
        url: site.url,
        domain: site.domain,
        title: site.title,
        description: site.description
      },
      companyInfo: {
        name: companyInfo.company_name,
        emails: companyInfo.contact_emails,
        phones: companyInfo.contact_phones,
        socialLinks: companyInfo.structured_json?.socialLinks || []
      },
      designTokens: storedTokens.slice(0, 20), // Return sample
      brandVoice: {
        tone: brandVoiceAnalysis.tone,
        personality: brandVoiceAnalysis.personality,
        themes: brandVoiceAnalysis.themes
      },
      stats: {
        totalTokens: storedTokens.length,
        totalProducts: crawlData.structuredData.products.length,
        crawledAt: site.crawled_at
      }
    };

    // Cache the result
    cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    console.error('Crawl error:', error);
    res.status(500).json({ 
      error: 'Failed to crawl site', 
      message: error.message 
    });
  }
});

// GET /sites/:id - Get complete site data
app.get('/api/sites/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await store.getCompleteSiteData(id);
    
    if (!data.site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ error: 'Failed to retrieve site data' });
  }
});

// GET /sites/:id/tokens - Get design tokens for a site
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
    if (!data.site) {
      return res.status(404).json({ error: 'Site not found' });
    }

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
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`Design Tokens API server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await crawler.close();
    await store.close();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(async () => {
    await crawler.close();
    await store.close();
    process.exit(0);
  });
});

module.exports = app;
