# Email → FileBrain Integration Guide

## Overview

Complete pipeline that automatically processes email attachments through FileBrain's OCR and AI classification system:

```
📧 Email (IMAP) → 💾 Download Attachment → 📤 Queue to FileBrain → 🤖 OCR/AI → 📊 Classify → 🔔 Webhook
```

## Architecture

### Components

1. **Email Attachment Worker** (`server/workers/emailAttachmentWorker.js`)
   - Downloads email attachments from Gmail IMAP
   - Rate-limiting to prevent server congestion
   - Batch processing (10 emails at a time)
   - File validation (type, size)

2. **FileBrain Integration Service** (`server/services/emailFileBrainIntegration.js`)
   - Enqueues attachments for FileBrain processing
   - Detects and prevents duplicate processing via SHA-256 hashing
   - Tracks processing state and statistics
   - Triggers webhooks on completion

3. **FileBrain Queue & Worker** (`server/queue/fileQueue.js`, `server/workers/fileProcessor.js`)
   - JSON-based job queue (no Redis needed)
   - Max 2 parallel document jobs
   - Auto-retry with backoff (3 attempts)
   - Outputs to `data/markdown/{documentId}.md`

4. **Integration API Routes** (`server/routes/emailFileBrainIntegration.js`)
   - Monitor pipeline statistics
   - Check pipeline health
   - Webhook notifications

## Quick Start

### 1. Start the FileBrain Worker

The FileBrain worker processes queued documents asynchronously:

```bash
npm run worker
```

This runs `server/workers/fileProcessor.js` and processes documents with:
- PDF/image OCR using LM Studio or Ollama
- AI classification via local LM model
- Markdown output with YAML frontmatter

### 2. Test Email Attachment Download

Quick test (last 7 days, batch size 5):

```bash
curl -X POST http://localhost:3001/api/email-attachments/sync/test
```

### 3. Monitor Integration Progress

Real-time pipeline statistics:

```bash
curl http://localhost:3001/api/integration/email-filebrain/stats
```

Example response:
```json
{
  "success": true,
  "data": {
    "stats": {
      "downloaded": 15,
      "queued": 3,
      "processing": 1,
      "completed": 11,
      "failed": 0
    },
    "recentProcessed": [
      {
        "filename": "invoice_20240115.pdf",
        "from": "vendor@company.com",
        "status": "completed",
        "enqueuedAt": "2024-01-15T10:30:00Z",
        "completedAt": "2024-01-15T10:35:15Z",
        "documentId": "abc123..."
      }
    ]
  }
}
```

### 4. Check Pipeline Health

Real-time health monitoring:

```bash
curl http://localhost:3001/api/integration/email-filebrain/health
```

Example response:
```json
{
  "success": true,
  "data": {
    "status": "active",
    "progress": {
      "total": 25,
      "queued": 2,
      "processing": 1,
      "completed": 22,
      "failed": 0,
      "successRate": 100
    },
    "bottlenecks": {
      "hasQueueBacklog": false,
      "hasFailures": false,
      "avgTimeToProcess": "45s"
    }
  }
}
```

## Full Email Sync (Production)

Download all attachments from the last 6 months:

```bash
curl -X POST http://localhost:3001/api/email-attachments/sync
```

Returns `202 Accepted` immediately. Use `/status` endpoint to monitor progress:

```bash
curl http://localhost:3001/api/email-attachments/status
```

### Expected Performance

- **Timeline**: 20-45 minutes for 6-month sync
- **Rate**: ~2-5 emails processed per second
- **Bottleneck**: FileBrain OCR processing (handles max 2 parallel jobs)

## API Endpoints

### Email Attachment Management

#### `POST /api/email-attachments/sync`
Full sync (last 6 months).
- Response: `202 Accepted`
- Monitor with: `GET /api/email-attachments/status`

#### `POST /api/email-attachments/sync/test`
Quick test (last 7 days, batch size 5).
- Response: Returns immediate results
- Useful for verifying setup before full sync

#### `GET /api/email-attachments/status`
Real-time sync progress (updated every 2 seconds).

#### `GET /api/email-attachments/list`
List all downloaded attachments (paginated).

### Integration Monitoring

#### `GET /api/integration/email-filebrain/stats`
Detailed processing statistics including:
- Total downloaded/queued/processing/completed/failed
- Recent 20 processed files
- Email sender distribution

