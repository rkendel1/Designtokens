-- Enable the pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the old, unstructured table if it exists
DROP TABLE IF EXISTS public.brand_kits;

-- Create the 'sites' table to store core information about each crawled site
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  domain TEXT,
  title TEXT,
  description TEXT,
  raw_html TEXT,
  screenshot TEXT, -- Storing as text (base64)
  crawled_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public sites are viewable by everyone." ON public.sites FOR SELECT USING (true);
CREATE POLICY "Anyone can create a site." ON public.sites FOR INSERT WITH CHECK (true);

-- Create the 'company_info' table for structured metadata
CREATE TABLE public.company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  company_name TEXT,
  legal_name TEXT,
  contact_emails TEXT[],
  contact_phones TEXT[],
  addresses TEXT[],
  structured_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.company_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public company_info is viewable by everyone." ON public.company_info FOR SELECT USING (true);
CREATE POLICY "Anyone can create company_info." ON public.company_info FOR INSERT WITH CHECK (true);

-- Create the 'design_tokens' table for granular token storage
CREATE TABLE public.design_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  token_key TEXT,
  token_type TEXT NOT NULL,
  token_value TEXT NOT NULL,
  source TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.design_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public design_tokens are viewable by everyone." ON public.design_tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can create design_tokens." ON public.design_tokens FOR INSERT WITH CHECK (true);

-- Create the 'products' table for extracted products or features
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT,
  slug TEXT,
  price TEXT,
  description TEXT,
  product_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public products are viewable by everyone." ON public.products FOR SELECT USING (true);
CREATE POLICY "Anyone can create products." ON public.products FOR INSERT WITH CHECK (true);

-- Create the 'brand_voice' table for AI-analyzed voice and embeddings
CREATE TABLE public.brand_voice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  summary TEXT,
  guidelines JSONB,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.brand_voice ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public brand_voice is viewable by everyone." ON public.brand_voice FOR SELECT USING (true);
CREATE POLICY "Anyone can create brand_voice." ON public.brand_voice FOR INSERT WITH CHECK (true);