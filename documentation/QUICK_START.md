# Quick Start Guide

Get up and running with the Design Tokens Crawler in 5 minutes!

## Prerequisites Check

```bash
# Check Node.js (need 16+)
node --version

# Check PostgreSQL (need 12+)
psql --version

# Check npm
npm --version
```

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/rkendel1/Designtokens.git
cd Designtokens

# Install dependencies
npm install
```

## Step 2: Database Setup

```bash
# Create PostgreSQL database
createdb designtokens

# Initialize schema
npm run init-db
```

## Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set:
# - DATABASE_URL=postgresql://user:password@localhost:5432/designtokens
# - OPENAI_API_KEY=sk-your-key-here
# - PORT=3000 (optional)
```

**Minimal .env for testing (without OpenAI):**
```env
PORT=3000
DATABASE_URL=postgresql://localhost:5432/designtokens
```

## Step 4: Run Tests (Optional)

```bash
npm test
```

You should see:
```
Test Suites: 3 passed, 3 total
Tests:       1 skipped, 22 passed, 23 total
```

## Step 5: Start the Server

```bash
npm start
```

You should see:
```
Design Tokens API server running on port 3000
```

## Step 6: Test the API

### Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Crawl a Website

```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "depth": 1
  }'
```

This will:
1. ✅ Crawl the website
2. ✅ Extract design tokens
3. ✅ Analyze brand voice (if OpenAI key is set)
4. ✅ Store in database
5. ✅ Return results

## Common Issues

### Issue: Database connection error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Make sure PostgreSQL is running
```bash
# On macOS
brew services start postgresql

# On Ubuntu
sudo service postgresql start

# Check status
pg_isready
```

### Issue: OpenAI API errors
```
Error: The OPENAI_API_KEY environment variable is missing
```
**Solution**: Either:
1. Add valid OpenAI API key to `.env`
2. Or use the system without AI features (it will still extract tokens)

### Issue: Port already in use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change PORT in `.env` to another value (e.g., 3001)

### Issue: pgvector extension error
```
Error: extension "vector" does not exist
```
**Solution**: Install pgvector extension
```bash
# On Ubuntu/Debian
sudo apt-get install postgresql-14-pgvector

# On macOS
brew install pgvector

# Then in psql:
CREATE EXTENSION vector;
```

## What's Next?

### Explore the API
- Read [API.md](API.md) for complete API documentation
- Try different endpoints
- Generate PDF reports

### Understand the System
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Check [examples.js](examples.js) for usage examples
- Review test files in `__tests__/`

### Contribute
- Read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
- Check open issues
- Submit pull requests

## Example Workflows

### 1. Crawl and Export Tokens
```bash
# Crawl site
SITE_ID=$(curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' \
  | jq -r '.site.id')

# Get tokens
curl http://localhost:3000/api/sites/$SITE_ID/tokens \
  | jq '.tokens[] | {key: .token_key, type: .token_type, value: .token_value}'
```

### 2. Generate Brand Profile
```bash
# Download PDF
curl http://localhost:3000/api/sites/$SITE_ID/brand-profile \
  -o brand-profile.pdf

# Open PDF
open brand-profile.pdf  # macOS
xdg-open brand-profile.pdf  # Linux
```

### 3. Programmatic Usage
```javascript
const crawler = require('./crawler');

async function main() {
  await crawler.init();
  const data = await crawler.crawl('https://example.com');
  console.log('Colors:', crawler.extractMajorColors(data.computedStyles));
  await crawler.close();
}

main();
```

## Development Mode

```bash
# Auto-reload on changes
npm run dev

# Run specific tests
npm test -- __tests__/crawler.test.js

# Watch mode for tests
npm run test:watch
```

## Production Deployment

1. Set production environment variables
2. Use a process manager (PM2, systemd)
3. Set up PostgreSQL with proper authentication
4. Configure reverse proxy (nginx)
5. Enable SSL/TLS
6. Set up monitoring and logging

Example with PM2:
```bash
npm install -g pm2
pm2 start server.js --name designtokens
pm2 save
pm2 startup
```

## Support

- 📖 Documentation: See README.md, API.md, ARCHITECTURE.md
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions
- 📧 Email: [your-email]

## Success Checklist

- [ ] Dependencies installed
- [ ] Database created and initialized
- [ ] Environment configured
- [ ] Tests passing
- [ ] Server running
- [ ] Health check responds
- [ ] Can crawl a website
- [ ] Can retrieve tokens
- [ ] Can generate PDF (optional)

Congratulations! You're ready to extract design tokens! 🎉
