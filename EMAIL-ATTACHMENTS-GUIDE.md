# 📧 Email Attachments Batch Download Guide

## 🎯 What This Does

Downloads email attachments from Gmail **without congesting the IMAP connection**:
- ✅ Batch processing (10 emails at a time)
- ✅ Rate limiting (2 seconds between batches)
- ✅ Automatic retries (up to 3 attempts)
- ✅ File size limits (max 50MB)
- ✅ Type filtering (PDF, images, docs only)
- ✅ Metadata tracking
- ✅ Progress monitoring

**Storage:** `data/email-attachments/`  
**Metadata:** `data/email-attachments-metadata.json`

---

## 🚀 Quick Start

### 1. Test First (Last 7 days)

```bash
curl -X POST http://localhost:3001/api/email-attachments/sync/test
```

**Response:**
```json
{
  "success": true,
  "message": "Quick test iniciado (últimos 7 días)",
  "note": "Revisa /api/email-attachments/status para monitorear"
}
```

Check progress:
```bash
curl http://localhost:3001/api/email-attachments/status
```

---

### 2. Full Sync (Last 6 months)

Once testing works, run full sync:

```bash
curl -X POST http://localhost:3001/api/email-attachments/sync \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Parameters (optional):**
```json
{
  "dateFrom": "2026-01-01",
  "dateTo": "2026-06-27",
  "batchSize": 10,
  "folder": "INBOX"
}
```

---

### 3. Monitor Progress

```bash
# Check status
curl http://localhost:3001/api/email-attachments/status

# List downloaded files
curl http://localhost:3001/api/email-attachments/list?limit=20
```

---

## 📊 Response Examples

### Status Endpoint

```json
{
  "success": true,
  "stats": {
    "total": 145,
    "downloaded": 89,
    "failed": 3,
    "filesOnDisk": 156,
    "totalSize": "2.4GB",
    "storagePath": "/Users/davidnows/sinkia-next/data/email-attachments"
  }
}
```

### List Endpoint

```json
{
  "success": true,
  "files": [
    {
      "filename": "1719497400000_invoice_2024.pdf",
      "size": "245KB",
      "created": "2026-06-27T10:30:00.000Z",
      "path": "/Users/davidnows/sinkia-next/data/email-attachments/1719497400000_invoice_2024.pdf"
    },
    {
      "filename": "1719497200000_receipt.jpg",
      "size": "512KB",
      "created": "2026-06-27T10:25:00.000Z",
      "path": "/Users/davidnows/sinkia-next/data/email-attachments/1719497200000_receipt.jpg"
    }
  ],
  "pagination": {
    "total": 156,
    "offset": 0,
    "limit": 20,
    "pages": 8
  }
}
```

---

## ⚙️ Configuration

Edit `server/workers/emailAttachmentWorker.js` to adjust:

```javascript
const BATCH_SIZE = 10;              // Emails per batch
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches
const DELAY_BETWEEN_EMAILS = 500;   // 500ms between emails
const MAX_RETRIES = 3;              // Retry attempts
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
```

### Allowed File Types

```javascript
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'text/plain',
  'text/csv',
];
```

---

## 🔄 How It Works

1. **Connect to Gmail IMAP** via `EMAIL_IMAP_*` env vars
2. **Search for emails** between dateFrom and dateTo
3. **Process in batches** of 10 emails
4. **For each email:**
   - Identify attachments
   - Download each one
   - Validate type & size
   - Save to disk
   - Track metadata
5. **Wait 2s between batches** to avoid IMAP throttling
6. **Save metadata** to track progress
7. **Return results**

---

## 📋 API Endpoints

### POST `/api/email-attachments/sync` — Full Sync

Triggers background sync. Returns **202 Accepted** immediately.

**Body (optional):**
```json
{
  "dateFrom": "2026-01-01",    // ISO date
  "dateTo": "2026-06-27",      // ISO date
  "batchSize": 10,              // Emails per batch
  "folder": "INBOX"             // Gmail folder name
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sync iniciado en background",
  "config": { /* ... */ },
  "note": "Revisa /api/email-attachments/status para monitorear progreso"
}
```

---

### POST `/api/email-attachments/sync/test` — Quick Test

Syncs last 7 days only. Returns **202 Accepted**.

**Response:**
```json
{
  "success": true,
  "message": "Quick test iniciado (últimos 7 días)",
  "note": "Revisa /api/email-attachments/status para monitorear"
}
```

---

### GET `/api/email-attachments/status` — Monitor Progress

Real-time status of current and past syncs.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 145,
    "downloaded": 89,
    "failed": 3,
    "filesOnDisk": 156,
    "totalSize": "2.4GB",
    "storagePath": "/Users/davidnows/sinkia-next/data/email-attachments"
  }
}
```

---

