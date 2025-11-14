# Modular Extraction System Guide

## Overview

The design token extractor has been refactored from a monolithic system to a modular, orchestrated pipeline that ensures consistent results through:

- **Incremental Processing**: Each step saves its progress independently
- **Retry Logic**: Failed steps are automatically retried with exponential backoff
- **State Management**: Full tracking of job and step status
- **Error Recovery**: Ability to resume from the last successful step
- **Better Observability**: Detailed logging and monitoring capabilities

## Architecture Changes

### Previous Architecture (Monolithic)
```
URL → Deep Crawl (all at once) → Save Everything → Edge Function (fire-and-forget) → Result
```

Problems:
- Single point of failure
- No progress tracking
- Can't resume failed extractions
- Inconsistent results

### New Architecture (Modular Pipeline)
```
URL → Pipeline Manager → Step 1 → Save → Step 2 → Save → ... → Step 9 → Complete
                          ↑                ↑
                      (retry)          (retry)
```

Benefits:
- Each step is independent and retryable
- Progress is saved incrementally
- Failed jobs can be resumed
- Consistent, predictable results

## Pipeline Steps

The extraction process is broken down into 9 discrete steps:

1. **URL Validation** - Validates URL format and robots.txt compliance
2. **Basic Crawl** - Fetches HTML and basic metadata
3. **Screenshot Capture** - Takes full-page screenshot
4. **CSS Extraction** - Extracts CSS variables and stylesheet rules
5. **Design Token Extraction** - Extracts colors, fonts, spacing, etc.
6. **Structured Data Extraction** - Extracts emails, phones, products
7. **LLM Enrichment** - Enhances tokens using AI (if configured)
8. **Brand Kit Generation** - Generates semantic brand kit
9. **PDF Generation** - Creates brand profile PDF

## Database Setup

### 1. Run the Migration

Apply the database migration to add the new tables and columns:

```bash
# Using Supabase CLI
supabase db push migrations/add_extraction_pipeline_tables.sql

# Or manually in Supabase SQL Editor
# Copy and paste the contents of migrations/add_extraction_pipeline_tables.sql
```

### 2. New Database Tables

- `extraction_jobs` - Tracks overall extraction progress
- `extraction_steps` - Tracks individual step progress
- `brand_profiles` - Stores final brand profile JSON
- `extraction_job_summary` - View for monitoring jobs

## API Endpoints

### Start New Extraction
```bash
POST /api/crawl
{
  "url": "https://example.com",
  "skipCache": false
}

Response:
{
  "jobId": "uuid",
  "brandId": "uuid",
  "url": "https://example.com",
  "status": "in_progress|completed|failed|partial",
  "completedSteps": 5,
  "totalSteps": 9,
  "generatedAt": "2024-01-01T00:00:00Z",
  "pdfKitUrl": "https://...",
  "message": "Extraction in progress..."
}
```

### Check Job Status
```bash
GET /api/job/{jobId}

Response:
{
  "jobId": "uuid",
  "status": "in_progress",
  "completedSteps": 5,
  "totalSteps": 9,
  "message": "Step 6 of 9: Extracting structured data..."
}
```

### Resume Failed Job
```bash
POST /api/job/{jobId}/resume

Response:
{
  "jobId": "uuid",
  "status": "completed",
  "completedSteps": 9,
  "totalSteps": 9,
  "message": "Extraction completed successfully"
}
```

## Configuration

### Retry Settings

In `extraction-pipeline.js`, you can configure:
- `max_retries`: Maximum retry attempts per step (default: 3)
- Exponential backoff: Starts at 1s, doubles each retry, max 30s

### Step Configuration

Each step can be individually configured in the `steps` array:
```javascript
{
  type: 'screenshot_capture',
  order: 3,
  handler: this.captureScreenshot.bind(this),
  maxRetries: 5  // Override default retry count
}
```

## Monitoring

### View Job Summary
```sql
-- In Supabase SQL Editor
SELECT * FROM extraction_job_summary
ORDER BY created_at DESC;
```

### Check Failed Steps
```sql
SELECT 
  j.url,
  s.step_type,
  s.error_message,
  s.retry_count
FROM extraction_steps s
JOIN extraction_jobs j ON j.id = s.job_id
WHERE s.status = 'failed'
ORDER BY s.created_at DESC;
```

### Average Processing Time by Step
```sql
SELECT 
  step_type,
  AVG(duration_ms) as avg_duration_ms,
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_runs
FROM extraction_steps
GROUP BY step_type
ORDER BY avg_duration_ms DESC;
```

## Error Handling

### Automatic Retries
- Each step automatically retries up to 3 times
- Exponential backoff between retries
- Detailed error logging for debugging

### Manual Recovery
If a job fails after all retries:
1. Check the error in `extraction_steps` table
2. Fix the underlying issue
3. Resume the job using `/api/job/{jobId}/resume`

### Partial Results
Jobs marked as "partial" have some completed steps:
- Partial data is still saved and accessible
- Can be resumed to complete remaining steps
- Useful for debugging and incremental improvements

## Benefits of the New System

1. **Consistency**: Each URL follows the same extraction pipeline
2. **Reliability**: Automatic retries handle transient failures
3. **Observability**: Full visibility into extraction progress
4. **Recoverability**: Resume from any point of failure
5. **Scalability**: Steps can be parallelized in future
6. **Maintainability**: Each step is isolated and testable

## Migration from Old System

The new system is backward compatible:
- Old API endpoints still work
- Results are returned in the same format
- Additional fields (jobId, completedSteps) are added

## Troubleshooting

### Job Stuck in "in_progress"
```sql
-- Find stuck jobs (older than 1 hour)
SELECT * FROM extraction_jobs
WHERE status = 'in_progress'
AND updated_at < NOW() - INTERVAL '1 hour';
```

### Reset Failed Step
```sql
-- Reset a specific step to retry
UPDATE extraction_steps
SET status = 'pending', retry_count = 0
WHERE job_id = 'job-uuid'
AND step_type = 'screenshot_capture';
```

### View Step Details
```sql
-- Get detailed info for a specific job
SELECT * FROM extraction_steps
WHERE job_id = 'job-uuid'
ORDER BY step_order;
```

## Future Enhancements

- **Parallel Processing**: Run independent steps in parallel
- **Webhooks**: Notify when extraction completes
- **Priority Queue**: Process urgent jobs first
- **Step Customization**: Configure steps per URL pattern
- **Caching**: Cache step results for faster re-runs
- **Analytics**: Track success rates and performance metrics

## Support

For issues or questions:
1. Check job status using the API
2. Review logs in extraction_steps table
3. Use the resume endpoint for failed jobs
4. Monitor the extraction_job_summary view