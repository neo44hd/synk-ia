# Persistent Job Queue System

## Overview

The persistent job queue ensures that long-running operations (reprocessing, syncing) survive server restarts and crashes. When a job is enqueued, it's immediately written to disk and will resume from the queue on the next server start.

## Architecture

### Components

1. **persistentJobQueue.js** - Core queue service
   - Enqueues jobs to disk
   - Manages job lifecycle (pending → running → completed/failed)
   - Periodically processes queue (every 5 seconds)
   - Auto-resumes interrupted jobs on startup

2. **control.js API routes**
   - `/api/control/status` - System and queue status
   - `/api/control/queue` - Detailed queue/job history
   - `/api/control/sync-emails` - Enqueue email sync job
   - `/api/control/reprocess-all` - Enqueue full reprocessing
   - `/api/control/reprocess-failed` - Enqueue reprocessing of failed docs
   - `/api/control/rebuild` - Enqueue full rebuild
   - `/api/control/verify` - Enqueue integrity check

3. **Control Center UI** - Real-time dashboard
   - Shows current job + progress
   - Lists pending jobs in queue
   - Shows job history
   - Provides action buttons to enqueue new jobs

## How It Works

### Job Lifecycle

```
[API endpoint called]
         ↓
   [Job enqueued → persisted to job_queue.json]
         ↓
   [Server loads queue.json on startup]
         ↓
   [Queue processor checks every 5 sec]
         ↓
   [Job marked "running", script executed]
         ↓
   [Progress tracked as process outputs]
         ↓
   [Script completes/fails]
         ↓
   [Job marked "completed" or "failed"]
         ↓
   [Moved to history in queue.json]
```

### Server Restart Scenario

1. **During job execution**: Server receives SIGTERM/SIGINT
2. **Job is interrupted**: Process dies, but job state is "running" in job_queue.json
3. **Server restarts**: Loads job_queue.json on startup
4. **Queue processor starts**: Finds "running" job
5. **Job resumes**: Script restarts from beginning (note: limited resumption; scripts should be idempotent)
6. **Progress continues**: Frontend polls `/api/control/status` and sees job running

## Persistence

### Files

- **data/job_queue.json** - Persistent queue storage
  ```json
  {
    "jobs": [ /* pending and running jobs */ ],
    "history": [ /* completed/failed jobs (last 100) */ ]
  }
  ```

### Data Saved

- Job ID, type, status
- Creation/start/completion timestamps
- Progress (e.g., "42/182")
- Configuration options
- Error messages

## API Reference

### POST /api/control/sync-emails

Enqueue email synchronization job.

**Response:**
```json
{
  "success": true,
  "message": "Email sync job enqueued",
  "jobId": "sync-emails-1234567890"
}
```

### POST /api/control/reprocess-all

Enqueue full document reprocessing.

**Response:**
```json
{
  "success": true,
  "message": "Reprocess all job enqueued",
  "jobId": "reprocess-all-1234567890"
}
```

### POST /api/control/reprocess-failed

Enqueue reprocessing of failed documents only.

**Response:**
```json
{
  "success": true,
  "message": "Reprocess failed job enqueued",
  "jobId": "reprocess-failed-1234567890"
}
```

### POST /api/control/rebuild

Enqueue full rebuild (destructive: backs up data, resets stores, reprocesses from scratch).

**Request:**
```json
{
  "confirm": "RECONSTRUIR"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rebuild job enqueued. Data will be backed up automatically.",
  "jobId": "rebuild-1234567890"
}
```

### GET /api/control/status

Get current system status including queue state.

**Response:**
```json
{
  "success": true,
  "busy": true,
  "currentJob": {
    "id": "reprocess-all-1234567890",
    "type": "reprocess-all",
    "status": "running",
    "progress": "42/182",
    "startedAt": "2026-06-30T02:30:00Z"
  },
  "queue": {
    "pending": 2,
    "completed": 5
  },
  "data": {
    "documents": 42,
    "processed": 40,
    "failed": 2,
    "invoices": 15,
    "providers": 8,
    "emails": 120,
    "uploads": 182
  }
}
```

### GET /api/control/queue

Get full queue status with history.

**Response:**
```json
{
  "success": true,
  "currentJob": { /* current running job or null */ },
  "pending": 2,
  "completed": 5,
  "jobs": [ /* list of pending jobs */ ],
  "history": [ /* list of last 10 completed/failed jobs */ ]
}
```

## Monitoring & Debugging

### View Queue Status

```bash
cat data/job_queue.json | jq .
```

### View Job Logs

Each job script outputs to stdout/stderr, captured by the queue processor.

### Test Queue System

```bash
node scripts/test-queue.mjs
```

## Limitations & Notes

1. **Script Idempotency**: Scripts should be idempotent (safe to restart). If a script crashes mid-execution, restarting it may process some items twice.

2. **Progress Tracking**: Scripts must output progress in format `N/Total` for the queue to parse it. Example: `Processing 42/182 documents`.

3. **Timeout**: Jobs have a 2-hour timeout. If a job runs longer, it will be killed.

4. **No Inter-job Dependencies**: Jobs process sequentially in FIFO order. There's no dependency system.

5. **One Job at a Time**: Only one job runs at a time. Additional jobs wait in queue.

## Future Improvements

- Checkpointing within scripts (e.g., save offset after each file processed)
- Job retry policies (exponential backoff)
- Parallel job processing (multiple workers)
- Job cancellation endpoint
- Webhook notifications on job completion
- Scheduled jobs
