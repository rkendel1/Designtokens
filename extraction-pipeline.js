import supabase from './supabase-client.js';
import crawler from './crawler.js';
import store from './store.js';
import llm from './llm.js';
import { extractColorPalette } from './image-processor.js';
import config from './config.js';

/**
 * Extraction Pipeline Manager
 * 
 * This class orchestrates the extraction process by breaking it down into
 * discrete, retryable steps. Each step saves its progress incrementally,
 * allowing for recovery from failures and ensuring consistent results.
 */
class ExtractionPipeline {
  constructor() {
    this.steps = [
      { type: 'url_validation', order: 1, handler: this.validateUrl.bind(this) },
      { type: 'basic_crawl', order: 2, handler: this.performBasicCrawl.bind(this) },
      { type: 'screenshot_capture', order: 3, handler: this.captureScreenshot.bind(this) },
      { type: 'css_extraction', order: 4, handler: this.extractCSS.bind(this) },
      { type: 'design_token_extraction', order: 5, handler: this.extractDesignTokens.bind(this) },
      { type: 'structured_data_extraction', order: 6, handler: this.extractStructuredData.bind(this) },
      { type: 'llm_enrichment', order: 7, handler: this.performLLMEnrichment.bind(this) },
      { type: 'brand_kit_generation', order: 8, handler: this.generateBrandKit.bind(this) },
      { type: 'pdf_generation', order: 9, handler: this.generatePDF.bind(this) }
    ];
  }

  /**
   * Start a new extraction job for a URL
   */
  async startExtraction(url) {
    console.log(`[Pipeline] Starting extraction for URL: ${url}`);
    
    try {
      // Check if there's an existing job for this URL
      const existingJob = await this.getExistingJob(url);
      
      if (existingJob && existingJob.status === 'in_progress') {
        console.log(`[Pipeline] Resuming existing job ${existingJob.id}`);
        return await this.resumeJob(existingJob);
      }
      
      // Create a new extraction job
      const job = await this.createJob(url);
      console.log(`[Pipeline] Created new job ${job.id}`);
      
      // Initialize extraction steps
      await this.initializeSteps(job.id);
      
      // Execute the pipeline
      return await this.executePipeline(job);
      
    } catch (error) {
      console.error(`[Pipeline] Extraction failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Resume an existing extraction job
   */
  async resumeJob(job) {
    console.log(`[Pipeline] Resuming job ${job.id} from step ${job.completed_steps + 1}`);
    return await this.executePipeline(job);
  }

  /**
   * Execute the extraction pipeline
   */
  async executePipeline(job) {
    let currentJob = job;
    
    try {
      // Update job status to in_progress
      await this.updateJobStatus(job.id, 'in_progress');
      
      // Get all steps for this job
      const { data: steps, error } = await supabase
        .from('extraction_steps')
        .select('*')
        .eq('job_id', job.id)
        .order('step_order', { ascending: true });
      
      if (error) throw error;
      
      // Execute each step
      for (const step of steps) {
        if (step.status === 'completed') {
          console.log(`[Pipeline] Step ${step.step_type} already completed, skipping`);
          continue;
        }
        
        console.log(`[Pipeline] Executing step ${step.step_type}`);
        
        // Execute step with retry logic
        const success = await this.executeStepWithRetry(job, step);
        
        if (!success) {
          // Mark job as partial if a step fails after retries
          await this.updateJobStatus(job.id, 'partial', `Step ${step.step_type} failed after retries`);
          console.error(`[Pipeline] Job ${job.id} marked as partial due to step failure`);
          break;
        }
        
        // Update job progress
        currentJob = await this.incrementJobProgress(job.id);
      }
      
      // Check if all steps completed
      if (currentJob.completed_steps === currentJob.total_steps) {
        await this.updateJobStatus(job.id, 'completed');
        console.log(`[Pipeline] Job ${job.id} completed successfully`);
      }
      
      // Return the final result
      return await this.getJobResult(job.id);
      
    } catch (error) {
      console.error(`[Pipeline] Pipeline execution failed for job ${job.id}:`, error);
      await this.updateJobStatus(job.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Execute a single step with retry logic
   */
  async executeStepWithRetry(job, step) {
    const maxRetries = step.max_retries || 3;
    let retryCount = step.retry_count || 0;
    
    while (retryCount <= maxRetries) {
      try {
        // Update step status to in_progress
        await this.updateStepStatus(step.id, 'in_progress');
        
        // Find the handler for this step type
        const stepConfig = this.steps.find(s => s.type === step.step_type);
        if (!stepConfig) {
          throw new Error(`No handler found for step type: ${step.step_type}`);
        }
        
        // Execute the step handler
        const startTime = Date.now();
        const result = await stepConfig.handler(job, step);
        const duration = Date.now() - startTime;
        
        // Save step output and mark as completed
        await this.completeStep(step.id, result, duration);
        
        console.log(`[Pipeline] Step ${step.step_type} completed in ${duration}ms`);
        return true;
        
      } catch (error) {
        console.error(`[Pipeline] Step ${step.step_type} failed (attempt ${retryCount + 1}):`, error);
        
        retryCount++;
        
        // Update retry count
        await supabase
          .from('extraction_steps')
          .update({ retry_count: retryCount, error_message: error.message })
          .eq('id', step.id);
        
        if (retryCount > maxRetries) {
          // Mark step as failed after max retries
          await this.updateStepStatus(step.id, 'failed', error.message);
          return false;
        }
        
        // Exponential backoff before retry
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 30000);
        console.log(`[Pipeline] Retrying step ${step.step_type} in ${backoffMs}ms`);
        await this.sleep(backoffMs);
      }
    }
    
    return false;
  }

  /**
   * Step 1: Validate URL
   */
  async validateUrl(job, step) {
    const url = job.url;
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL format: ${url}`);
    }
    
    // Check robots.txt compliance
    const allowed = await crawler.checkRobots(url);
    if (!allowed) {
      throw new Error('Crawling not allowed by robots.txt');
    }
    
    // Check if site exists or create it
    let site = await store.getSiteByUrl(url);
    
    if (!site) {
      const urlObj = new URL(url);
      site = await store.createSite({
        url: url,
        domain: urlObj.hostname,
        status: 'pending',
        last_extraction_job_id: job.id
      });
    } else {
      // Update site with new job ID
      await supabase
        .from('sites')
        .update({ 
          last_extraction_job_id: job.id,
          status: 'in_progress'
        })
        .eq('id', site.id);
    }
    
    // Update job with site_id
    await supabase
      .from('extraction_jobs')
      .update({ site_id: site.id })
      .eq('id', job.id);
    
    return { 
      valid: true, 
      site_id: site.id,
      domain: new URL(url).hostname 
    };
  }

