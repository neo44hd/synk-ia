/**
 * SYNK-IA — Integration Service
 * =============================
 * Frontend service for managing integrations:
 * Google Drive, Dropbox, Zapier, Slack
 */

const API_BASE = '';

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE DRIVE
// ─────────────────────────────────────────────────────────────────────────────

export const googleDrive = {
  /**
   * Get OAuth authorization URL
   */
  async getAuthUrl() {
    const res = await fetch(`${API_BASE}/api/integrations/google-drive/auth-url`);
    if (!res.ok) throw new Error(`Failed to get auth URL: ${res.status}`);
    return res.json();
  },

  /**
   * List user's Google Drive integrations
   */
  async list() {
    const res = await fetch(`${API_BASE}/api/integrations/google-drive/list`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`Failed to list integrations: ${res.status}`);
    return res.json();
  },

  /**
   * Get files from a Google Drive integration
   */
  async getFiles(integrationId, folderId = 'root') {
    const res = await fetch(
      `${API_BASE}/api/integrations/google-drive/${integrationId}/files?folder=${encodeURIComponent(folderId)}`
    );
    if (!res.ok) throw new Error(`Failed to get files: ${res.status}`);
    return res.json();
  },

  /**
   * Sync files from Google Drive
   */
  async sync(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/google-drive/${integrationId}/sync`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    return res.json();
  },

  /**
   * Test connection
   */
  async test(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/google-drive/${integrationId}/test`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Test failed: ${res.status}`);
    return res.json();
  },

  /**
   * Disconnect integration
   */
  async disconnect(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/google-drive/${integrationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Disconnect failed: ${res.status}`);
    return res.json();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DROPBOX
// ─────────────────────────────────────────────────────────────────────────────

export const dropbox = {
  /**
   * Get OAuth authorization URL
   */
  async getAuthUrl() {
    const res = await fetch(`${API_BASE}/api/integrations/dropbox/auth-url`);
    if (!res.ok) throw new Error(`Failed to get auth URL: ${res.status}`);
    return res.json();
  },

  /**
   * List user's Dropbox integrations
   */
  async list() {
    const res = await fetch(`${API_BASE}/api/integrations/dropbox/list`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`Failed to list integrations: ${res.status}`);
    return res.json();
  },

  /**
   * Get files from Dropbox path
   */
  async getFiles(integrationId, path = '/') {
    const res = await fetch(
      `${API_BASE}/api/integrations/dropbox/${integrationId}/files?path=${encodeURIComponent(path)}`
    );
    if (!res.ok) throw new Error(`Failed to get files: ${res.status}`);
    return res.json();
  },

  /**
   * Sync files from Dropbox
   */
  async sync(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/dropbox/${integrationId}/sync`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    return res.json();
  },

  /**
   * Test connection
   */
  async test(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/dropbox/${integrationId}/test`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Test failed: ${res.status}`);
    return res.json();
  },

  /**
   * Disconnect integration
   */
  async disconnect(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/dropbox/${integrationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Disconnect failed: ${res.status}`);
    return res.json();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ZAPIER
// ─────────────────────────────────────────────────────────────────────────────

export const zapier = {
  /**
   * Create a new Zapier integration
   */
  async create(webhookUrl, triggers = [], autoRetry = true) {
    const res = await fetch(`${API_BASE}/api/integrations/zapier/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ webhookUrl, triggers, autoRetry }),
    });
    if (!res.ok) throw new Error(`Failed to create integration: ${res.status}`);
    return res.json();
  },

  /**
   * List user's Zapier integrations
   */
  async list() {
    const res = await fetch(`${API_BASE}/api/integrations/zapier/list`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`Failed to list integrations: ${res.status}`);
    return res.json();
  },

  /**
   * Register a webhook trigger
   */
  async registerWebhook(integrationId, eventType, condition = null) {
    const res = await fetch(`${API_BASE}/api/integrations/zapier/${integrationId}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, condition }),
    });
    if (!res.ok) throw new Error(`Failed to register webhook: ${res.status}`);
    return res.json();
  },

  /**
   * Trigger a webhook manually
   */
  async trigger(integrationId, eventType, payload) {
    const res = await fetch(`${API_BASE}/api/integrations/zapier/${integrationId}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, payload }),
    });
    if (!res.ok) throw new Error(`Failed to trigger webhook: ${res.status}`);
    return res.json();
  },

  /**
   * List webhooks for integration
   */
  async listWebhooks(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/zapier/${integrationId}/webhooks`);
    if (!res.ok) throw new Error(`Failed to list webhooks: ${res.status}`);
    return res.json();
  },

  /**
   * Test webhook connectivity
   */
  async test(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/zapier/${integrationId}/test`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Test failed: ${res.status}`);
    return res.json();
  },

  /**
   * Disconnect integration
   */
  async disconnect(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/zapier/${integrationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Disconnect failed: ${res.status}`);
    return res.json();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SLACK
// ─────────────────────────────────────────────────────────────────────────────

export const slack = {
  /**
   * Get OAuth authorization URL
   */
  async getAuthUrl() {
    const res = await fetch(`${API_BASE}/api/integrations/slack/auth-url`);
    if (!res.ok) throw new Error(`Failed to get auth URL: ${res.status}`);
    return res.json();
  },

  /**
   * List user's Slack integrations
   */
  async list() {
    const res = await fetch(`${API_BASE}/api/integrations/slack/list`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`Failed to list integrations: ${res.status}`);
    return res.json();
  },

  /**
   * Get list of channels
   */
  async getChannels(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/slack/${integrationId}/channels`);
    if (!res.ok) throw new Error(`Failed to get channels: ${res.status}`);
    return res.json();
  },

  /**
   * Send message to channel
   */
  async sendMessage(integrationId, channel, text, blocks = null) {
    const res = await fetch(`${API_BASE}/api/integrations/slack/${integrationId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, text, blocks }),
    });
    if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
    return res.json();
  },

  /**
   * Send document processed notification
   */
  async notifyDocument(integrationId, documentData) {
    const res = await fetch(
      `${API_BASE}/api/integrations/slack/${integrationId}/notify-document`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData),
      }
    );
    if (!res.ok) throw new Error(`Failed to send notification: ${res.status}`);
    return res.json();
  },

  /**
   * Update integration settings
   */
  async update(integrationId, updates) {
    const res = await fetch(`${API_BASE}/api/integrations/slack/${integrationId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update integration: ${res.status}`);
    return res.json();
  },

  /**
   * Test connection
   */
  async test(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/slack/${integrationId}/test`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Test failed: ${res.status}`);
    return res.json();
  },

  /**
   * Disconnect integration
   */
  async disconnect(integrationId) {
    const res = await fetch(`${API_BASE}/api/integrations/slack/${integrationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Disconnect failed: ${res.status}`);
    return res.json();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get status of all integration providers
 */
export async function getIntegrationStatus() {
  const res = await fetch(`${API_BASE}/api/integrations/status`);
  if (!res.ok) throw new Error(`Failed to get status: ${res.status}`);
  return res.json();
}

/**
 * Handle OAuth callback from any provider
 */
export function handleOAuthCallback(provider, params) {
  const { code, error, state } = params;
  if (error) {
    return { success: false, error };
  }
  if (!code) {
    return { success: false, error: 'No authorization code received' };
  }
  return { success: true, code, state, provider };
}

/**
 * Export all services as namespace
 */
export const integrationService = {
  googleDrive,
  dropbox,
  zapier,
  slack,
  getIntegrationStatus,
  handleOAuthCallback,
};

export default integrationService;
