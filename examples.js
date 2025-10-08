/**
 * Example usage of the Design Tokens Crawler API
 * 
 * This file demonstrates how to use the crawler programmatically
 * or via HTTP requests.
 */

// Example 1: Using the API via HTTP (with curl)
console.log(`
Example 1: Crawl a website using HTTP API
==========================================

# Start the server
npm start

# In another terminal, crawl a website:
curl -X POST http://localhost:3000/api/crawl \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com",
    "depth": 1
  }'

# Get site data by ID:
curl http://localhost:3000/api/sites/{site-id}

# Download brand profile PDF:
curl http://localhost:3000/api/sites/{site-id}/brand-profile -o brand-profile.pdf
`);

// Example 2: Using the crawler module directly
console.log(`
Example 2: Use crawler module programmatically
==============================================
`);

async function exampleDirectUsage() {
  const crawler = require('./crawler');
  const llm = require('./llm');
  const store = require('./store');

  try {
    // Initialize crawler
    await crawler.init();

    // Crawl a website
    const url = 'https://example.com';
    console.log('Crawling:', url);
    
    const crawlData = await crawler.crawl(url, { depth: 1 });
    
    console.log('Crawled successfully!');
    console.log('- Title:', crawlData.meta.title);
    console.log('- Domain:', crawlData.domain);
    console.log('- CSS Variables found:', Object.keys(crawlData.cssVariables).length);
    console.log('- Colors found:', crawlData.computedStyles.colors.length);
    console.log('- Fonts found:', crawlData.computedStyles.fonts.length);

    // Extract design tokens
    const majorColors = crawler.extractMajorColors(crawlData.computedStyles);
    console.log('\\nTop colors:', majorColors.slice(0, 5));

    const majorFonts = crawler.extractMajorFonts(crawlData.computedStyles);
    console.log('Top fonts:', majorFonts);

    // Analyze with OpenAI (requires API key)
    // const brandVoice = await llm.summarizeBrandVoice(crawlData.textContent);
    // console.log('\\nBrand Voice:', brandVoice);

    // Store in database (requires PostgreSQL)
    // const site = await store.createSite({
    //   url: crawlData.url,
    //   domain: crawlData.domain,
    //   title: crawlData.meta.title,
    //   description: crawlData.meta.description,
    //   rawHtml: crawlData.html,
    //   screenshot: crawlData.screenshot
    // });
    // console.log('\\nStored site with ID:', site.id);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await crawler.close();
  }
}

// Uncomment to run the example:
// exampleDirectUsage();

// Example 3: Testing specific features
console.log(`
Example 3: Test individual features
====================================
`);

async function testFeatures() {
  const crawler = require('./crawler');

  // Test structured data extraction
  const html = \`
    <html>
      <head>
        <title>Test Company</title>
        <meta name="description" content="We build amazing products">
      </head>
      <body>
        <h1>Welcome to Test Company</h1>
        <p>Contact us at info@test.com or call 555-1234</p>
        <a href="https://twitter.com/testcompany">Twitter</a>
        <a href="https://facebook.com/testcompany">Facebook</a>
      </body>
    </html>
  \`;

  const data = crawler.extractStructuredData(html);
  
  console.log('Structured Data Extraction:');
  console.log('- Title:', data.meta.title);
  console.log('- Description:', data.meta.description);
  console.log('- Emails:', data.emails);
  console.log('- Phones:', data.phones);
  console.log('- Social Links:', data.socialLinks);
}

// Uncomment to run:
// testFeatures();

// Example 4: Database setup
console.log(`
Example 4: Initialize the database
===================================

# Make sure PostgreSQL is running, then:
npm run init-db

# Or manually:
psql -d designtokens -f schema.sql
`);

// Example 5: Environment configuration
console.log(`
Example 5: Configure environment
=================================

# Copy the example env file:
cp .env.example .env

# Edit .env and set:
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/designtokens
OPENAI_API_KEY=sk-...

# Then start the server:
npm start
`);

module.exports = {
  exampleDirectUsage,
  testFeatures
};
