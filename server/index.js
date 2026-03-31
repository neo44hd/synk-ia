import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { emailRouter } from './routes/email.js';
import { biloopRouter } from './routes/biloop.js';
import { biloopPortalRouter } from './routes/biloop-portal.js';
import { revoRouter } from './routes/revo.js';
import { healthRouter } from './routes/health.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://sinkialabs.com', 'https://sinkialabs.com', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/email', emailRouter);
app.use('/api/biloop', biloopRouter);
app.use('/api/biloop', biloopPortalRouter);
app.use('/api/revo', revoRouter);
app.use('/api/health', healthRouter);

// Dynamic import for ollama route (won't crash server if missing)
try {
  const { ollamaRouter } = await import('./routes/ollama.js');
  app.use('/api/ollama', ollamaRouter);
  console.log('[SERVER] Ollama route registered');
} catch (e) {
  console.error('[SERVER] Ollama route failed to load:', e.message);
}

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  
  // Start sync worker dynamically (won't crash server if it fails)
  import('./syncWorker.js').then(({ startSyncWorker }) => {
    try {
      startSyncWorker();
      console.log('[SYNC-WORKER] Started successfully');
    } catch (error) {
      console.error('[SYNC-WORKER] Failed to start:', error.message);
    }
  }).catch(err => {
    console.error('[SYNC-WORKER] Failed to load module:', err.message);
  });
});
