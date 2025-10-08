# Design Tokens - OpenAI-Powered Site Crawler

An intelligent web crawler that extracts design tokens, brand voice, and metadata from websites using AI (OpenAI or local LLMs) and Playwright.

## Features

### Core Features
- 🎨 **Design Token Extraction**: Automatically extracts colors, typography, spacing, and other design tokens from websites
- 🤖 **AI-Powered Analysis**: Uses OpenAI GPT-4 or local LLMs (Ollama) to normalize design tokens and analyze brand voice
- 🗄️ **PostgreSQL Storage**: Stores all data in PostgreSQL with pgvector extension for embeddings
- 📊 **Brand Profile Generator**: Creates PDF reports with brand colors, fonts, and voice guidelines
- 🔍 **Structured Data Extraction**: Extracts company info, products, contact details, and social links
- 🛡️ **Robots.txt Compliance**: Respects robots.txt protocol
- ⚡ **Rate Limiting & Caching**: Built-in protection and performance optimization

### Enhanced Features ✨
- 🔄 **LLM Provider Flexibility**: Switch between OpenAI and local LLMs (Ollama) for privacy and cost control
- 🎭 **User Agent Rotation**: Dynamic user agent rotation to appear as different browsers and devices
- 🌐 **Multi-Browser Support**: Chromium, Firefox, and WebKit support for comprehensive crawling
- 🔁 **Intelligent Retry Logic**: Automatic retry with exponential backoff for failed requests
- 📜 **Lazy Load Handling**: Captures dynamically loaded content by simulating scroll behavior
- 🔐 **CAPTCHA Detection**: Automatic detection of CAPTCHA challenges

See [ENHANCEMENTS.md](ENHANCEMENTS.md) for detailed documentation on new features.

## Prerequisites

- Node.js 16+ 
- PostgreSQL 12+ with pgvector extension
- OpenAI API key (optional - can use local LLM)
- Ollama (optional - for local LLM)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/rkendel1/Designtokens.git
cd Designtokens
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize the database:
```bash
# First, create a PostgreSQL database named 'designtokens'
createdb designtokens

# Then run the initialization script
npm run init-db
```

## Configuration

Edit `.env` file with your settings:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/designtokens
OPENAI_API_KEY=your_openai_api_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Crawler Settings
MAX_CRAWL_DEPTH=3
REQUEST_TIMEOUT_MS=30000
MAX_CONCURRENT_REQUESTS=5

# Cache Settings
CACHE_TTL_SECONDS=3600
```

## Usage

### Start the Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### API Endpoints

#### POST /api/crawl
Crawl a website and extract design tokens and metadata.

**Request:**
```json
{
  "url": "https://example.com",
  "depth": 1,
  "skipCache": false
}
```

**Response:**
```json
{
  "site": {
    "id": "uuid",
    "url": "https://example.com",
    "domain": "example.com",
    "title": "Example Site",
    "description": "Site description"
  },
  "companyInfo": {
    "name": "Example Corp",
    "emails": ["info@example.com"],
    "phones": ["+1-555-0100"],
    "socialLinks": [...]
  },
  "designTokens": [...],
  "brandVoice": {
    "tone": "professional",
    "personality": "friendly, authoritative",
    "themes": [...]
  },
  "stats": {
    "totalTokens": 45,
    "totalProducts": 12,
    "crawledAt": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /api/sites/:id
Get complete data for a crawled site.

#### GET /api/sites/:id/tokens
Get all design tokens for a site.

#### GET /api/sites/:id/brand-profile
Download a PDF brand profile report.

### Example Usage with cURL

```bash
# Crawl a website
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "depth": 1}'

# Get site data
curl http://localhost:3000/api/sites/{site-id}

# Download brand profile PDF
curl http://localhost:3000/api/sites/{site-id}/brand-profile -o brand-profile.pdf
```

## Database Schema

The system uses the following PostgreSQL tables:

- **sites**: Main site information and raw HTML
- **company_info**: Extracted company metadata
- **design_tokens**: Normalized design tokens (colors, fonts, spacing, etc.)
- **products**: Extracted product information
- **brand_voice**: AI-analyzed brand voice with embeddings

See `schema.sql` for the complete schema.

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Architecture

### Core Modules

- **server.js**: Express.js API server with endpoints
- **crawler.js**: Playwright-based web crawler with Cheerio for parsing
- **llm.js**: OpenAI integration for NLP tasks
- **store.js**: PostgreSQL database operations
- **pdf-generator.js**: Brand profile PDF generation
- **config.js**: Configuration management

### Data Flow

1. Client sends POST request to `/api/crawl` with URL
2. Crawler checks robots.txt and crawls the site using Playwright
3. Extracts CSS variables, computed styles, and structured data
4. OpenAI normalizes design tokens and analyzes brand voice
5. All data is stored in PostgreSQL with vector embeddings
6. Response is cached and returned to client

## Features in Detail

### Design Token Extraction

The crawler extracts:
- CSS custom properties (variables)
- Computed colors from elements
- Font families and sizes
- Spacing values (margin, padding)
- Border radius and shadows

### AI Analysis

OpenAI is used for:
- Normalizing and categorizing design tokens
- Brand voice analysis (tone, personality, themes)
- Company metadata extraction and normalization
- Color categorization (primary, secondary, accent, semantic)

### Rate Limiting

Built-in rate limiting protects the API:
- 100 requests per 15 minutes per IP (configurable)
- Cached responses reduce load

### Caching

Results are cached in memory:
- 1-hour TTL (configurable)
- Can be bypassed with `skipCache: true`

## Security Considerations

- Sensitive data (screenshots, HTML) can be encrypted at rest
- API keys stored in environment variables
- CORS and Helmet.js security headers enabled
- Rate limiting prevents abuse
- Input validation on all endpoints

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.