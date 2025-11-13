import config from './config.js';
import crawler from './crawler.js';
import llm from './llm.js';
import store from './store.js';
import supabase from './supabase-client.js';
import supabaseService from './supabase-service-client.js';
import generateBrandProfilePDF from './pdf-generator.js';

const isLlmConfigured = !!config.openai.apiKey;

async function processCrawl(url) {
    const crawlData = await crawler.crawlDeep(url, { takeScreenshot: true }) || {};
    crawlData.structuredData = crawlData.structuredData || {};
    crawlData.meta = crawlData.meta || {};
    crawlData.textContent = crawlData.textContent || "";
    crawlData.designTokens = crawlData.designTokens || {};

    let semanticBrandKit = null;
    if (isLlmConfigured) {
        try {
            semanticBrandKit = await llm.generateSemanticBrandKit(crawlData);
            if (!semanticBrandKit) {
                console.warn('Failed to generate brand kit from LLM. Proceeding to save raw data.');
            }
        } catch (error) {
            console.error('Error during LLM synthesis:', error.message);
            console.warn('Proceeding to save raw data without AI analysis.');
        }
    } else {
        console.warn('LLM not configured. Skipping AI synthesis and saving raw crawl data.');
    }

    const savedData = await store.saveCrawlResult(crawlData, semanticBrandKit);
    const brandId = savedData.siteId;

    let pdfUrl = null;
    if (supabaseService && semanticBrandKit) { // Only generate PDF if we have the semantic kit
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

export { processCrawl };