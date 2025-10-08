# Quick Start: Enhanced Crawler Features

This guide will help you quickly get started with the new enhanced crawler features.

## 1. Using Local LLM (Ollama) Instead of OpenAI

### Setup

```bash
# Install Ollama (macOS)
brew install ollama

# Or download from https://ollama.ai

# Start Ollama server
ollama serve

# Pull a model (in another terminal)
ollama pull llama2
```

### Configure

Edit your `.env` file:

```bash
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

### Benefits

- ✅ **Privacy**: Data stays on your machine
- ✅ **Cost**: No API fees
- ✅ **Speed**: No network latency (once loaded)
- ❌ **Quality**: May be lower than GPT-4
- ❌ **Resources**: Requires more RAM/CPU

## 2. Multi-Browser Crawling

### Quick Setup

```bash
# Install all browser engines
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

### Configuration Options

```bash
# Use specific browser
BROWSER_TYPE=firefox

# Random browser per crawl
BROWSER_TYPE=random

# Rotate browsers automatically
ROTATE_BROWSERS=true
```

### Use Cases

- **Chromium**: Best overall compatibility
- **Firefox**: Good for privacy-focused sites
- **WebKit**: Testing Safari-specific rendering

## 3. User Agent Rotation

### Enable

```bash
ROTATE_USER_AGENTS=true
```

### What It Does

- Cycles through 8 realistic user agents
- Appears as different browsers/devices
- Reduces bot detection
- Includes desktop and mobile agents

## 4. Handling Lazy-Loaded Content

### Configuration

```bash
HANDLE_LAZY_LOAD=true
SCROLL_STEPS=3
SCROLL_DELAY_MS=500
```

### How It Works

1. Scrolls page in steps (default: 3)
2. Waits between scrolls for content to load
3. Captures all dynamically loaded elements
4. Scrolls back to top before final capture

### When to Use

- Infinite scroll pages
- Image galleries
- Social media feeds
- Dynamic product listings

## 5. Retry Logic

### Configuration

```bash
RETRY_ATTEMPTS=3
RETRY_DELAY_MS=1000
```

### Behavior

- Automatically retries failed requests
- Uses exponential backoff
- Handles temporary network issues
- Logs each attempt

### Example Retry Pattern

```
Attempt 1: Immediate (fails)
Attempt 2: Wait 1000ms (fails)
Attempt 3: Wait 2000ms (succeeds)
```

## 6. CAPTCHA Detection

### No Configuration Needed

CAPTCHA detection is automatic. The response includes:

```json
{
  "captchaDetected": true,
  "browserUsed": "chromium",
  ...
}
```

### Handle in Code

```javascript
const response = await fetch('http://localhost:3000/api/crawl', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com' })
});

const data = await response.json();

if (data.site.captchaDetected) {
  console.warn('CAPTCHA detected - manual intervention needed');
  // Handle accordingly
}
```

## Complete Example: Maximum Stealth

For the most undetectable crawling:

### .env Configuration

```bash
# LLM (optional, for privacy)
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Browser Settings
BROWSER_TYPE=random
ROTATE_BROWSERS=true
ROTATE_USER_AGENTS=true

# Resilience
RETRY_ATTEMPTS=5
RETRY_DELAY_MS=2000

# Content Capture
HANDLE_LAZY_LOAD=true
SCROLL_STEPS=4
SCROLL_DELAY_MS=1000
```

### Run

```bash
npm start
```

### Test

```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://difficult-site.com"}'
```

## Testing Your Configuration

### 1. Test Browser Installation

```bash
# Test each browser
BROWSER_TYPE=chromium npm start
BROWSER_TYPE=firefox npm start
BROWSER_TYPE=webkit npm start
```

### 2. Test Ollama

```bash
# Check Ollama is running
curl http://localhost:11434/api/version

# Test generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama2",
  "prompt": "Hello, world!"
}'
```

### 3. Run Enhanced Tests

```bash
# Test all enhanced features
npm test -- __tests__/crawler.enhanced.test.js
npm test -- __tests__/llm.enhanced.test.js
```

## Troubleshooting

### Ollama Not Connecting

```bash
# Check if running
ps aux | grep ollama

# Restart
ollama serve

# Check port
lsof -i :11434
```

### Browser Launch Fails

```bash
# Reinstall browsers
npx playwright install --force

# Check Playwright version
npm list playwright
```

### High Memory Usage

```bash
# Reduce concurrent requests
MAX_CONCURRENT_REQUESTS=2

# Disable screenshots for large crawls
# (programmatically):
crawler.crawl(url, { takeScreenshot: false })
```

### CAPTCHA Always Detected

```bash
# Try different strategies
ROTATE_USER_AGENTS=true
ROTATE_BROWSERS=true
BROWSER_TYPE=random
RETRY_DELAY_MS=3000

# Add delays between requests
# Respect the site's rate limits
```

## Performance Tips

### For Speed

```bash
BROWSER_TYPE=webkit          # Fastest browser
HANDLE_LAZY_LOAD=false       # Skip scrolling
RETRY_ATTEMPTS=2             # Fewer retries
```

### For Completeness

```bash
BROWSER_TYPE=chromium        # Best compatibility
HANDLE_LAZY_LOAD=true
SCROLL_STEPS=5               # More thorough
SCROLL_DELAY_MS=1000         # Wait for content
RETRY_ATTEMPTS=5             # Maximum retries
```

### For Privacy

```bash
LLM_PROVIDER=ollama          # Local LLM
OLLAMA_MODEL=llama2          # Open source model
# All data stays local
```

## Next Steps

1. Read [ENHANCEMENTS.md](ENHANCEMENTS.md) for detailed documentation
2. Check [examples-enhanced.js](examples-enhanced.js) for code examples
3. Review [API.md](API.md) for API changes
4. See [README.md](README.md) for general setup

## Common Configurations

### Development (Fast)

```bash
LLM_PROVIDER=openai
BROWSER_TYPE=chromium
ROTATE_USER_AGENTS=false
RETRY_ATTEMPTS=2
HANDLE_LAZY_LOAD=false
```

### Production (Robust)

```bash
LLM_PROVIDER=openai
BROWSER_TYPE=random
ROTATE_BROWSERS=true
ROTATE_USER_AGENTS=true
RETRY_ATTEMPTS=5
HANDLE_LAZY_LOAD=true
SCROLL_STEPS=3
```

### Privacy-Focused

```bash
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
BROWSER_TYPE=firefox
ROTATE_USER_AGENTS=true
```

### Maximum Stealth

```bash
LLM_PROVIDER=ollama
BROWSER_TYPE=random
ROTATE_BROWSERS=true
ROTATE_USER_AGENTS=true
RETRY_ATTEMPTS=5
RETRY_DELAY_MS=3000
HANDLE_LAZY_LOAD=true
SCROLL_STEPS=5
SCROLL_DELAY_MS=1500
```
