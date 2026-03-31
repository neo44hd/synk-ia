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

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SYNK-IA Backend running on port ${PORT}`);
  console.log(`Email: ${process.env.EMAIL_USER || 'not configured'}`);
  console.log(`Biloop: ${process.env.ASSEMPSA_BILOOP_API_KEY ? 'configured' : 'not configured'}`);
  console.log(`Biloop Portal: scraper enabled`);
});
