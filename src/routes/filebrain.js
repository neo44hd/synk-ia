import express from 'express';
import multer from 'multer';
import { ingest } from '../services/markdown/ingest.js';

const router = express.Router();
const upload = multer();

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const result = await ingest(req.file);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ingest failed' });
  }
});

export { router as filebrainRouter };
