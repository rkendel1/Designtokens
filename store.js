import supabase from './supabase-client.js';
import llm from './llm.js';

if (!supabase) {
  throw new Error("Supabase client failed to initialize. Check your .env file and SUPABASE_URL/SUPABASE_ANON_KEY variables.");
}

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

    // 1. Create Site
    const site = await this.createSite({
      url: crawlData.url,
      domain: crawlData.domain,
      title: crawlData.meta.title,
      description: crawlData.meta.description,
      raw_html: crawlData.html,
      screenshot: crawlData.screenshot,
    });

    const siteId = site.id;

    // 2. Create Company Info
    await this.createCompanyInfo(siteId, {
      company_name: semanticBrandKit.name,
      contact_emails: crawlData.structuredData.emails,
      contact_phones: crawlData.structuredData.phones,
      structured_json: crawlData.structuredData,
    });

    // 3. Transform and Create Design Tokens
    const tokensToInsert = [];
    const tokenCategories = ['colors', 'typography', 'spacing', 'radius', 'shadows'];
    for (const category of tokenCategories) {
      if (semanticBrandKit[category]) {
        for (const [key, value] of Object.entries(semanticBrandKit[category])) {
          if (typeof value === 'string') {
            tokensToInsert.push({
              token_key: key,
              token_type: category,
              token_value: value,
              source: 'llm-normalized',
            });
          } else if (typeof value === 'object' && value !== null) {
            for (const [subKey, subValue] of Object.entries(value)) {
               tokensToInsert.push({
                token_key: `${key}.${subKey}`,
                token_type: category,
                token_value: subValue.toString(),
                source: 'llm-normalized',
              });
            }
          }
        }
      }
    }
    await this.createDesignTokensBulk(siteId, tokensToInsert);

    // 4. Create Products
    await this.createProductsBulk(siteId, crawlData.structuredData.products);

    // 5. Create Brand Voice
    if (semanticBrandKit.voice) {
      await this.createBrandVoice(siteId, semanticBrandKit.voice, crawlData.textContent);
    }

    return { siteId, ...semanticBrandKit };
  }
}

export default new Store();