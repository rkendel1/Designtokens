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

  async updateSiteStatus(siteId, status, message = null) {
    const { data, error } = await supabase
      .from('sites')
      .update({ status: status, status_message: message })
      .eq('id', siteId);
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

  // --- New Simplified Orchestration ---
  async saveRawCrawlData(crawlData) {
    const existingSite = await this.getSiteByUrl(crawlData.url);
    if (existingSite) {
      await this.deleteSite(existingSite.id);
    }

    const site = await this.createSite({
      url: crawlData.url,
      domain: crawlData.domain,
      title: crawlData.meta.title,
      description: crawlData.meta.description,
      raw_html: crawlData.html,
      screenshot: crawlData.screenshot,
      raw_design_tokens: crawlData.designTokens,
      raw_css_variables: crawlData.cssVariables,
      raw_text_content: crawlData.textContent,
    });
    const siteId = site.id;

    // Save basic info that doesn't require AI
    await this.createCompanyInfo(siteId, {
        company_name: crawlData.meta.title,
        contact_emails: crawlData.structuredData.emails,
        contact_phones: crawlData.structuredData.phones,
        structured_json: crawlData.structuredData,
        logo_url: crawlData.logoUrl,
    });

    await this.createProductsBulk(siteId, crawlData.structuredData.products);

    return { 
        siteId, 
        name: crawlData.meta.title,
        message: 'Raw data saved. Processing triggered.'
    };
  }
}

export default new Store();