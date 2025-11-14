import config from './config.js';
import extractionPipeline from './extraction-pipeline.js';
import supabase from './supabase-client.js';

/**
 * Process a crawl request using the modular extraction pipeline
 * 
 * This function now uses the extraction pipeline manager to orchestrate
 * the extraction process through discrete, retryable steps with incremental
 * saving and proper error recovery.
 * 
 * @param {string} url - The URL to crawl and extract design tokens from
 * @returns {Promise<Object>} The extraction result with job status and data
 */
async function processCrawl(url) {
    console.log(`[Core Logic] Starting extraction pipeline for URL: ${url}`);
    
    try {
        // Use the extraction pipeline for modular, incremental processing
        const result = await extractionPipeline.startExtraction(url);
        
        console.log(`[Core Logic] Extraction pipeline completed with status: ${result.status}`);
        
        // Return the result in the expected format
        return {
            jobId: result.jobId,
            brandId: result.brandId,
            url: result.url,
            status: result.status,
            completedSteps: result.completedSteps,
            totalSteps: result.totalSteps,
            generatedAt: result.generatedAt,
            completedAt: result.completedAt,
            pdfKitUrl: result.pdfKitUrl,
            brandProfile: result.brandProfile,
            message: result.message
        };
        
    } catch (error) {
        console.error(`[Core Logic] Extraction pipeline failed for ${url}:`, error);
        
        // Return error response
        return {
            brandId: null,
            url: url,
            status: 'failed',
            generatedAt: new Date().toISOString(),
            pdfKitUrl: null,
            error: error.message,
            message: `Extraction failed: ${error.message}`
        };
    }
}

/**
 * Get the status of an extraction job
 * 
 * @param {string} jobId - The extraction job ID
 * @returns {Promise<Object>} The job status and details
 */
async function getExtractionStatus(jobId) {
    try {
        const result = await extractionPipeline.getJobResult(jobId);
        return result;
    } catch (error) {
        console.error(`[Core Logic] Failed to get job status for ${jobId}:`, error);
        throw error;
    }
}

/**
 * Resume a partially completed extraction job
 * 
 * @param {string} jobId - The extraction job ID to resume
 * @returns {Promise<Object>} The extraction result
 */
async function resumeExtraction(jobId) {
    try {
        const { data: job, error } = await supabase
            .from('extraction_jobs')
            .select('*')
            .eq('id', jobId)
            .single();
        
        if (error) throw error;
        if (!job) throw new Error(`Job ${jobId} not found`);
        
        const result = await extractionPipeline.resumeJob(job);
        return result;
    } catch (error) {
        console.error(`[Core Logic] Failed to resume job ${jobId}:`, error);
        throw error;
    }
}

export { processCrawl, getExtractionStatus, resumeExtraction };