### GET `/api/email-attachments/list` — List Files

Paginated list of downloaded attachments.

**Query params:**
- `limit` (default 50) — Files per page
- `offset` (default 0) — Pagination offset

**Response:**
```json
{
  "success": true,
  "files": [ /* ... */ ],
  "pagination": {
    "total": 156,
    "offset": 0,
    "limit": 20,
    "pages": 8
  }
}
```

---

## 💡 Best Practices

### 1. Test First
```bash
# Always start with quick test
curl -X POST http://localhost:3001/api/email-attachments/sync/test

# Wait for status endpoint to show results
sleep 30
curl http://localhost:3001/api/email-attachments/status
```

### 2. Monitor Progress
```bash
# Keep track of current status
watch -n 5 'curl -s http://localhost:3001/api/email-attachments/status | jq'
```

### 3. Use Custom Date Ranges
```bash
# Sync January only
curl -X POST http://localhost:3001/api/email-attachments/sync \
  -H "Content-Type: application/json" \
  -d '{
    "dateFrom": "2026-01-01",
    "dateTo": "2026-01-31",
    "batchSize": 10
  }'
```

### 4. Reduce Batch Size if Problematic
```bash
# If Gmail throttles, reduce batch size
curl -X POST http://localhost:3001/api/email-attachments/sync \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 5
  }'
```

---

## 🐛 Troubleshooting

### "No token in response" or IMAP Auth Error

**Problem:** Gmail credentials wrong or 2FA needed

**Solution:**
- Verify `.env` has correct `EMAIL_APP_PASSWORD` (16-char, not account password)
- Ensure 2FA enabled on Gmail account
- Test with `/api/email/test` first

### "File too large" Errors

**Problem:** Attachment >50MB

**Solution:** Increase `MAX_FILE_SIZE` in `emailAttachmentWorker.js`

### Sync Hangs or Stalls

**Problem:** IMAP connection timeout

**Solution:**
- Reduce `batchSize` to 5
- Increase `DELAY_BETWEEN_BATCHES` to 3000ms
- Check Gmail hasn't suspended account

### "Skipping unsupported type" Warnings

**Problem:** Attachment type (e.g., .exe, .zip) filtered out

**Solution:** Add to `ALLOWED_TYPES` if needed

---

## 📊 Expected Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Test (7 days) | 1-3 min | Depends on email count |
| Full sync (6 months) | 20-45 min | ~200-500 emails |
| Batch of 10 | 15-30s | IMAP fetch + save |
| Status check | <100ms | Just reads JSON |

---

## 🎯 Recommended Workflow

### Week 1: Test Everything
```bash
# 1. Test connectivity
curl http://localhost:3001/api/email/test

# 2. Quick test (7 days)
curl -X POST http://localhost:3001/api/email-attachments/sync/test

# 3. Monitor progress
curl http://localhost:3001/api/email-attachments/status

# 4. List downloaded files
curl http://localhost:3001/api/email-attachments/list
```

### Week 2: Incremental Sync
```bash
# 1. Sync January
curl -X POST http://localhost:3001/api/email-attachments/sync \
  -H "Content-Type: application/json" \
  -d '{
    "dateFrom": "2026-01-01",
    "dateTo": "2026-01-31"
  }'

# 2. Monitor progress
sleep 30
curl http://localhost:3001/api/email-attachments/status

# 3. Repeat for February, March, etc.
```

### Week 3+: Full Sync
```bash
# Once confident, do full 6-month sync
curl -X POST http://localhost:3001/api/email-attachments/sync \
  -H "Content-Type: application/json" \
  -d '{
    "dateFrom": "2026-01-01"
  }'

# Monitor until complete
watch -n 10 'curl -s http://localhost:3001/api/email-attachments/status'
```

---

## 📂 File Organization

**Downloaded files stored in:**
```
data/email-attachments/
├── 1719497400000_invoice_2024.pdf
├── 1719497200000_receipt.jpg
├── 1719497100000_contract.docx
└── ...
```

**Metadata file:**
```
data/email-attachments-metadata.json
{
  "processed": { /* email processing history */ },
  "stats": {
    "total": 156,        // Total attachments
    "downloaded": 156,   // Successfully downloaded
    "failed": 0          // Failed downloads
  }
}
```

---

## ✨ Features

- ✅ **Batch processing** — No IMAP throttling
- ✅ **Rate limiting** — Respects Gmail's limits
- ✅ **Auto-retry** — Recovers from transient errors
- ✅ **File validation** — Size & type checks
- ✅ **Metadata tracking** — Know what was processed
- ✅ **Progress monitoring** — Real-time status
- ✅ **Async processing** — Returns 202, processes background
- ✅ **Error handling** — Logs all failures

---

**Ready to download your emails!** Start with the quick test above.

