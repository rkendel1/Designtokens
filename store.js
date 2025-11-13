import supabase from './supabase-client.js';
import llm from './llm.js';

// The check for a valid Supabase client is now handled directly in supabase-client.js,
// so we can remove the check from this file to avoid a generic error.

class Store {
  // --- Site Operations ---
  async getSiteByUrl(url) {
    const { data, error } = await supabase
      .from('sites')
      .select('id')
      .eq('url', url)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // Ignore "not found"
    return data;
  }

  async createSite(siteData) {
    const { data, error } = await supabase
      .from('sites')
      .insert(siteData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteSite(siteId) {
    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', siteId);
    if (error) throw error;
  }

  // --- Data Insertion Operations ---
  async createCompanyInfo(siteId, companyData) {
    const { data, error } = await supabase
      .from('company_info')
      .insert({ site_id: siteId, ...companyData });
    if (error) throw error;
    return data;
  }

  async createDesignTokensBulk(siteId, tokens) {
    if (!tokens || tokens.length === 0) return null;
    const tokensWithSiteId = tokens.map(token => ({ site_id: siteId, ...token }));
    const { data, error } = await supabase
      .from('design_tokens')
      .insert(tokensWithSiteId);
    if (error) throw error;
    return data;
  }

  async createProductsBulk(siteId, products) {
    if (!products || products.length === 0) return null;
    
    // Map the product data to the correct database schema
    const productsToInsert = products.map(product => ({
      site_id: siteId,
      name: product.name,
      slug: product.slug || null,
      price: product.price || (product.offers ? (product.offers.price || (product.offers[0] && product.offers[0].price)) : null),
      description: product.description,
      product_url: product.url || product.link || product.product_url, // Map url/link to product_url
      metadata: product // Store the original object in metadata
    }));

    const { data, error } = await supabase
      .from('products')
      .insert(productsToInsert);
      
    if (error) throw error;
    return data;
  }

  async createBrandVoice(siteId, voiceData, textContent) {
    // Generate embedding for the brand voice summary
    const embedding = await llm.generateEmbedding(textContent);
    const { data, error } = await supabase
      .from('brand_voice')
      .insert({
        site_id: siteId,
        summary: voiceData.summary,
        guidelines: voiceData.guidelines,
        embedding: embedding,
      });
    if (error) throw error;
    return data;
  }

  // --- Orchestration ---
  async saveCrawlResult(crawlData, semanticBrandKit) {
    // Check for and delete existing site data to prevent unique constraint violation
    const existingSite = await this.getSiteByUrl(crawlData.url);
    if (existingSite) {
      await this.deleteSite(existingSite.id);
    }

    // 1. Create Site (always happens)
    const site = await this.createSite({
      url: crawlData.url,
      domain: crawlData.domain,
      title: crawlData.meta.title,
      description: crawlData.meta.description,
      raw_html: crawlData.html,
      screenshot: crawlData.screenshot,
    });
    const siteId = site.id;

    // Always save products from raw crawl data
    await this.createProductsBulk(siteId, crawlData.structuredData.products);

    // If we have the semantic kit from the LLM, save the structured, AI-analyzed data.
    if (semanticBrandKit) {
        await this.createCompanyInfo(siteId, {
            company_name: semanticBrandKit.name,
            contact_emails: crawlData.structuredData.emails,
            contact_phones: crawlData.structuredData.phones,
            structured_json: crawlData.structuredData,
        });

        const tokensToInsert = [];
        const tokenCategories = ['colors', 'typography', 'spacing', 'radius', 'shadows'];
        for (const category of tokenCategories) {
            if (semanticBrandKit[category]) {
                for (const [key, value] of Object.entries(semanticBrandKit[category])) {
                    if (typeof value === 'string') {
                        tokensToInsert.push({ token_key: key, token_type: category, token_value: value, source: 'llm-normalized' });
                    } else if (typeof value === 'object' && value !== null) {
                        for (const [subKey, subValue] of Object.entries(value)) {
                           tokensToInsert.push({ token_key: `${key}.${subKey}`, token_type: category, token_value: subValue.toString(), source: 'llm-normalized' });
                        }
                    }
                }
            }
        }
        await this.createDesignTokensBulk(siteId, tokensToInsert);

        if (semanticBrandKit.voice) {
            await this.createBrandVoice(siteId, semanticBrandKit.voice, crawlData.textContent);
        }
        
        return { siteId, ...semanticBrandKit };
    } else {
        // Fallback: Save raw data if LLM is not available or failed.
        await this.createCompanyInfo(siteId, {
            company_name: crawlData.meta.title, // Use site title as fallback
            contact_emails: crawlData.structuredData.emails,
            contact_phones: crawlData.structuredData.phones,
            structured_json: crawlData.structuredData,
        });

        const rawTokens = crawlData.designTokens || {};
        const tokensToInsert = [];
        const tokenTypes = ['colors', 'fonts', 'fontSizes', 'spacing', 'borderRadius', 'shadows'];
        for (const tokenType of tokenTypes) {
            if (Array.isArray(rawTokens[tokenType])) {
                rawTokens[tokenType].forEach((value, index) => {
                    tokensToInsert.push({ token_key: `${tokenType}_${index}`, token_type: tokenType, token_value: String(value), source: 'raw-crawl' });
                });
            }
        }
        if (rawTokens.cssVariables && typeof rawTokens.cssVariables === 'object') {
            Object.entries(rawTokens.cssVariables).forEach(([key, value]) => {
                tokensToInsert.push({ token_key: key, token_type: 'css-variable', token_value: String(value), source: 'raw-crawl' });
            });
        }
        await this.createDesignTokensBulk(siteId, tokensToInsert);

        return { 
            siteId, 
            name: crawlData.meta.title,
            message: 'LLM not configured or failed. Raw data has been saved.'
        };
    }
  }
}

export default new Store();