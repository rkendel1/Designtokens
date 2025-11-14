-- Migration: Add extraction pipeline tables for orchestration and state management
-- This migration adds tables to track extraction jobs and their individual steps,
-- enabling incremental processing, retry logic, and better error recovery.

-- Create enum for extraction job status
CREATE TYPE extraction_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'partial');

-- Create enum for extraction step types
CREATE TYPE extraction_step_type AS ENUM (
  'url_validation',
  'basic_crawl',
  'screenshot_capture',
  'css_extraction',
  'design_token_extraction',
  'structured_data_extraction',
  'llm_enrichment',
  'brand_kit_generation',
  'pdf_generation'
);

-- Create the 'extraction_jobs' table to track overall extraction progress
CREATE TABLE public.extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status extraction_status DEFAULT 'pending',
  total_steps INTEGER DEFAULT 9,
  completed_steps INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX idx_extraction_jobs_status ON public.extraction_jobs(status);
CREATE INDEX idx_extraction_jobs_site_id ON public.extraction_jobs(site_id);
CREATE INDEX idx_extraction_jobs_url ON public.extraction_jobs(url);

-- Create the 'extraction_steps' table to track individual step progress
CREATE TABLE public.extraction_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.extraction_jobs(id) ON DELETE CASCADE,
  step_type extraction_step_type NOT NULL,
  step_order INTEGER NOT NULL,
  status extraction_status DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(job_id, step_type)
);

-- Create indexes for faster lookups
CREATE INDEX idx_extraction_steps_job_id ON public.extraction_steps(job_id);
CREATE INDEX idx_extraction_steps_status ON public.extraction_steps(status);
CREATE INDEX idx_extraction_steps_step_type ON public.extraction_steps(step_type);

-- Add columns to sites table for better state tracking
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS status extraction_status DEFAULT 'pending';
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS last_extraction_job_id UUID REFERENCES public.extraction_jobs(id);
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}';
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- Add columns for incremental data storage
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS raw_design_tokens JSONB;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS raw_css_variables JSONB;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS raw_text_content TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS pdf_kit_url TEXT;

-- Add columns to company_info for incremental updates
ALTER TABLE public.company_info ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.company_info ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- Create the 'brand_kits' table for storing generated brand kits
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  kit_data JSONB NOT NULL,
  pdf_url TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create the 'brand_profiles' table for storing the final JSON output
CREATE TABLE IF NOT EXISTS public.brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_extraction_jobs_updated_at BEFORE UPDATE ON public.extraction_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extraction_steps_updated_at BEFORE UPDATE ON public.extraction_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_info_updated_at BEFORE UPDATE ON public.company_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_kits_updated_at BEFORE UPDATE ON public.brand_kits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_profiles_updated_at BEFORE UPDATE ON public.brand_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for new tables
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public extraction_jobs are viewable by everyone." ON public.extraction_jobs FOR SELECT USING (true);
CREATE POLICY "Anyone can create extraction_jobs." ON public.extraction_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update extraction_jobs." ON public.extraction_jobs FOR UPDATE USING (true);

ALTER TABLE public.extraction_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public extraction_steps are viewable by everyone." ON public.extraction_steps FOR SELECT USING (true);
CREATE POLICY "Anyone can create extraction_steps." ON public.extraction_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update extraction_steps." ON public.extraction_steps FOR UPDATE USING (true);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public brand_kits are viewable by everyone." ON public.brand_kits FOR SELECT USING (true);
CREATE POLICY "Anyone can create brand_kits." ON public.brand_kits FOR INSERT WITH CHECK (true);

ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public brand_profiles are viewable by everyone." ON public.brand_profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can create brand_profiles." ON public.brand_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update brand_profiles." ON public.brand_profiles FOR UPDATE USING (true);

-- Add helpful views for monitoring
CREATE OR REPLACE VIEW extraction_job_summary AS
SELECT 
    ej.id,
    ej.url,
    ej.status,
    ej.completed_steps || '/' || ej.total_steps as progress,
    ej.retry_count,
    ej.created_at,
    ej.updated_at,
    ej.completed_at,
    CASE 
        WHEN ej.completed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (ej.completed_at - ej.created_at))::INTEGER 
        ELSE NULL 
    END as duration_seconds,
    COUNT(es.id) FILTER (WHERE es.status = 'completed') as steps_completed,
    COUNT(es.id) FILTER (WHERE es.status = 'failed') as steps_failed,
    COUNT(es.id) FILTER (WHERE es.status = 'in_progress') as steps_in_progress
FROM extraction_jobs ej
LEFT JOIN extraction_steps es ON es.job_id = ej.id
GROUP BY ej.id;

-- Grant permissions on the view
GRANT SELECT ON extraction_job_summary TO anon, authenticated;