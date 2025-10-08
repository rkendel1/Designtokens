# Design Tokens Crawler - Architecture Documentation

## Overview

The Design Tokens Crawler is an intelligent web crawling system that extracts design tokens, brand voice, and metadata from websites using AI-powered analysis. The system combines web scraping, browser automation, NLP, and vector embeddings to create a comprehensive brand analysis platform.

## System Architecture

```
┌─────────────┐
│   Client    │
└─────┬───────┘
      │ HTTP
      ▼
┌─────────────────────────────────────┐
│         Express.js API Server        │
│  - Rate Limiting                     │
│  - Caching                           │
│  - CORS & Security Headers           │
└─────┬───────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│          Crawler Module              │
│  - Playwright (Browser Automation)   │
│  - Cheerio (HTML Parsing)            │
│  - robots.txt Compliance             │
└─────┬───────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│         AI/LLM Module                │
│  - OpenAI GPT-4 (Analysis)           │
│  - text-embedding-ada-002            │
│  - Token Normalization               │
│  - Brand Voice Analysis              │
└─────┬───────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│      PostgreSQL Database             │
│  - pgvector Extension                │
│  - Sites, Tokens, Brand Voice        │
│  - Company Info, Products            │
└─────────────────────────────────────┘
```

## Core Modules

### 1. Server (server.js)
**Purpose**: HTTP API server and request handling

**Key Features**:
- Express.js framework
- RESTful API endpoints
- Rate limiting (100 req/15min)
- In-memory caching (1-hour TTL)
- Security headers (Helmet.js)
- CORS support
- Graceful shutdown

**Endpoints**:
- `POST /api/crawl` - Crawl and analyze a website
- `GET /api/sites/:id` - Get complete site data
- `GET /api/sites/:id/tokens` - Get design tokens
- `GET /api/sites/:id/brand-profile` - Download PDF report
- `GET /health` - Health check

### 2. Crawler (crawler.js)
**Purpose**: Web scraping and data extraction

**Key Features**:
- Headless browser automation with Playwright
- CSS variable extraction
- Computed styles analysis
- HTML parsing with Cheerio
- robots.txt compliance checking
- Screenshot capture
- Structured data extraction (emails, phones, social links, products)

**Extraction Capabilities**:
- CSS custom properties (--variables)
- Computed colors, fonts, spacing
- Border radius, shadows
- Meta tags and OpenGraph data
- Contact information
- Product listings
- Social media links

### 3. LLM Service (llm.js)
**Purpose**: AI-powered analysis and normalization

**Key Features**:
- OpenAI GPT-4 integration
- Vector embeddings generation
- Design token normalization
- Brand voice analysis
- Company metadata extraction
- Color categorization

**AI Tasks**:
1. **Brand Voice Analysis**: Extracts tone, personality, themes
2. **Token Normalization**: Standardizes design token naming
3. **Color Categorization**: Primary, secondary, accent, semantic
4. **Metadata Extraction**: Company name, industry, description
5. **Embeddings**: 1536-dimensional vectors for similarity search

### 4. Store (store.js)
**Purpose**: Database operations and persistence

**Key Features**:
- PostgreSQL connection pooling
- CRUD operations for all entities
- Bulk insert operations
- Vector storage (pgvector)
- Cascading deletes
- Transaction support

**Data Models**:
- Sites: URL, HTML, screenshots
- Company Info: Contact details, structured data
- Design Tokens: Normalized tokens with metadata
- Products: Extracted product information
- Brand Voice: Analysis with embeddings

### 5. PDF Generator (pdf-generator.js)
**Purpose**: Brand profile report generation

**Key Features**:
- PDFKit-based document generation
- Color swatches
- Typography samples
- Design token visualization
- Brand voice summary
- Product listings

### 6. Configuration (config.js)
**Purpose**: Centralized configuration management

**Settings**:
- Server port
- Database connection
- OpenAI API key
- Crawler parameters (depth, timeout, concurrency)
- Rate limiting
- Cache TTL

## Data Flow

### Crawl Request Flow

1. **Request Validation**
   - URL format validation
   - Cache check
   - Database lookup

2. **Web Crawling**
   - robots.txt check
   - Browser navigation with Playwright
   - Page rendering wait
   - HTML capture
   - Screenshot generation

3. **Data Extraction**
   - CSS variables extraction
   - Computed styles sampling
   - Structured data parsing (Cheerio)
   - Text content extraction

4. **AI Analysis**
   - Design token normalization
   - Brand voice analysis
   - Company metadata extraction
   - Embedding generation

5. **Storage**
   - Site record creation/update
   - Company info storage
   - Design tokens bulk insert
   - Products storage
   - Brand voice with embeddings

