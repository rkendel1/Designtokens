# Crawler Enhancements Documentation

## Overview

The Design Tokens Crawler has been enhanced with advanced features for improved flexibility, robustness, and comprehensive web crawling capabilities.

## New Features

### 1. LLM Provider Selection

The crawler now supports multiple LLM providers, allowing you to switch between OpenAI and locally hosted LLMs like Ollama.

#### Configuration

```bash
# In .env file
LLM_PROVIDER=openai  # or 'ollama'
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

#### Supported Providers

- **OpenAI** (default): Uses OpenAI's GPT-4 and embedding models
- **Ollama**: Uses locally running Ollama instance for privacy and cost savings

#### Usage Example

```javascript
const llm = require('./llm');
const config = require('./config');

// Set provider dynamically
config.llm.provider = 'ollama';

// All LLM methods now use the configured provider
const summary = await llm.generateBrandSummary(siteData);
const voice = await llm.summarizeBrandVoice(content);
```

### 2. Dynamic User Agent Rotation

Prevent bot detection by rotating through multiple realistic user agents representing different browsers and devices.

#### Configuration

```bash
# Enable user agent rotation
ROTATE_USER_AGENTS=true
```

#### User Agent Pool

The crawler includes 8 diverse user agents:
- Chrome on Windows and macOS
- Firefox on Windows and macOS
- Safari on macOS and iOS
- Edge on Windows
- Chrome on Android

#### How It Works

When enabled, the crawler automatically cycles through user agents with each request, making traffic appear more natural and reducing the likelihood of being blocked.

### 3. Multi-Browser Support

The crawler now supports multiple browser engines for broader compatibility and improved stealth.

#### Supported Browsers

- **Chromium** (default)
- **Firefox**
- **WebKit** (Safari engine)

#### Configuration

```bash
# Set specific browser
BROWSER_TYPE=firefox

# Or enable browser rotation
BROWSER_TYPE=random
ROTATE_BROWSERS=true
```

#### Features

- **Static Browser**: Use a specific browser for all requests
- **Random Browser**: Randomly select a browser for each crawl session
- **Browser Rotation**: Automatically rotate between browsers

### 4. Retry Logic with Exponential Backoff

Automatically retry failed requests with intelligent backoff to handle temporary network issues.

#### Configuration

```bash
RETRY_ATTEMPTS=3
RETRY_DELAY_MS=1000
```

#### How It Works

- First attempt: Immediate
- Second attempt: Wait 1000ms
- Third attempt: Wait 2000ms
- And so on with exponential backoff

#### Usage

```javascript
// Retry logic is automatically applied to all crawl operations
const result = await crawler.crawl(url);
```

### 5. Lazy-Loaded Content Handling

Capture content that loads dynamically as users scroll down the page.

#### Configuration

```bash
HANDLE_LAZY_LOAD=true
SCROLL_STEPS=3
SCROLL_DELAY_MS=500
```

#### How It Works

1. The crawler scrolls the page in steps (default: 3)
2. Waits between scrolls for content to load
3. Scrolls back to top before capturing final state
4. Ensures all dynamically loaded content is included

### 6. CAPTCHA Detection

Automatically detect when a page contains CAPTCHA challenges.

#### Detection Methods

The crawler checks for:
- reCAPTCHA iframes and elements
- hCAPTCHA elements
- Cloudflare challenges
- Generic CAPTCHA indicators

#### Response

When a CAPTCHA is detected:
- A warning is logged
- The `captchaDetected` field in the response is set to `true`
- You can implement custom handling based on this flag

#### Example Response

```javascript
{
  url: 'https://example.com',
  domain: 'example.com',
  captchaDetected: true,
  browserUsed: 'firefox',
  // ... other data
}
```

## Complete Configuration Reference

### Environment Variables

```bash
# LLM Configuration
LLM_PROVIDER=openai              # 'openai' or 'ollama'
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Browser Configuration
BROWSER_TYPE=chromium            # 'chromium', 'firefox', 'webkit', or 'random'
ROTATE_BROWSERS=false            # Enable browser rotation
ROTATE_USER_AGENTS=true          # Enable user agent rotation

# Retry Configuration
RETRY_ATTEMPTS=3                 # Number of retry attempts
RETRY_DELAY_MS=1000              # Initial delay between retries (ms)

# Lazy Load Configuration
HANDLE_LAZY_LOAD=true            # Enable lazy load handling
SCROLL_STEPS=3                   # Number of scroll steps
SCROLL_DELAY_MS=500              # Delay between scrolls (ms)

# Existing Configurations
MAX_CRAWL_DEPTH=3
REQUEST_TIMEOUT_MS=30000
MAX_CONCURRENT_REQUESTS=5
```

## Usage Examples

### Example 1: Using Ollama Locally

```javascript
// In your .env file
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

// Then use normally
const crawler = require('./crawler');
const llm = require('./llm');

