import config from './config.js';
import crawler from './crawler.js';
import store from './store.js';
import supabase from './supabase-client.js';

async function processCrawl(url) {
    // 1. Perform the crawl to get raw data
    const crawlData = await crawler.crawlDeep(url, { takeScreenshot: true }) || {};

    // 2. Save the raw data to the database
    const savedData = await store.saveRawCrawlData(crawlData);
    const siteId = savedData.siteId;

    // 3. Asynchronously invoke the Edge Function to process the brand kit
    // We don't wait for the result, allowing for a fast response.
    supabase.functions.invoke('process-brand-kit', {
        body: { siteId },
    });

    // 4. Return an immediate response indicating the process has started
    return {
        brandId: siteId,
        url: crawlData.url,
        generatedAt: new Date().toISOString(),
        pdfKitUrl: null, // This will be generated in the background
        status: "processing" // New status
    };
}

export { processCrawl };