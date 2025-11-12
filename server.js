const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const config = require('./config');
const crawler = require('./crawler');
const llm = require('./llm');
const supabase = require('./supabase-client'); // New Supabase client
const generateBrandProfilePDF = require('./pdf-generator'); // Updated PDF generator
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
    const { url, skipCache = false } = req.body;

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
    const crawlData = await crawler.crawlDeep(url, { takeScreenshot: true }) || {};

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

    // --- Generate PDF, Upload to Supabase, and Persist Data ---
    const brandId = uuidv4();
    let pdfUrl = null;

    if (supabase) {
      try {
        // 1. Generate PDF
        const pdfBuffer = await generateBrandProfilePDF({ ...semanticBrandKit, url, brandId });

        // 2. Upload PDF to Supabase Storage
        const pdfPath = `${brandId}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('brand-kits') // Bucket name
          .upload(pdfPath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // 3. Get public URL for the PDF
        const { data: urlData } = supabase.storage
          .from('brand-kits')
          .getPublicUrl(pdfPath);
        
        pdfUrl = urlData.publicUrl;

      } catch (error) {
        console.error('Supabase PDF upload error:', error);
        // Don't fail the whole request, just log the error and proceed without a PDF URL
      }
    }

    // --- Finalize and Respond ---
    const finalResponse = {
      ...semanticBrandKit,
      brandId: brandId,
      url: crawlData.url,
      logo: {
        ...(semanticBrandKit.logo || {}),
        url: crawlData.logoUrl
      },
      generatedAt: new Date().toISOString(),
      pdfKitUrl: pdfUrl, // Use the real Supabase URL
      status: "ready"
    };

    // 4. Persist the final brand kit JSON to Supabase table
    if (supabase) {
      try {
        const { error: insertError } = await supabase
          .from('brand_kits') // Table name
          .insert([{ 
              brandId: finalResponse.brandId,
              url: finalResponse.url,
              name: finalResponse.name,
              kit_data: finalResponse // Store the whole object
          }]);
        
        if (insertError) throw insertError;

      } catch (error) {
        console.error('Supabase insert error:', error);
        // Log and continue
      }
    }

    cache.set(cacheKey, finalResponse);
    res.json(finalResponse);

  } catch (error) {
    console.error('Crawl error:', error);
    res.status(500).json({ error: 'Failed to crawl site', message: error.message });
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
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;