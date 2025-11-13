/**
 * Examples demonstrating the enhanced crawler features
 */

console.log(`
Enhanced Crawler Features Examples
===================================
`);

// Example 1: Using local LLM (Ollama)
console.log(`
Example 1: Switch to Local LLM (Ollama)
========================================

# First, ensure Ollama is running:
ollama serve

# Pull a model if you haven't:
ollama pull llama2

# Configure environment:
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Then use the API normally:
curl -X POST http://localhost:3000/api/crawl \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'

# The LLM will use Ollama instead of OpenAI!
`);

// Example 2: Multi-browser crawling
console.log(`
Example 2: Multi-Browser Crawling
==================================

# Use Firefox:
BROWSER_TYPE=firefox npm start

# Use WebKit (Safari engine):
BROWSER_TYPE=webkit npm start

# Random browser selection:
BROWSER_TYPE=random npm start

# Enable browser rotation:
ROTATE_BROWSERS=true npm start
`);

// Example 3: Stealth crawling with user agent rotation
console.log(`
Example 3: Stealth Crawling
============================

# Enable all stealth features:
ROTATE_USER_AGENTS=true
ROTATE_BROWSERS=true
BROWSER_TYPE=random
HANDLE_LAZY_LOAD=true
RETRY_ATTEMPTS=5

# Then crawl normally:
curl -X POST http://localhost:3000/api/crawl \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://protected-site.com"}'
`);

// Example 4: Programmatic usage
console.log(`
Example 4: Programmatic Usage with Enhanced Features
=====================================================
`);

async function advancedCrawlExample() {
  const crawler = require('../crawler');
  const config = require('../config');

  try {
    // Configure for stealth
    config.crawler.rotateUserAgents = true;
    config.crawler.rotateBrowsers = true;
    config.crawler.browser = 'random';

    await crawler.init();

    const url = 'https://example.com';
    console.log(`Crawling ${url} with enhanced features...`);

    const data = await crawler.crawl(url, {
      depth: 1,
      takeScreenshot: true
    });

    console.log('Results:');
    console.log(`- Browser used: ${data.browserUsed}`);
    console.log(`- CAPTCHA detected: ${data.captchaDetected}`);
    console.log(`- Colors found: ${data.computedStyles.colors.length}`);
    console.log(`- Fonts found: ${data.computedStyles.fonts.length}`);

    if (data.captchaDetected) {
      console.warn('⚠️  CAPTCHA detected - may need manual intervention');
    }

    await crawler.close();
  } catch (error) {
    console.error('Crawl error:', error.message);
  }
}

// Uncomment to run:
// advancedCrawlExample();

// Example 5: CAPTCHA handling
console.log(`
Example 5: Handle CAPTCHA Detection
====================================
`);

async function crawlWithCaptchaHandling(url) {
  const crawler = require('../crawler');
  const config = require('../config');

  await crawler.init();
  
  let attempt = 0;
  const maxAttempts = 3;
  
  while (attempt < maxAttempts) {
    try {
      const data = await crawler.crawl(url);
      
      if (data.captchaDetected) {
        console.warn(`CAPTCHA detected on attempt ${attempt + 1}`);
        
        // Try with different browser/user agent
        config.crawler.rotateUserAgents = true;
        config.crawler.rotateBrowsers = true;
        
        attempt++;
        
        if (attempt < maxAttempts) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        } else {
          throw new Error('CAPTCHA persists after retries');
        }
      }
      
      // Success!
      return data;
    } catch (error) {
      if (attempt >= maxAttempts - 1) throw error;
      attempt++;
    }
  }
  
  await crawler.close();
}

// Uncomment to run:
// crawlWithCaptchaHandling('https://example.com')
//   .then(data => console.log('Success:', data))
//   .catch(err => console.error('Failed:', err));

// Example 6: Lazy load testing
console.log(`
Example 6: Test Lazy Load Handling
===================================
`);

async function testLazyLoad() {
  const crawler = require('../crawler');
  const config = require('../config');

  // Enable lazy load with custom settings
  config.crawler.handleLazyLoad = true;
  config.crawler.scrollSteps = 5;  // More steps for thorough loading
  config.crawler.scrollDelay = 1000;  // Wait 1 second between scrolls

  await crawler.init();

  const url = 'https://infinite-scroll-site.com';
  const data = await crawler.crawl(url);

  console.log(`Captured ${data.computedStyles.colors.length} colors`);
  console.log(`Including lazy-loaded content`);

  await crawler.close();
}

// Uncomment to run:
// testLazyLoad();

// Example 7: Using Ollama with LLM service
console.log(`
Example 7: Direct LLM Service Usage with Ollama
================================================
`);

async function ollamaLLMExample() {
  const llm = require('../llm');
  const config = require('../config');

  // Switch to Ollama
  config.llm.provider = 'ollama';
  config.llm.ollamaUrl = 'http://localhost:11434';
  config.llm.ollamaModel = 'llama2';

  try {
    // Generate brand summary
    const summary = await llm.generateBrandSummary({
      title: 'Acme Corp',
      description: 'Leading provider of innovative solutions',
      content: 'We are committed to excellence and customer satisfaction...',
      companyInfo: { companyName: 'Acme Corporation' }
    });

    console.log('Brand Summary (via Ollama):', summary);

    // Analyze brand voice
    const voice = await llm.summarizeBrandVoice(
      'Our friendly team is here to help you succeed. We believe in making technology accessible to everyone.'
    );

    console.log('Brand Voice (via Ollama):', voice);
  } catch (error) {
    console.error('LLM Error:', error.message);
    console.log('Make sure Ollama is running: ollama serve');
  }
}

// Uncomment to run:
// ollamaLLMExample();

// Example 8: Retry logic demonstration
console.log(`
Example 8: Retry Logic
======================

# Configure retry settings:
RETRY_ATTEMPTS=5
RETRY_DELAY_MS=2000

# The crawler will automatically retry failed requests with exponential backoff:
# - Attempt 1: Immediate
# - Attempt 2: Wait 2000ms
# - Attempt 3: Wait 4000ms
# - Attempt 4: Wait 6000ms
# - Attempt 5: Wait 8000ms

curl -X POST http://localhost:3000/api/crawl \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://unreliable-site.com"}'
`);

// Example 9: Complete configuration
console.log(`
Example 9: Complete Enhanced Configuration
===========================================

# Create a .env file with all enhanced features:

# LLM Configuration
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Browser Configuration
BROWSER_TYPE=random
ROTATE_BROWSERS=true
ROTATE_USER_AGENTS=true

# Retry Configuration
RETRY_ATTEMPTS=5
RETRY_DELAY_MS=1500

# Lazy Load Configuration
HANDLE_LAZY_LOAD=true
SCROLL_STEPS=4
SCROLL_DELAY_MS=800

# Start the server:
npm start

# All crawl requests will now use these enhanced features!
`);

console.log(`
For more detailed documentation, see ENHANCEMENTS.md
`);
