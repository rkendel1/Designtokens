require('dotenv').config();
const Kernel = require('@onkernel/sdk');
const { processCrawl } = require('./core-logic');

const kernel = new Kernel();
const app = kernel.app('designtokens-crawler');

app.action('crawl', async (ctx, payload) => {
  const { url } = payload;

  if (!url) {
    throw new Error('URL is required in the payload.');
  }
  try {
    new URL(url);
  } catch (e) {
    throw new Error('Invalid URL format provided.');
  }

  console.log(`Starting crawl action for URL: ${url}`);
  
  try {
    const result = await processCrawl(url);
    console.log(`Crawl action finished successfully for URL: ${url}`);
    return result;
  } catch (error) {
    console.error(`Crawl action failed for URL: ${url}`, error);
    // Re-throw to ensure the invocation is marked as failed on Kernel
    throw error;
  }
});

console.log("OnKernel app 'designtokens-crawler' with action 'crawl' is defined.");