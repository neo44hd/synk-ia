# ⚠️ Server Restart Required

The FileBrain upload endpoint has been successfully added to `server/routes/filebrain.js`, but the running server instance still has the old code loaded in memory.

## Steps to Test FileBrain Upload

### 1. Stop the Running Server
If the server is running in another terminal, stop it:
```bash
# In the terminal running the server:
Ctrl+C
```

### 2. Restart the Server
```bash
npm start
```

Wait for the server to fully start. You should see:
```
[SERVER] ✓ Puerto 3001 | 2026-06-24T14:10:06.000Z
```

### 3. Run the Tests
In a **new terminal**:
```bash
npm run test:filebrain
```

## Expected Output
After restart, the tests should succeed:
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
  "id": "uuid...",
  "meta": {
    "type": "document",
    "confidence": 0.5,
    "fileName": "invoice-sample.txt",
    "uploadedAt": "...",
    "pages": 1,
    "language": "en",
    "summary": "..."
  },
  "filePath": "/Users/davidnows/sinkia-next/data/markdown/uuid....md"
}

...

📊 Test Summary
==============
Total tests: 3
Successful: 3
Failed: 0

✅ All tests passed!
```

## What Changed

### New Endpoint
- **POST /api/filebrain/upload**
  - Accepts multipart file uploads
  - Processes PDFs, text, JSON, and markdown files
  - Extracts metadata and generates UUID
  - Saves documents with YAML frontmatter to `data/markdown/`

### Files Modified
- `server/routes/filebrain.js` - Added upload endpoint with PDF parsing support
- `package.json` - Added `test:filebrain` npm script

### Files Created
- `test-filebrain.js` - Test suite for the upload endpoint
- `TEST-FILEBRAIN.md` - Detailed testing documentation
- `test-files/` - Directory for test files

## Verification

After tests pass, verify saved documents:
```bash
ls -la data/markdown/
# Should show markdown files with UUID names

# View a saved document:
cat data/markdown/[uuid].md
```

## Troubleshooting

If tests still fail after restart:

1. **Check server logs** for errors related to imports (`multer`, `fs-extra`, `pdf-parse`, `uuid`)
2. **Verify dependencies** are installed:
   ```bash
   npm ls multer fs-extra pdf-parse uuid
   ```
3. **Check port availability**:
   ```bash
   lsof -i :3001
   ```
   If port is in use, either kill the process or use a different port:
   ```bash
   PORT=3002 npm start
   API_URL=http://localhost:3002 npm run test:filebrain
   ```

## Next Steps

1. ✅ Restart server and run tests
2. Implement actual document classification in `AgentCore.classifyDocument()`
3. Enhance metadata extraction for different document types (invoices, contracts, etc.)
4. Add OCR for scanned PDFs using Tesseract.js
5. Integrate with vector database (Qdrant) for semantic search
6. Add frontend UI for document upload
