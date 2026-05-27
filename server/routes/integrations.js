/**
 * SYNK-IA — Integrations API Routes
 * ==================================
 * OAuth callbacks, configuration, and webhook handling for:
 * - Google Drive, Dropbox, Zapier, Slack
 */

import { Router } from 'express';
import { googleDriveService } from '../services/integrations/googleDrive.js';
import { dropboxService } from '../services/integrations/dropbox.js';
import { zapierService } from '../services/integrations/zapier.js';
import { slackService } from '../services/integrations/slack.js';

const router = Router();

// Initialize services
await Promise.all([
  googleDriveService.init(),
  dropboxService.init(),
  zapierService.init(),
  slackService.init(),
]);

// Helper: Extract user from JWT token
function extractUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = JSON.parse(Buffer.from(authHeader.slice(7).split('.')[1], 'base64url').toString());
    return payload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE DRIVE INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/integrations/google-drive/auth-url
router.get('/google-drive/auth-url', (req, res) => {
  const authUrl = googleDriveService.getAuthorizationUrl();
  if (!authUrl) {
    return res.status(400).json({ error: 'Google Drive OAuth not configured' });
  }
  res.json({ authUrl });
});

// GET /api/integrations/google-drive/callback
router.get('/google-drive/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.status(400).json({ error: `Authorization error: ${error}` });
  }

  try {
    const tokens = await googleDriveService.exchangeCodeForToken(code);
    const user = extractUser(req) || { id: 'anonymous' };
    const integration = await googleDriveService.createIntegration(user.id, tokens);

    res.json({ success: true, integration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/google-drive/list
router.get('/google-drive/list', async (req, res) => {
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const integrations = await googleDriveService.listIntegrations(user.id);
    res.json({ integrations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/google-drive/:id/files
router.get('/google-drive/:id/files', async (req, res) => {
  const { id } = req.params;
  const { folder } = req.query;

  try {
    const files = await googleDriveService.listFiles(id, folder);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/google-drive/:id/sync
router.post('/google-drive/:id/sync', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await googleDriveService.syncFiles(id, '/tmp/synkia-gd');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/google-drive/:id/test
router.post('/google-drive/:id/test', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await googleDriveService.testConnection(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/integrations/google-drive/:id
router.delete('/google-drive/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await googleDriveService.disconnectIntegration(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DROPBOX INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/integrations/dropbox/auth-url
router.get('/dropbox/auth-url', (req, res) => {
  const authUrl = dropboxService.getAuthorizationUrl();
  if (!authUrl) {
    return res.status(400).json({ error: 'Dropbox OAuth not configured' });
  }
  res.json({ authUrl });
});

// GET /api/integrations/dropbox/callback
router.get('/dropbox/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).json({ error: `Authorization error: ${error}` });
  }

  try {
    const tokens = await dropboxService.exchangeCodeForToken(code);
    const user = extractUser(req) || { id: 'anonymous' };
    const integration = await dropboxService.createIntegration(user.id, tokens);

    res.json({ success: true, integration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/dropbox/list
router.get('/dropbox/list', async (req, res) => {
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const integrations = await dropboxService.listIntegrations(user.id);
    res.json({ integrations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/dropbox/:id/files
router.get('/dropbox/:id/files', async (req, res) => {
  const { id } = req.params;
  const { path } = req.query;

  try {
    const files = await dropboxService.listFiles(id, path || '/');
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/dropbox/:id/sync
router.post('/dropbox/:id/sync', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await dropboxService.syncFiles(id, '/tmp/synkia-db');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/dropbox/:id/test
router.post('/dropbox/:id/test', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await dropboxService.testConnection(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/integrations/dropbox/:id
router.delete('/dropbox/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await dropboxService.disconnectIntegration(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ZAPIER INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/integrations/zapier/create
router.post('/zapier/create', async (req, res) => {
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { webhookUrl, triggers, autoRetry } = req.body;
  if (!webhookUrl) return res.status(400).json({ error: 'webhookUrl required' });

  try {
    const integration = await zapierService.createIntegration(user.id, webhookUrl, {
      triggers,
      autoRetry,
    });
    res.json({ success: true, integration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/zapier/list
router.get('/zapier/list', async (req, res) => {
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const integrations = await zapierService.listIntegrations(user.id);
    res.json({ integrations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/zapier/:id/webhook
router.post('/zapier/:id/webhook', async (req, res) => {
  const { id } = req.params;
  const { eventType, condition } = req.body;

  try {
    const webhook = await zapierService.registerWebhook(id, eventType, condition);
    res.json({ success: true, webhook });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/zapier/:id/test
router.post('/zapier/:id/test', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await zapierService.testWebhook(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/zapier/:id/trigger
router.post('/zapier/:id/trigger', async (req, res) => {
  const { id } = req.params;
  const { eventType, payload } = req.body;

  try {
    const result = await zapierService.triggerWebhook(id, eventType, payload);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/zapier/:id/webhooks
router.get('/zapier/:id/webhooks', async (req, res) => {
  const { id } = req.params;

  try {
    const webhooks = await zapierService.listWebhooks(id);
    res.json({ webhooks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/integrations/zapier/:id
router.delete('/zapier/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await zapierService.disconnectIntegration(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SLACK INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/integrations/slack/auth-url
router.get('/slack/auth-url', (req, res) => {
  const authUrl = slackService.getAuthorizationUrl();
  if (!authUrl) {
    return res.status(400).json({ error: 'Slack OAuth not configured' });
  }
  res.json({ authUrl });
});

// GET /api/integrations/slack/callback
router.get('/slack/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).json({ error: `Authorization error: ${error}` });
  }

  try {
    const tokenData = await slackService.exchangeCodeForToken(code);
    const user = extractUser(req) || { id: 'anonymous' };
    const integration = await slackService.createIntegration(user.id, tokenData);

    res.json({ success: true, integration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/slack/list
router.get('/slack/list', async (req, res) => {
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const integrations = await slackService.listIntegrations(user.id);
    res.json({ integrations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/slack/:id/channels
router.get('/slack/:id/channels', async (req, res) => {
  const { id } = req.params;

  try {
    const channels = await slackService.listChannels(id);
    res.json({ channels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/slack/:id/message
router.post('/slack/:id/message', async (req, res) => {
  const { id } = req.params;
  const { channel, text, blocks } = req.body;

  try {
    const result = await slackService.sendMessage(id, channel, text, blocks);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/slack/:id/notify-document
router.post('/slack/:id/notify-document', async (req, res) => {
  const { id } = req.params;
  const documentData = req.body;

  try {
    const result = await slackService.notifyDocumentProcessed(id, documentData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/slack/:id/test
router.post('/slack/:id/test', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await slackService.testConnection(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/slack/:id/update
router.post('/slack/:id/update', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const integration = await slackService.updateIntegration(id, updates);
    res.json({ success: true, integration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/integrations/slack/:id
router.delete('/slack/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await slackService.disconnectIntegration(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL INTEGRATIONS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/integrations/status
router.get('/status', (req, res) => {
  const status = {
    googleDrive: !!process.env.GOOGLE_DRIVE_CLIENT_ID,
    dropbox: !!process.env.DROPBOX_APP_KEY,
    zapier: true, // Always available (webhook-based)
    slack: !!process.env.SLACK_CLIENT_ID,
  };
  res.json(status);
});

export const integrationsRouter = router;
export default router;