6. **Response**
   - Aggregate response preparation
   - Cache storage
   - JSON response to client

## Database Schema

### Sites Table
```sql
- id (UUID, PK)
- url (TEXT, UNIQUE)
- domain (TEXT)
- title (TEXT)
- description (TEXT)
- crawled_at (TIMESTAMPTZ)
- raw_html (TEXT)
- screenshot (BYTEA)
```

### Company Info Table
```sql
- id (UUID, PK)
- site_id (UUID, FK -> sites)
- company_name (TEXT)
- legal_name (TEXT)
- contact_emails (TEXT[])
- contact_phones (TEXT[])
- addresses (TEXT[])
- structured_json (JSONB)
```

### Design Tokens Table
```sql
- id (UUID, PK)
- site_id (UUID, FK -> sites)
- token_key (TEXT)
- token_type (TEXT)
- token_value (TEXT)
- source (TEXT)
- meta (JSONB)
```

### Products Table
```sql
- id (UUID, PK)
- site_id (UUID, FK -> sites)
- name (TEXT)
- slug (TEXT)
- price (TEXT)
- description (TEXT)
- product_url (TEXT)
- metadata (JSONB)
```

### Brand Voice Table
```sql
- id (UUID, PK)
- site_id (UUID, FK -> sites)
- summary (TEXT)
- guidelines (JSONB)
- embedding (vector(1536))
```

## Security Considerations

1. **API Security**
   - Rate limiting per IP
   - Input validation
   - CORS configuration
   - Helmet.js security headers

2. **Data Security**
   - Environment variable for secrets
   - No hardcoded credentials
   - Optional encryption at rest for sensitive data

3. **Web Scraping Ethics**
   - robots.txt compliance
   - Configurable user agent
   - Rate limiting to avoid overwhelming servers
   - Respect for site terms of service

4. **Database Security**
   - Connection string in env vars
   - Prepared statements (SQL injection prevention)
   - Cascade deletes for data integrity

## Performance Optimizations

1. **Caching**
   - In-memory cache (NodeCache)
   - Configurable TTL
   - Cache invalidation support

2. **Database**
   - Connection pooling
   - Bulk insert operations
   - Indexed columns (url, domain, site_id, token_type)

3. **Crawler**
   - Headless browser mode
   - Sample-based style extraction
   - Concurrent request limits
   - Configurable timeouts

4. **API**
   - Response compression (implied)
   - Efficient JSON serialization
   - Streaming for large responses

## Testing Strategy

### Unit Tests
- Crawler extraction functions
- LLM service (with mocking)
- API endpoints
- Structured data parsing

### Test Coverage
- Crawler: 40% (core extraction logic)
- Config: 100%
- Server: API endpoint validation
- LLM: Error handling and structure validation

### Test Environment
- Jest test framework
- Supertest for API testing
- Mock OpenAI responses
- Test database isolation

## Deployment Considerations

### Prerequisites
- Node.js 16+
- PostgreSQL 12+ with pgvector
- OpenAI API key

### Environment Variables
- PORT
- DATABASE_URL
- OPENAI_API_KEY
- Crawler configuration
- Rate limit settings
- Cache TTL

### Scaling Strategies
1. **Horizontal Scaling**: Multiple API instances behind load balancer
2. **Database**: Read replicas for queries
3. **Caching**: Redis for distributed cache
4. **Queue**: Background job processing for long crawls
5. **CDN**: Static PDF storage

### Monitoring
- Health check endpoint
- Error logging
- Performance metrics
- Database query monitoring
- API rate limit tracking

## Future Enhancements

1. **Crawling**
   - Multi-page crawling with depth control
   - JavaScript-heavy site support
   - Mobile viewport crawling
   - Accessibility metrics extraction

2. **AI Analysis**
   - Fine-tuned models for design tokens
   - Multi-language support
   - Image analysis for logos/icons
   - Competitive analysis

3. **Storage**
   - Time-series token tracking
   - Version history
   - Change detection
   - Retention policies

4. **API**
   - Webhooks for crawl completion
   - Batch crawling endpoints
   - GraphQL support
   - Real-time updates via WebSocket

5. **Reporting**
   - Interactive web dashboard
   - Comparison reports
   - Export to Figma/Sketch
   - Design system documentation

## Dependencies

### Production
- express: Web framework
- playwright: Browser automation
- cheerio: HTML parsing
- openai: AI integration
- pg/pgvector: Database
- pdfkit: PDF generation
- Supporting libraries (cors, helmet, rate-limit, etc.)

### Development
- jest: Testing framework
- supertest: HTTP testing
- nodemon: Development server

## License
MIT