const data = await crawler.crawl('https://example.com');
const summary = await llm.generateBrandSummary({
  title: data.meta.title,
  description: data.meta.description,
  content: data.textContent
});
```

### Example 2: Stealth Crawling

```javascript
// In your .env file
ROTATE_USER_AGENTS=true
ROTATE_BROWSERS=true
BROWSER_TYPE=random
HANDLE_LAZY_LOAD=true

// The crawler will:
// - Use different browsers
// - Rotate user agents
// - Handle lazy-loaded content
// - Look more like a real user
const data = await crawler.crawl('https://protected-site.com');
```

### Example 3: Robust Crawling with Retries

```javascript
// In your .env file
RETRY_ATTEMPTS=5
RETRY_DELAY_MS=2000

// The crawler will retry up to 5 times with exponential backoff
try {
  const data = await crawler.crawl('https://unreliable-site.com');
  console.log('Success after retries:', data);
} catch (error) {
  console.error('Failed after all retries:', error);
}
```

### Example 4: CAPTCHA-Aware Crawling

```javascript
const data = await crawler.crawl('https://example.com');

if (data.captchaDetected) {
  console.warn('CAPTCHA detected - manual intervention may be needed');
  // Implement custom logic here
  // - Notify admin
  // - Try alternative approach
  // - Queue for manual processing
} else {
  // Process data normally
  processData(data);
}
```

## Testing

### Run Enhanced Feature Tests

```bash
# Test crawler enhancements
npm test -- __tests__/crawler.enhanced.test.js

# Test LLM provider switching
npm test -- __tests__/llm.enhanced.test.js

# Run all tests
npm test
```

### Test Scenarios Covered

1. ✅ User agent rotation functionality
2. ✅ Browser type selection and rotation
3. ✅ Retry logic with exponential backoff
4. ✅ Sleep utility accuracy
5. ✅ CAPTCHA detection interface
6. ✅ Lazy load handling
7. ✅ LLM provider switching
8. ✅ Ollama integration
9. ✅ All existing functionality maintained

## Best Practices

### 1. Respect robots.txt

The crawler automatically checks robots.txt. Don't disable this check.

### 2. Use Appropriate Delays

```bash
# For gentle crawling
SCROLL_DELAY_MS=1000
RETRY_DELAY_MS=2000

# For faster crawling (if allowed)
SCROLL_DELAY_MS=300
RETRY_DELAY_MS=500
```

### 3. Choose the Right Browser

- **Chromium**: Best compatibility, most features
- **Firefox**: Good for diversity, strong privacy features
- **WebKit**: Best for iOS/Safari-specific testing

### 4. LLM Provider Selection

- **OpenAI**: Best quality results, requires API key, costs money
- **Ollama**: Privacy-friendly, free, runs locally, may need more powerful hardware

### 5. Handle CAPTCHA Gracefully

```javascript
const crawlWithCaptchaHandling = async (url) => {
  const data = await crawler.crawl(url);
  
  if (data.captchaDetected) {
    // Log for review
    console.warn(`CAPTCHA on ${url}`);
    
    // Maybe try different approach
    config.crawler.rotateUserAgents = true;
    config.crawler.rotateBrowsers = true;
    
    // Retry with different fingerprint
    return await crawler.crawl(url);
  }
  
  return data;
};
```

## Troubleshooting

### Ollama Connection Issues

```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# Start Ollama if not running
ollama serve

# Pull required model
ollama pull llama2
```

### Browser Launch Failures

```bash
# Install browser binaries
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

### High Memory Usage

```bash
# Reduce concurrent requests
MAX_CONCURRENT_REQUESTS=2

# Disable screenshot for large crawls
# In code:
const data = await crawler.crawl(url, { takeScreenshot: false });
```

## Performance Considerations

### Browser Performance

- Chromium: ~200MB RAM per instance
- Firefox: ~180MB RAM per instance
- WebKit: ~150MB RAM per instance

### LLM Performance

- OpenAI: API latency ~1-3 seconds
- Ollama (local): Depends on hardware, typically 2-10 seconds

### Recommended Settings for Scale

```bash
# For high-volume crawling
MAX_CONCURRENT_REQUESTS=3
BROWSER_TYPE=webkit  # Lowest memory
RETRY_ATTEMPTS=2
HANDLE_LAZY_LOAD=false  # Disable for speed
```

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **Rate Limiting**: Respect site rate limits to avoid blocking
3. **User Agents**: Use realistic user agents, don't impersonate
4. **Data Storage**: Encrypt sensitive extracted data
5. **Local LLM**: Use Ollama for sensitive data that shouldn't leave your network

## Future Enhancements

Potential future additions:

- Proxy rotation support
- Cookie handling improvements
- Session persistence
- Advanced CAPTCHA solving
- Headful mode for debugging
- Video/audio content extraction
- Real-time streaming crawl results
