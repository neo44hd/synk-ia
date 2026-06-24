# FileBrain Upload Endpoint Test Guide

## Overview
This test suite verifies the `/api/filebrain/upload` endpoint that handles document ingestion with automatic classification and metadata extraction.

## Prerequisites
- Node.js server running (`npm start`)
- Test packages installed: `form-data`, `node-fetch`, `pdf-parse`, `tesseract.js`, etc.

## Quick Start

### 1. Start the Server
In one terminal, start the main server:
```bash
npm start
```

The server should be listening on `http://localhost:3001` (or the port specified by `PORT` env variable).

### 2. Run the Tests
In another terminal, run the test suite:
```bash
npm run test:filebrain
```

## What the Tests Do

### Test Files Created
The script automatically creates three dummy test files in `./test-files/`:

1. **invoice-sample.txt** - Text document (simulates invoice text)
2. **contract-data.json** - JSON document (structured contract data)
3. **document-sample.md** - Markdown document (sample contract with structured content)

### Upload Process
For each file, the test:
1. Reads the file from disk
2. Creates a FormData multipart request
3. Sends it to `/api/filebrain/upload`
4. Displays the response with:
   - Generated document ID (UUID)
   - Extracted metadata (type, confidence, filename, upload timestamp)
   - File path where the document was saved

### Expected Output
```
🔍 FileBrain Upload Endpoint Test Suite
=====================================
Target: http://localhost:3001/api/filebrain/upload

✅ Server is running

📝 Creating test files...
✅ Test files created in ./test-files/

📤 Testing upload: invoice-sample.txt
✅ Success!
Response: {
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "meta": {
    "type": "document",
    "confidence": 0.5,
    "fileName": "invoice-sample.txt",
    "uploadedAt": "2026-06-24T14:10:06.000Z",
    "pages": 1,
    "language": "en",
    "summary": "This is a test document..."
  },
  "filePath": "/Users/davidnows/sinkia-next/data/markdown/a1b2c3d4-e5f6-7890-abcd-ef1234567890.md"
}

📤 Testing upload: contract-data.json
✅ Success!
...

📊 Test Summary
==============
Total tests: 3
Successful: 3
Failed: 0

✅ All tests passed!
```

## Verifying Results

### Check Saved Files
After running tests, verify that documents were saved:
```bash
ls -la data/markdown/
# Should show markdown files with UUID names
```

### View Document Content
```bash
cat data/markdown/a1b2c3d4-e5f6-7890-abcd-ef1234567890.md
```

Each saved file includes YAML frontmatter with metadata:
```yaml
---
type: document
confidence: 0.5
fileName: invoice-sample.txt
uploadedAt: 2026-06-24T14:10:06.000Z
pages: 1
language: en
summary: This is a test document...
---

[Document content follows]
```

## Troubleshooting

### Server Not Running
```
❌ Server is not accessible:
   http://localhost:3001
   Error: ...
```
**Solution:** Start the server with `npm start` in another terminal.

### Port Already in Use
If port 3001 is busy, specify a different port:
```bash
PORT=3002 npm start
# Then in another terminal:
API_URL=http://localhost:3002 npm run test:filebrain
```

### File Not Found Error
If test files aren't created, ensure the `test-files/` directory exists:
```bash
mkdir -p test-files/
```

### Upload Fails with 500 Error
Check the server logs for errors:
- Verify MDRepository can write to `data/markdown/`
- Ensure `uuid`, `gray-matter`, `fs-extra` packages are installed
- Check that ES module imports are correct

## Test Customization

### Custom Server URL
```bash
API_URL=http://localhost:3002 npm run test:filebrain
```

### Manual File Upload
You can also test with curl:
```bash
curl -X POST http://localhost:3001/api/filebrain/upload \
  -F "file=@path/to/your/file.txt"
```

### Add More Test Files
Edit `test-filebrain.js` in the `createTestFiles()` function to add custom test documents.

## Endpoint Details

### POST /api/filebrain/upload
**Content-Type:** `multipart/form-data`

**Request:**
- Field name: `file` (required)
- Supported types: `.txt`, `.json`, `.md`, `.pdf`, `.png`, `.jpg`, `.tiff`, `.bmp`

**Response (200 OK):**
```json
{
  "id": "uuid-string",
  "meta": {
    "type": "document | invoice | contract | ...",
    "confidence": 0.0-1.0,
    "fileName": "original-filename.ext",
    "uploadedAt": "ISO8601-timestamp",
    ...other metadata fields...
  },
  "filePath": "/absolute/path/to/saved/document.md"
}
```

**Response (500 Error):**
```json
{
  "error": "Ingest failed"
}
```

## Next Steps

1. ✅ Test basic file uploads with `npm run test:filebrain`
2. Implement actual document classification in `AgentCore.classifyDocument()`
3. Enhance metadata extraction in `extractMetadata()` function
4. Add OCR for PDF scanning with Tesseract
5. Integrate with vector database (Qdrant) for semantic search

## Related Files
- Main route: `src/routes/filebrain.js`
- Ingest service: `src/services/markdown/ingest.js`
- Repository: `src/services/markdown/MDRepository.js`
- Server registration: `server/index.js` (line 115)
