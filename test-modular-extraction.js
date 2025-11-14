#!/usr/bin/env node

/**
 * Test script for the modular extraction pipeline
 * 
 * This script tests the new modular extraction system by:
 * 1. Starting a new extraction
 * 2. Monitoring its progress
 * 3. Handling partial failures
 * 4. Testing resume functionality
 */

import 'dotenv/config';
import { processCrawl, getExtractionStatus, resumeExtraction } from './core-logic.js';
import supabase from './supabase-client.js';

// Test configuration
const TEST_URLS = [
  'https://example.com',
  'https://www.google.com',
  'https://github.com'
];

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test basic extraction flow
 */
async function testBasicExtraction(url) {
  logSection(`Testing Basic Extraction: ${url}`);
  
  try {
    // Start extraction
    log('Starting extraction...', 'cyan');
    const result = await processCrawl(url);
    
    log(`Job ID: ${result.jobId}`, 'magenta');
    log(`Initial Status: ${result.status}`, 'yellow');
    
    // Monitor progress
    if (result.status === 'in_progress' || result.status === 'processing') {
      log('\nMonitoring progress...', 'cyan');
      
      let status = result.status;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max wait
      
      while ((status === 'in_progress' || status === 'processing') && attempts < maxAttempts) {
        await sleep(5000); // Check every 5 seconds
        
        const jobStatus = await getExtractionStatus(result.jobId);
        status = jobStatus.status;
        
        log(`Progress: ${jobStatus.completedSteps}/${jobStatus.totalSteps} - Status: ${status}`, 'yellow');
        attempts++;
      }
      
      if (status === 'completed') {
        log('\n✓ Extraction completed successfully!', 'green');
        const finalResult = await getExtractionStatus(result.jobId);
        log(`PDF URL: ${finalResult.pdfKitUrl || 'Not generated'}`, 'cyan');
      } else if (status === 'partial') {
        log('\n⚠ Extraction partially completed', 'yellow');
        return result.jobId; // Return for resume testing
      } else if (status === 'failed') {
        log('\n✗ Extraction failed', 'red');
        const finalResult = await getExtractionStatus(result.jobId);
        log(`Error: ${finalResult.message}`, 'red');
      }
    } else if (result.status === 'completed') {
      log('\n✓ Extraction completed immediately!', 'green');
      log(`PDF URL: ${result.pdfKitUrl || 'Not generated'}`, 'cyan');
    }
    
    return null;
    
  } catch (error) {
    log(`\n✗ Test failed: ${error.message}`, 'red');
    console.error(error);
    return null;
  }
}

/**
 * Test resume functionality
 */
async function testResumeExtraction(jobId) {
  logSection(`Testing Resume Functionality: ${jobId}`);
  
  try {
    log('Attempting to resume job...', 'cyan');
    const result = await resumeExtraction(jobId);
    
    log(`Resume Status: ${result.status}`, 'yellow');
    log(`Completed Steps: ${result.completedSteps}/${result.totalSteps}`, 'magenta');
    
    if (result.status === 'completed') {
      log('\n✓ Job resumed and completed successfully!', 'green');
    } else if (result.status === 'partial') {
      log('\n⚠ Job resumed but still partial', 'yellow');
    } else {
      log('\n✗ Job resume failed', 'red');
    }
    
  } catch (error) {
    log(`\n✗ Resume test failed: ${error.message}`, 'red');
    console.error(error);
  }
}

/**
 * Test step failure and retry
 */
async function testStepFailure() {
  logSection('Testing Step Failure and Retry');
  
  try {
    // Query for any failed steps
    const { data: failedSteps, error } = await supabase
      .from('extraction_steps')
      .select('*, extraction_jobs!inner(url)')
      .eq('status', 'failed')
      .limit(5);
    
    if (error) throw error;
    
    if (failedSteps && failedSteps.length > 0) {
      log(`Found ${failedSteps.length} failed steps:`, 'yellow');
      
      failedSteps.forEach(step => {
        log(`  - ${step.step_type} for ${step.extraction_jobs.url}`, 'red');
        log(`    Error: ${step.error_message}`, 'red');
        log(`    Retries: ${step.retry_count}`, 'magenta');
      });
    } else {
      log('No failed steps found', 'green');
    }
    
  } catch (error) {
    log(`\n✗ Failed step test error: ${error.message}`, 'red');
  }
}

/**
 * Test job monitoring
 */
async function testJobMonitoring() {
  logSection('Testing Job Monitoring');
  
  try {
    // Query the job summary view
    const { data: jobs, error } = await supabase
      .from('extraction_job_summary')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    if (jobs && jobs.length > 0) {
      log(`Recent jobs (${jobs.length}):`, 'cyan');
      
      jobs.forEach(job => {
        const statusColor = job.status === 'completed' ? 'green' : 
                          job.status === 'failed' ? 'red' : 'yellow';
        
        log(`\n  URL: ${job.url}`, 'bright');
        log(`  Status: ${job.status}`, statusColor);
        log(`  Progress: ${job.progress}`, 'magenta');
        log(`  Duration: ${job.duration_seconds || 'In progress'}s`, 'cyan');
      });
    } else {
      log('No jobs found', 'yellow');
    }
    
  } catch (error) {
    log(`\n✗ Job monitoring test error: ${error.message}`, 'red');
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n🚀 Starting Modular Extraction System Tests', 'bright');
  
  // Test 1: Basic extraction
  const testUrl = TEST_URLS[0];
  const partialJobId = await testBasicExtraction(testUrl);
  
  // Test 2: Resume if partial
  if (partialJobId) {
    await sleep(2000);
    await testResumeExtraction(partialJobId);
  }
  
  // Test 3: Check for failed steps
  await sleep(2000);
  await testStepFailure();
  
  // Test 4: Monitor jobs
  await sleep(2000);
  await testJobMonitoring();
  
  logSection('Tests Complete');
  log('✓ All tests finished', 'green');
  
  // Cleanup
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`\n✗ Unhandled error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

// Run tests
runTests().catch(error => {
  log(`\n✗ Test runner failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});