#### `GET /api/integration/email-filebrain/health`
Pipeline health metrics:
- Overall status (idle/active)
- Progress ratios (completed/failed/queued)
- Success rate
- Bottleneck detection
- Average processing time

#### `POST /api/integration/email-filebrain/test`
Verify integration is operational.

## Configuration

### Environment Variables

```bash
# Email IMAP configuration (Gmail)
EMAIL_IMAP_USERNAME=user@gmail.com
EMAIL_IMAP_PASSWORD=your-app-password      # Use Gmail App Password, not your main password
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993

# FileBrain processing
FILEBRAIN_OCR_BACKEND=lmstudio              # Options: lmstudio, ollama
FILEBRAIN_AI_BACKEND=lmstudio               # Options: lmstudio, ollama

# Local AI services
LM_STUDIO_API_URL=http://localhost:4000     # LM Studio
OLLAMA_API_URL=http://localhost:11434       # Ollama (fallback)

# Webhook (optional - called when attachment is fully processed)
EMAIL_FILEBRAIN_WEBHOOK=https://your-webhook.com/attachment-processed
```

### Worker Configuration

Edit `server/workers/emailAttachmentWorker.js`:

```javascript
const BATCH_SIZE = 10;              // Emails per batch
const DELAY_BETWEEN_BATCHES = 2000; // ms
const DELAY_BETWEEN_EMAILS = 500;   // ms
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
```

Edit `server/workers/fileProcessor.js`:

```javascript
const MAX_PARALLEL_JOBS = 2;        // Concurrent FileBrain tasks
const JOB_TIMEOUT = 300000;         // 5 minutes max per job
const MAX_RETRIES = 3;              // Auto-retry failed jobs
```

## Data Flow & File Organization

### Storage Structure

```
data/
├── email-attachments/               # Downloaded files
│   ├── 1673635800000_invoice.pdf
│   ├── 1673635852000_receipt.png
│   └── ...
├── email-attachments-metadata.json  # Email download tracking
├── email-attachments-processing.json # Integration stats
├── raw/                             # FileBrain: raw uploaded files
│   └── {providerId}/
│       ├── {documentId}.pdf
│       └── ...
└── markdown/                        # FileBrain: processed output
    ├── {documentId}.md              # With YAML frontmatter
    └── ...
```

### File Naming

- **Email attachments**: `{timestamp}_{original_filename}`
  - Example: `1673635800000_invoice_2024.pdf`
  
- **FileBrain documents**: `{uuid}`
  - Raw: `data/raw/{providerId}/{documentId}.ext`
  - Processed: `data/markdown/{documentId}.md`

## Processing Pipeline

### 1. Email Download Phase

```
[EmailAttachmentWorker]
├─ Connect to Gmail IMAP
├─ Search emails (date range)
├─ Download attachments (batches of 10)
│  ├─ Validate file type
│  ├─ Check file size (< 50MB)
│  └─ Save to disk
└─ Update metadata
```

**Time**: 5-20 minutes (depends on attachment count)

### 2. FileBrain Processing Phase

```
[FileBrainIntegration]
├─ Compute SHA-256 hash
├─ Check for duplicates
├─ Extract email metadata (sender, subject, date)
└─ Enqueue in FileBrain queue

[FileProcessor Worker]
├─ Pull job from queue (max 2 parallel)
├─ OCR document (if PDF/image)
│  ├─ LM Studio: llava-1.6 or similar
│  └─ Fallback: Ollama
├─ AI classification
│  ├─ Extract: invoice number, date, amount
│  ├─ Classify: document type
│  └─ Generate: summary
└─ Write to data/markdown/{documentId}.md
```

**Time**: 10-20 seconds per document

### 3. Completion Phase

```
[Webhook Trigger]
├─ Event: 'attachment-processed'
├─ Payload: { documentId, filename, from, subject, metadata }
└─ POST to EMAIL_FILEBRAIN_WEBHOOK (if configured)
```

## Deduplication

Prevents processing the same file twice:

1. **Hash-based detection**: SHA-256 of file contents
2. **Timestamp tracking**: When file was first seen
3. **State tracking**: Processing status (queued/completed/failed)

If duplicate detected:
- File download is skipped
- Existing document ID is returned
- No re-processing in FileBrain

## Monitoring & Troubleshooting

### View Real-Time Processing

