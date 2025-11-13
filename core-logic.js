const config = require('./config');
const crawler = require('./crawler');
const llm = require('./llm');
const store = require('./store');
const supabase = require('./supabase-client');
const supabaseService = require('./supabase-service-client');
const generateBrandProfilePDF = require('./pdf-generator');

const isLlmConfigured = config.openai.apiKey && config.openai.apiKey.startsWith('sk-');

async function processCrawl(url) {
    const crawlData = await crawler.crawlDeep(url, { takeScreenshot: true }) || {};
    crawlData.structuredData = crawlData.structuredData || {};
    crawlData.meta = crawlData.meta || {};
    crawlData.textContent = crawlData.textContent || "";
    crawlData.designTokens = crawlData.designTokens || {};

    if (!isLlmConfigured) {
        console.warn('LLM not configured. Skipping AI synthesis and returning raw crawl data.');
        return {
            site: { url: crawlData.url, domain: crawlData.domain, title: crawlData.meta.title, description: crawlData.meta.description },
            companyInfo: crawlData.structuredData,
            designTokens: crawlData.designTokens,
            message: 'LLM not configured. This is raw data without AI analysis.'
        };
    }

    const semanticBrandKit = await llm.generateSemanticBrandKit(crawlData);
    if (!semanticBrandKit) {
        throw new Error('Failed to generate brand kit from LLM.');
    }

    const savedData = await store.saveCrawlResult(crawlData, semanticBrandKit);
    const brandId = savedData.siteId;

    let pdfUrl = null;
    if (supabaseService) {
        try {
            const pdfBuffer = await generateBrandProfilePDF({ ...savedData, url, brandId });
            const pdfPath = `${brandId}.pdf`;
            const { error: uploadError } = await supabaseService.storage
                .from('brand-kits')
                .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('brand-kits').getPublicUrl(pdfPath);
            pdfUrl = urlData.publicUrl;
        } catch (error) {
            console.error('Supabase PDF upload error:', error);
        }
    }

    return {
        ...savedData,
        brandId: brandId,
        url: crawlData.url,
        generatedAt: new Date().toISOString(),
        pdfKitUrl: pdfUrl,
        status: "ready"
    };
}

module.exports = { processCrawl };