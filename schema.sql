-- Database schema for Design Tokens Crawler
-- PostgreSQL with pgvector extension

CREATE EXTENSION IF NOT EXISTS vector;

-- Sites table: stores crawled site information
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  domain TEXT,
  title TEXT,
  description TEXT,
  crawled_at TIMESTAMPTZ DEFAULT now(),
  raw_html TEXT,
  screenshot BYTEA
);

-- Company information extracted from sites
CREATE TABLE IF NOT EXISTS company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  company_name TEXT,
  legal_name TEXT,
  contact_emails TEXT[],
  contact_phones TEXT[],
  addresses TEXT[],
  structured_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Design tokens extracted from sites
CREATE TABLE IF NOT EXISTS design_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  token_key TEXT,
  token_type TEXT,
  token_value TEXT,
  source TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products extracted from sites
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT,
  slug TEXT,
  price TEXT,
  description TEXT,
  product_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Brand voice analysis with embeddings
CREATE TABLE IF NOT EXISTS brand_voice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  summary TEXT,
  guidelines JSONB,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sites_url ON sites(url);
CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
CREATE INDEX IF NOT EXISTS idx_company_info_site_id ON company_info(site_id);
CREATE INDEX IF NOT EXISTS idx_design_tokens_site_id ON design_tokens(site_id);
CREATE INDEX IF NOT EXISTS idx_design_tokens_type ON design_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_products_site_id ON products(site_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_site_id ON brand_voice(site_id);
