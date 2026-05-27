/**
 * MarkItDown Route — Convierte archivos a Markdown
 * POST /api/markitdown/convert — convierte un archivo a markdown
 */

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const markitdownRouter = express.Router();

/**
 * POST /api/markitdown/convert
 * Body: { file_path: string }
 * Response: { success, markdown, title, error }
 */
markitdownRouter.post('/convert', async (req, res) => {
  try {
    const { file_path } = req.body;
    
    if (!file_path) {
      return res.status(400).json({ success: false, error: 'file_path requerido' });
    }

    const scriptPath = path.join(__dirname, '..', 'scripts', 'convert-to-markdown.py');
    const { stdout, stderr } = await execAsync(`python3.14 "${scriptPath}" "${file_path}"`);
    
    if (stderr) {
      console.error('[MarkItDown] Error:', stderr);
      return res.status(500).json({ success: false, error: stderr });
    }

    const result = JSON.parse(stdout);
    res.json(result);
  } catch (err) {
    console.error('[MarkItDown] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/markitdown/batch
 * Body: { file_paths: string[] }
 * Response: { success, results: { path, markdown, title, error }[] }
 */
markitdownRouter.post('/batch', async (req, res) => {
  try {
    const { file_paths } = req.body;
    
    if (!Array.isArray(file_paths) || file_paths.length === 0) {
      return res.status(400).json({ success: false, error: 'file_paths array requerido' });
    }

    const results = [];
    const scriptPath = path.join(__dirname, '..', 'scripts', 'convert-to-markdown.py');
    
    for (const filePath of file_paths) {
      try {
        const { stdout } = await execAsync(`python3.14 "${scriptPath}" "${filePath}"`);
        const result = JSON.parse(stdout);
        results.push({
          file: filePath,
          ...result
        });
      } catch (err) {
        results.push({
          file: filePath,
          success: false,
          error: err.message
        });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('[MarkItDown] Batch Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/markitdown/health
 */
markitdownRouter.get('/health', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'convert-to-markdown.py');
    const testFile = '/tmp/health-check.txt';
    await execAsync(`echo 'health check' > "${testFile}"`);
    const { stdout } = await execAsync(`python3.14 "${scriptPath}" "${testFile}"`);
    const result = JSON.parse(stdout);
    
    if (result.success) {
      res.json({ success: true, status: 'MarkItDown ready', markdown_length: result.markdown.length });
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    res.status(503).json({ success: false, status: 'MarkItDown unavailable', error: err.message });
  }
});

export default markitdownRouter;
