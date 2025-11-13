import supabase from './supabase-client.js';
import llm from './llm.js';

class Store {
  async getSiteByUrl(url) {
    const { data, error } = await supabase.from('sites').select('id').eq('url', url).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createSite(siteData) {
    const { data, error } = await supabase.from('sites').insert(siteData).select().single();
    if (error) throw error;
    return data;
  }

  async deleteSite(siteId) {
    // This will cascade and delete related data in other tables
    const { error } = await supabase.from('sites').delete().eq('id', siteId);
    if (error) throw error;
  }

  async createCompanyInfo(siteId, companyData) {
    const { data, error } = await supabase.from('company_info').insert({ site_id: siteId, ...companyData });
    if (error) throw error;
    return data;
  }

  async createProductsBulk(siteId, products) {
    if (!products || products.length === 0) return null;
    const productsToInsert = products.map(p => ({ site_id: siteId, name: p.name, price: p.price, product_url: p.url, metadata: p }));
    const { data, error } = await supabase.from('products').insert(productsToInsert);
    if (error) throw error;
    return data;
  }

  async createDesignTokensBulk(siteId, designTokens) {
    if (!designTokens) return null;
    const tokensToInsert = [];
    
    // Flatten all token types into a single array for insertion
    Object.entries(designTokens).forEach(([type, values]) => {
      if (type === 'cssVariables' && typeof values === 'object') {
        Object.entries(values).forEach(([key, value]) => {
          tokensToInsert.push({ site_id: siteId, token_key: key, token_type: 'css-variable', token_value: value, source: 'css' });
        });
      } else if (Array.isArray(values)) {
        values.forEach(value => {
          tokensToInsert.push({ site_id: siteId, token_key: `${type}.${value.replace(/[^a-zA-Z0-9]/g, '_')}`, token_type: type, token_value: value, source: 'computed' });
        });
      }
    });

    if (tokensToInsert.length === 0) return null;
    const { data, error } = await supabase.from('design_tokens').insert(tokensToInsert);
    if (error) throw error;
    return data;
  }

  async createBrandVoice(siteId, voiceData, embedding) {
    const { data, error } = await supabase.from('brand_voice').insert({ site_id: siteId, summary: voiceData.summary, guidelines: voiceData, embedding });
    if (error) throw error;
    return data;
  }

  async saveCrawlResults(crawlData) {
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
      status: 'processing', // Set initial status
    });
    const siteId = site.id;

    // Save all the incrementally analyzed data
    await this.createCompanyInfo(siteId, {
      company_name: crawlData.meta.title,
      contact_emails: crawlData.structuredData.emails,
      contact_phones: crawlData.structuredData.phones,
      structured_json: crawlData.structuredData,
      logo_url: crawlData.logoUrl,
    });

    await this.createProductsBulk(siteId, crawlData.structuredData.products);
    await this.createDesignTokensBulk(siteId, crawlData.designTokens);

    // Perform initial brand voice analysis and save
    if (crawlData.textContent && llm) {
      try {
        const voiceAnalysis = await llm.summarizeBrandVoice(crawlData.textContent);
        const embedding = await llm.generateEmbedding(JSON.stringify(voiceAnalysis));
        await this.createBrandVoice(siteId, voiceAnalysis, embedding);
      } catch (e) {
        console.warn("Could not generate initial brand voice:", e.message);
      }
    }

    return { siteId, name: crawlData.meta.title };
  }

  async getBrandKitBySiteId(siteId) {
    const { data, error } = await supabase.from('brand_kits').select('kit_data, pdf_url, sites(url, status)').eq('site_id', siteId).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    const brandKit = data.kit_data || {};
    return { ...brandKit, brandId: siteId, url: data.sites.url, pdfKitUrl: data.pdf_url, status: data.sites.status };
  }
}

export default new Store();