  /**
   * Step 2: Perform basic crawl
   */
  async performBasicCrawl(job, step) {
    const url = job.url;
    
    // Initialize crawler
    await crawler.init();
    
    try {
      // Perform fast crawl to get HTML and basic data
      const crawlData = await crawler.crawlFast(url);
      
      // Save HTML and basic metadata to sites table
      const { data: site } = await supabase
        .from('sites')
        .update({
          title: crawlData.meta?.title,
          description: crawlData.meta?.description,
          raw_html: crawlData.html,
          raw_text_content: crawlData.textContent
        })
        .eq('id', job.site_id)
        .select()
        .single();
      
      return {
        html_size: crawlData.html.length,
        title: crawlData.meta?.title,
        description: crawlData.meta?.description,
        structured_data: crawlData.structuredData
      };
      
    } finally {
      // Don't close crawler yet, we'll need it for screenshot
    }
  }

  /**
   * Step 3: Capture screenshot
   */
  async captureScreenshot(job, step) {
    const url = job.url;
    
    try {
      // Use deep crawl mode but only for screenshot
      await crawler.init();
      const context = await crawler.browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: crawler.getRandomUserAgent()
      });
      const page = await context.newPage();
      
      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.crawler.requestTimeout
      });
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      // Capture screenshot
      const screenshot = await page.screenshot({ 
        fullPage: true, 
        type: 'png' 
      });
      
      // Convert to base64
      const screenshotBase64 = screenshot.toString('base64');
      
      // Save screenshot to sites table
      await supabase
        .from('sites')
        .update({ screenshot: screenshotBase64 })
        .eq('id', job.site_id);
      
      // Extract colors from screenshot
      let screenshotColors = [];
      try {
        screenshotColors = await extractColorPalette(screenshot, 8);
      } catch (error) {
        console.warn('Screenshot color extraction failed:', error);
      }
      
      await context.close();
      
      return {
        screenshot_captured: true,
        screenshot_size: screenshotBase64.length,
        screenshot_colors: screenshotColors
      };
      
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      // Non-critical error, continue pipeline
      return {
        screenshot_captured: false,
        error: error.message
      };
    }
  }

  /**
   * Step 4: Extract CSS
   */
  async extractCSS(job, step) {
    const url = job.url;
    
    try {
      await crawler.init();
      const context = await crawler.browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: crawler.getRandomUserAgent()
      });
      const page = await context.newPage();
      
      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.crawler.requestTimeout
      });
      
      // Extract CSS variables and stylesheet rules
      const cssData = await crawler.extractCSSVariables(page);
      
      // Save CSS data to sites table
      await supabase
        .from('sites')
        .update({ 
          raw_css_variables: cssData.variables || {}
        })
        .eq('id', job.site_id);
      
      await context.close();
      
      return {
        css_variables_count: Object.keys(cssData.variables || {}).length,
        stylesheet_rules: cssData.stylesheetRules
      };
      
    } catch (error) {
      console.error('CSS extraction failed:', error);
      return {
        css_extracted: false,
        error: error.message
      };
    }
  }

  /**
   * Step 5: Extract design tokens
   */
  async extractDesignTokens(job, step) {
    const url = job.url;
    
    try {
      await crawler.init();
      const context = await crawler.browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: crawler.getRandomUserAgent()
      });
      const page = await context.newPage();
      
      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.crawler.requestTimeout
      });
      
      // Wait for dynamic content
      await page.waitForTimeout(2000);
      await crawler.handleLazyLoad(page);
      
      // Extract computed styles
      const computedStyles = await crawler.extractComputedStyles(page);
      
      // Extract Tailwind classes
      const tailwindResolved = await crawler.resolveTailwindClasses(page);
      
      // Get previous CSS data from step 4
      const { data: prevStep } = await supabase
        .from('extraction_steps')
        .select('output_data')
        .eq('job_id', job.id)
        .eq('step_type', 'css_extraction')
        .single();
      
      const stylesheetRules = prevStep?.output_data?.stylesheet_rules || {};
      
      // Merge all styles
      const mergedStyles = {
        colors: Array.from(new Set([
          ...(computedStyles.colors || []),
          ...(stylesheetRules.colors || []),
          ...(tailwindResolved.colors || [])
        ])),
        fonts: Array.from(new Set([
          ...(computedStyles.fonts || []),
          ...(stylesheetRules.fonts || []),
          ...(tailwindResolved.fonts || [])
        ])),
        fontSizes: Array.from(new Set([
          ...(computedStyles.fontSizes || []),
          ...(stylesheetRules.fontSizes || []),
          ...(tailwindResolved.fontSizes || [])
        ])),
        spacing: Array.from(new Set([
          ...(computedStyles.spacing || []),
          ...(stylesheetRules.spacing || []),
          ...(tailwindResolved.spacing || [])
        ])),
        borderRadius: Array.from(new Set([
          ...(computedStyles.borderRadius || []),
          ...(stylesheetRules.borderRadius || []),
          ...(tailwindResolved.borderRadius || [])
        ])),
        shadows: Array.from(new Set([
          ...(computedStyles.shadows || []),
          ...(stylesheetRules.shadows || []),
          ...(tailwindResolved.shadows || [])
        ]))
      };
      
      // Process into design tokens
      const designTokens = {
        colors: crawler.extractMajorColors(mergedStyles),
        fonts: crawler.extractMajorFonts(mergedStyles),
        fontSizes: mergedStyles.fontSizes || [],
        spacing: crawler.extractSpacingScale(mergedStyles),
        borderRadius: mergedStyles.borderRadius || [],
        shadows: mergedStyles.shadows || []
      };
      
      // Add screenshot colors if available
      const { data: screenshotStep } = await supabase
        .from('extraction_steps')
        .select('output_data')
        .eq('job_id', job.id)
        .eq('step_type', 'screenshot_capture')
        .single();
      
      if (screenshotStep?.output_data?.screenshot_colors) {
        designTokens.colors = Array.from(new Set([
          ...designTokens.colors,
          ...screenshotStep.output_data.screenshot_colors
        ]));
      }
      
      // Save design tokens to sites table
      await supabase
        .from('sites')
        .update({ 
          raw_design_tokens: designTokens
        })
        .eq('id', job.site_id);
      
      await context.close();
      
      return {
        tokens_extracted: true,
        color_count: designTokens.colors.length,
        font_count: designTokens.fonts.length,
        design_tokens: designTokens
      };
      
    } catch (error) {
      console.error('Design token extraction failed:', error);
      return {
        tokens_extracted: false,
        error: error.message
      };
    }
  }

  /**
   * Step 6: Extract structured data
   */
  async extractStructuredData(job, step) {
    try {
      // Get HTML from sites table
      const { data: site } = await supabase
        .from('sites')
        .select('raw_html, url')
        .eq('id', job.site_id)
        .single();
      
      if (!site || !site.raw_html) {
        throw new Error('No HTML found for site');
      }
      
      // Extract structured data using Cheerio
      const structuredData = crawler.extractStructuredData(site.raw_html);
      
      // Extract logo and hero image
      await crawler.init();
      const context = await crawler.browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: crawler.getRandomUserAgent()
      });
      const page = await context.newPage();
      
      await page.goto(site.url, {
        waitUntil: 'networkidle',
        timeout: config.crawler.requestTimeout
      });
      
      const { logoUrl } = await crawler.extractLogoAndFavicon(page, site.url);
      const heroImageUrl = await crawler.extractHeroImage(page, site.url);
      
      await context.close();
      
      // Save company info
      const companyInfo = {
        company_name: structuredData.meta?.title,
        contact_emails: structuredData.emails || [],
        contact_phones: structuredData.phones || [],
        structured_json: structuredData,
        logo_url: logoUrl
      };
      
      // Check if company_info exists
      const { data: existingInfo } = await supabase
        .from('company_info')
        .select('id')
        .eq('site_id', job.site_id)
        .single();
      
      if (existingInfo) {
        await supabase
          .from('company_info')
          .update(companyInfo)
          .eq('site_id', job.site_id);
      } else {
        await store.createCompanyInfo(job.site_id, companyInfo);
      }
      
      // Save products
      if (structuredData.products && structuredData.products.length > 0) {
        await store.createProductsBulk(job.site_id, structuredData.products);
      }
      
      return {
        structured_data_extracted: true,
        email_count: structuredData.emails?.length || 0,
        phone_count: structuredData.phones?.length || 0,
        product_count: structuredData.products?.length || 0,
        logo_url: logoUrl,
        hero_image_url: heroImageUrl
      };
      
    } catch (error) {
      console.error('Structured data extraction failed:', error);
      return {
        structured_data_extracted: false,
        error: error.message
      };
    } finally {
      // Close crawler after structured data extraction
      await crawler.close();
    }
  }

  /**
   * Step 7: Perform LLM enrichment
   */
  async performLLMEnrichment(job, step) {
    const isLlmConfigured = config.openai.apiKey && config.openai.apiKey.startsWith('sk-');
    
    if (!isLlmConfigured) {
      console.log('[Pipeline] LLM not configured, skipping enrichment');
      return {
        llm_enriched: false,
        reason: 'LLM not configured'
      };
    }
    
    try {
      // Get site data
      const { data: site } = await supabase
        .from('sites')
        .select('raw_html, raw_design_tokens, raw_css_variables')
        .eq('id', job.site_id)
        .single();
      
      if (!site) {
        throw new Error('No site data found');
      }
      
      // Get previous extraction results
      const { data: designTokenStep } = await supabase
        .from('extraction_steps')
        .select('output_data')
        .eq('job_id', job.id)
        .eq('step_type', 'design_token_extraction')
        .single();
      
      const enrichedContext = {
        ...site.raw_design_tokens,
        cssVariables: site.raw_css_variables
      };
      
      // Enrich design tokens with LLM
      let llmDesignTokens = {};
      try {
        llmDesignTokens = await llm.inferDesignTokensFromLLM(site.raw_html, enrichedContext);
      } catch (error) {
        console.warn('LLM design token enrichment failed:', error);
      }
      
      // Enrich features/products with LLM
      let llmFeatures = [];
      try {
        const { data: companyInfo } = await supabase
          .from('company_info')
          .select('structured_json')
          .eq('site_id', job.site_id)
          .single();
        
        llmFeatures = await llm.extractFeaturesFromLLM(site.raw_html, companyInfo?.structured_json || {});
      } catch (error) {
        console.warn('LLM feature extraction failed:', error);
      }
      
      // Merge LLM enriched tokens with existing tokens
      const existingTokens = site.raw_design_tokens || {};
      const mergedTokens = { ...existingTokens };
      
      for (const key in llmDesignTokens) {
        if (Array.isArray(mergedTokens[key]) && Array.isArray(llmDesignTokens[key])) {
          mergedTokens[key] = Array.from(new Set([...mergedTokens[key], ...llmDesignTokens[key]]));
        } else if (key === 'cssVariables' && llmDesignTokens[key]) {
          mergedTokens.cssVariables = { ...mergedTokens.cssVariables, ...llmDesignTokens.cssVariables };
        }
      }
      
      // Update design tokens with enriched data
      await supabase
        .from('sites')
        .update({ 
          raw_design_tokens: mergedTokens
        })
        .eq('id', job.site_id);
      
      // Add LLM features as products
      if (llmFeatures.length > 0) {
        await store.createProductsBulk(job.site_id, llmFeatures);
      }
      
      return {
        llm_enriched: true,
        llm_features_count: llmFeatures.length,
        tokens_enriched: Object.keys(llmDesignTokens).length > 0
      };
      
    } catch (error) {
      console.error('LLM enrichment failed:', error);
      return {
        llm_enriched: false,
        error: error.message
      };
    }
  }

  /**
   * Step 8: Generate brand kit
   */
  async generateBrandKit(job, step) {
    try {
      // Invoke the Edge Function to process brand kit
      const { data, error } = await supabase.functions.invoke('process-brand-kit', {
        body: { siteId: job.site_id }
      });
      
      if (error) {
        throw error;
      }
      
      return {
        brand_kit_generated: true,
        pdf_url: data?.pdfKitUrl
      };
      
    } catch (error) {
      console.error('Brand kit generation failed:', error);
      return {
        brand_kit_generated: false,
        error: error.message
      };
    }
  }

  /**
   * Step 9: Generate PDF
   */
  async generatePDF(job, step) {
    // PDF generation is handled by the Edge Function in step 8
    // This step is for any additional PDF processing if needed
    
    try {
      // Check if PDF was generated
      const { data: site } = await supabase
        .from('sites')
        .select('pdf_kit_url')
        .eq('id', job.site_id)
        .single();
      
      if (site?.pdf_kit_url) {
        return {
          pdf_generated: true,
          pdf_url: site.pdf_kit_url
        };
      }
      
      return {
        pdf_generated: false,
        reason: 'PDF generation handled by Edge Function'
      };
      
    } catch (error) {
      console.error('PDF generation check failed:', error);
      return {
        pdf_generated: false,
        error: error.message
      };
    }
  }

  // Helper methods

  async getExistingJob(url) {
    const { data, error } = await supabase
      .from('extraction_jobs')
      .select('*')
      .eq('url', url)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  async createJob(url) {
    const { data, error } = await supabase
      .from('extraction_jobs')
      .insert({
        url: url,
        status: 'pending',
        total_steps: this.steps.length,
        completed_steps: 0
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async initializeSteps(jobId) {
    const stepsToInsert = this.steps.map(step => ({
      job_id: jobId,
      step_type: step.type,
      step_order: step.order,
      status: 'pending'
    }));
    
    const { error } = await supabase
      .from('extraction_steps')
      .insert(stepsToInsert);
    
    if (error) throw error;
  }

  async updateJobStatus(jobId, status, message = null) {
    const update = {
      status: status,
      error_message: message
    };
    
    if (status === 'completed') {
      update.completed_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('extraction_jobs')
      .update(update)
      .eq('id', jobId);
    
    if (error) throw error;
  }

  async updateStepStatus(stepId, status, errorMessage = null) {
    const update = {
      status: status,
      error_message: errorMessage
    };
    
    if (status === 'in_progress') {
      update.started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      update.completed_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('extraction_steps')
      .update(update)
      .eq('id', stepId);
    
    if (error) throw error;
  }

  async completeStep(stepId, outputData, durationMs) {
    const { error } = await supabase
      .from('extraction_steps')
      .update({
        status: 'completed',
        output_data: outputData,
        duration_ms: durationMs,
        completed_at: new Date().toISOString()
      })
      .eq('id', stepId);
    
    if (error) throw error;
  }

  async incrementJobProgress(jobId) {
    // Get current job
    const { data: job, error: fetchError } = await supabase
      .from('extraction_jobs')
      .select('completed_steps')
      .eq('id', jobId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Increment completed steps
    const { data, error } = await supabase
      .from('extraction_jobs')
      .update({ 
        completed_steps: (job.completed_steps || 0) + 1 
      })
      .eq('id', jobId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getJobResult(jobId) {
    const { data: job, error: jobError } = await supabase
      .from('extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (jobError) throw jobError;
    
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', job.site_id)
      .single();
    
    if (siteError) throw siteError;
    
    // Get brand profile if available
    const { data: brandProfile } = await supabase
      .from('brand_profiles')
      .select('profile_data')
      .eq('site_id', job.site_id)
      .single();
    
    return {
      jobId: job.id,
      brandId: job.site_id,
      url: job.url,
      status: job.status,
      completedSteps: job.completed_steps,
      totalSteps: job.total_steps,
      generatedAt: job.created_at,
      completedAt: job.completed_at,
      pdfKitUrl: site?.pdf_kit_url,
      brandProfile: brandProfile?.profile_data,
      message: job.status === 'completed' 
        ? 'Extraction completed successfully' 
        : `Extraction ${job.status}: ${job.error_message || 'In progress'}`
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new ExtractionPipeline();