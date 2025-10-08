# API Documentation

## Base URL

```
http://localhost:3000
```

## Authentication

Currently, the API does not require authentication. Rate limiting is applied per IP address.

## Rate Limits

- 100 requests per 15 minutes per IP address
- Cached responses don't count towards rate limit

## Endpoints

### Health Check

Check if the API is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### Crawl Website

Crawl a website and extract design tokens, brand voice, and metadata.

**Endpoint:** `POST /api/crawl`

**Request Body:**
```json
{
  "url": "https://example.com",
  "depth": 1,
  "skipCache": false
}
```

**Parameters:**
- `url` (required): The URL to crawl
- `depth` (optional): Crawl depth, default 1
- `skipCache` (optional): Skip cache and force fresh crawl, default false

**Response:**
```json
{
  "site": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://example.com",
    "domain": "example.com",
    "title": "Example Site",
    "description": "An example website"
  },
  "companyInfo": {
    "name": "Example Corp",
    "emails": ["info@example.com", "support@example.com"],
    "phones": ["+1-555-0100"],
    "socialLinks": [
      {
        "platform": "twitter",
        "url": "https://twitter.com/example"
      }
    ]
  },
  "designTokens": [
    {
      "id": "...",
      "token_key": "color-primary",
      "token_type": "color",
      "token_value": "rgb(0, 123, 255)",
      "source": "normalized",
      "meta": {
        "originalKey": "--primary-color",
        "description": "Primary brand color"
      },
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "brandVoice": {
    "tone": "professional, friendly",
    "personality": "authoritative yet approachable",
    "themes": ["innovation", "customer-focused", "reliable"]
  },
  "stats": {
    "totalTokens": 45,
    "totalProducts": 12,
    "crawledAt": "2024-01-01T00:00:00.000Z"
  },
  "fromCache": false
}
```

**Status Codes:**
- `200 OK`: Successfully crawled
- `400 Bad Request`: Invalid URL or parameters
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "depth": 1
  }'
```

---

### Get Site Data

Retrieve complete data for a previously crawled site.

**Endpoint:** `GET /api/sites/:id`

**Parameters:**
- `id` (required): Site UUID

**Response:**
```json
{
  "site": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://example.com",
    "domain": "example.com",
    "title": "Example Site",
    "description": "An example website",
    "crawled_at": "2024-01-01T00:00:00.000Z"
  },
  "companyInfo": {
    "id": "...",
    "company_name": "Example Corp",
    "contact_emails": ["info@example.com"],
    "contact_phones": ["+1-555-0100"],
    "structured_json": { ... }
  },
  "designTokens": [ ... ],
  "products": [ ... ],
  "brandVoice": {
    "id": "...",
    "summary": "...",
    "guidelines": { ... }
  }
}
```

**Status Codes:**
- `200 OK`: Site found
- `404 Not Found`: Site doesn't exist
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl http://localhost:3000/api/sites/550e8400-e29b-41d4-a716-446655440000
```

---

### Get Design Tokens

Retrieve all design tokens for a site.

**Endpoint:** `GET /api/sites/:id/tokens`

**Parameters:**
- `id` (required): Site UUID

**Response:**
```json
{
  "tokens": [
    {
      "id": "...",
      "site_id": "550e8400-e29b-41d4-a716-446655440000",
      "token_key": "color-primary",
      "token_type": "color",
      "token_value": "rgb(0, 123, 255)",
      "source": "normalized",
      "meta": {
        "originalKey": "--primary-color",
        "description": "Primary brand color"
      },
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "...",
      "token_key": "font-family-base",
      "token_type": "typography",
      "token_value": "Arial, sans-serif",
      "source": "computed",
      "meta": {},
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Tokens retrieved
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl http://localhost:3000/api/sites/550e8400-e29b-41d4-a716-446655440000/tokens
```

---

### Download Brand Profile PDF

Generate and download a PDF brand profile report.

**Endpoint:** `GET /api/sites/:id/brand-profile`

**Parameters:**
- `id` (required): Site UUID

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="brand-profile-{id}.pdf"`
- Binary PDF data

**Status Codes:**
- `200 OK`: PDF generated successfully
- `404 Not Found`: Site doesn't exist
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl http://localhost:3000/api/sites/550e8400-e29b-41d4-a716-446655440000/brand-profile \
  -o brand-profile.pdf
```

---

## Design Token Types

The system categorizes design tokens into these types:

- `color`: Color values (rgb, hex, rgba)
- `typography`: Font families, sizes, weights
- `spacing`: Margins, padding, gaps
- `shadow`: Box shadows
- `border`: Border radius, border styles
- `css-variable`: CSS custom properties
- `other`: Uncategorized tokens

## Token Sources

- `css`: Extracted from CSS custom properties
- `computed`: Derived from computed styles
- `normalized`: Processed by AI normalization

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

**Common Errors:**

**400 Bad Request**
```json
{
  "error": "URL is required"
}
```

**400 Bad Request - Invalid URL**
```json
{
  "error": "Invalid URL format"
}
```

**403 Forbidden - robots.txt**
```json
{
  "error": "Crawling not allowed by robots.txt"
}
```

**429 Too Many Requests**
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to crawl site",
  "message": "Detailed error message"
}
```

## Best Practices

### Caching

- Results are cached for 1 hour by default
- Use `skipCache: true` to force a fresh crawl
- Cache is based on URL

### Rate Limiting

- Space out requests to avoid rate limits
- Use cached responses when possible
- Consider implementing retry logic with exponential backoff

### URL Selection

- Ensure URLs are accessible and public
- Check robots.txt compliance manually for sensitive sites
- Use fully qualified URLs (include protocol)

### Error Handling

Always handle potential errors:

```javascript
try {
  const response = await fetch('/api/crawl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' })
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('Error:', error);
    return;
  }
  
  const data = await response.json();
  console.log('Success:', data);
} catch (error) {
  console.error('Network error:', error);
}
```

## Response Times

Typical response times:

- Health check: <10ms
- Cached crawl: 10-50ms
- Fresh crawl: 5-30 seconds (depends on site complexity)
- PDF generation: 1-3 seconds

## Webhooks

*Coming soon: Webhook support for asynchronous crawling notifications*

## SDK Support

*Coming soon: JavaScript/TypeScript SDK for easier integration*

## GraphQL API

*Coming soon: GraphQL endpoint for flexible querying*