```bash
# Terminal 1: Start FileBrain worker
npm run worker

# Terminal 2: Monitor with curl loop
watch -n 2 'curl -s http://localhost:3001/api/integration/email-filebrain/stats | jq .'
```

### Common Issues

#### 1. **Gmail Connection Fails**
```
Error: Invalid login: disabled (imap.gmail.com 993)
```

**Solution**: Use Gmail App Password, not your main password:
1. Go to https://myaccount.google.com/apppasswords
2. Generate app password for Mail
3. Set `EMAIL_IMAP_PASSWORD` in `.env`

#### 2. **FileBrain Queue Grows But Nothing Processes**

**Check**:
```bash
# Is worker running?
ps aux | grep fileProcessor

# Start worker
npm run worker
```

#### 3. **Large Email Sync Takes Too Long**

**Optimize**:
```bash
# Reduce date range
curl -X POST http://localhost:3001/api/email-attachments/sync \
  -H "Content-Type: application/json" \
  -d '{"dateFrom": "2024-01-01", "dateTo": "2024-02-01"}'

# Or increase batch size in emailAttachmentWorker.js
const BATCH_SIZE = 25; // Default: 10
```

#### 4. **Out of Disk Space**

FileBrain stores both raw files and markdown output. Monitor:

```bash
du -sh data/
# Clean old files if needed
find data/email-attachments -mtime +90 -delete  # Files older than 90 days
```

## Integration Examples

### Python Client

```python
import requests
import time

# Monitor processing in real-time
stats_url = "http://localhost:3001/api/integration/email-filebrain/stats"

while True:
    resp = requests.get(stats_url).json()
    stats = resp['data']['stats']
    
    print(f"Downloaded: {stats['downloaded']}")
    print(f"Queued: {stats['queued']}")
    print(f"Processing: {stats['processing']}")
    print(f"Completed: {stats['completed']}")
    print(f"Failed: {stats['failed']}")
    
    time.sleep(2)
```

### Webhook Receiver (Express)

```javascript
app.post('/attachment-processed', (req, res) => {
  const { documentId, filename, from, subject, metadata } = req.body;
  
  console.log(`✅ Attachment processed: ${filename}`);
  console.log(`   From: ${from}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Document: ${documentId}`);
  console.log(`   Metadata:`, metadata);
  
  // Process metadata, update database, send notifications, etc.
  
  res.json({ success: true });
});
```

## Performance Tuning

### For Speed
```javascript
// Increase parallelism
const MAX_PARALLEL_JOBS = 4; // Up from 2

// Faster batch processing
const BATCH_SIZE = 25;           // Up from 10
const DELAY_BETWEEN_BATCHES = 500; // Down from 2000
const DELAY_BETWEEN_EMAILS = 100;  // Down from 500
```

### For Reliability
```javascript
// More conservative
const MAX_PARALLEL_JOBS = 1;     // Process one at a time
const MAX_RETRIES = 5;            // More retry attempts
const JOB_TIMEOUT = 600000;       // 10 minutes max
```

## Architecture Notes

### Why JSON Queue (not Redis)?

✅ No external dependency  
✅ Persistent (survives restarts)  
✅ Simple debugging  
✅ Sufficient for this scale  

❌ Not for massive scale (>100k jobs)

### Why Max 2 Parallel Jobs?

- **OCR is CPU/Memory intensive** (LM Studio uses ~2GB per job)
- **Prevents system overload**
- **Maintains responsiveness**
- **Can be tuned based on server hardware**

### Deduplication Strategy

Using SHA-256 hashing ensures:
- **Same file ≠ re-process** (even if from different email)
- **Fast detection** (O(1) lookup)
- **Storage efficient** (256-bit hash)

## Next Steps

1. ✅ Download attachments (email worker)
2. ✅ Queue for FileBrain (integration service)
3. ✅ Process with OCR/AI (FileBrain worker)
4. ✅ Track progress (monitoring API)
5. 🔄 **Custom processing hooks** (extract metadata, update CRM, etc.)
6. 🔄 **Bulk re-processing** (re-classify, update models)
7. 🔄 **Archive & cleanup** (manage disk space)

## Support

For issues or questions:
1. Check `/api/integration/email-filebrain/health` for bottlenecks
2. Review logs in terminal running `npm run worker`
3. Verify email credentials work with `POST /api/email-attachments/sync/test`
4. Check disk space: `du -sh data/`
