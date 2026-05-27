/**
 * SYNK-IA — Slack Integration Service
 * ===================================
 * OAuth2-based messaging, notifications, and interactive features
 * 
 * Environment variables required:
 * - SLACK_CLIENT_ID
 * - SLACK_CLIENT_SECRET
 * - SLACK_REDIRECT_URI
 * - SLACK_SIGNING_SECRET
 */

import crypto from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { DATA_DIR } from '../../routes/data.js';

const INTEGRATIONS_DIR = path.join(DATA_DIR, 'integrations');
const SLACK_FILE = path.join(INTEGRATIONS_DIR, 'slack.json');

// Slack API configuration
const SLACK_OAUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_API_URL = 'https://slack.com/api';

class SlackService {
  constructor() {
    this.clientId = process.env.SLACK_CLIENT_ID || null;
    this.clientSecret = process.env.SLACK_CLIENT_SECRET || null;
    this.redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/api/integrations/slack/callback';
    this.signingSecret = process.env.SLACK_SIGNING_SECRET || null;
    this.integrations = [];
  }

  async init() {
    try {
      await mkdir(INTEGRATIONS_DIR, { recursive: true });
      await this.loadIntegrations();
    } catch (err) {
      console.warn('[Slack] Init error:', err.message);
    }
  }

  async loadIntegrations() {
    try {
      if (!existsSync(SLACK_FILE)) {
        this.integrations = [];
        return;
      }
      const data = await readFile(SLACK_FILE, 'utf8');
      this.integrations = JSON.parse(data) || [];
    } catch (err) {
      console.warn('[Slack] Load error:', err.message);
      this.integrations = [];
    }
  }

  async saveIntegrations() {
    try {
      await mkdir(INTEGRATIONS_DIR, { recursive: true });
      await writeFile(SLACK_FILE, JSON.stringify(this.integrations, null, 2));
    } catch (err) {
      console.error('[Slack] Save error:', err.message);
    }
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthorizationUrl(state) {
    if (!this.clientId) {
      return null; // OAuth not configured
    }
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: state || crypto.randomBytes(16).toString('hex'),
      scope: 'chat:write,chat:write.public,channels:read,users:read,team:read',
    });
    return `${SLACK_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Slack OAuth not configured');
    }

    try {
      const response = await fetch(SLACK_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Token exchange failed: ${error.error || 'Unknown error'}`);
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(`Slack error: ${data.error}`);
      }

      return data;
    } catch (err) {
      console.error('[Slack] Token exchange error:', err.message);
      throw err;
    }
  }

  /**
   * Create a new Slack integration
   */
  async createIntegration(userId, tokenData, metadata = {}) {
    const integration = {
      id: `slack_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      provider: 'slack',
      status: 'connected',
      accessToken: tokenData.access_token,
      botUserId: tokenData.bot_user_id,
      appId: tokenData.app_id,
      teamId: tokenData.team_id,
      teamName: tokenData.team_name,
      notificationChannel: metadata.notificationChannel || null,
      autoNotify: metadata.autoNotify || false,
      notifyOn: metadata.notifyOn || ['document_processed', 'error'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.integrations.push(integration);
    await this.saveIntegrations();
    return integration;
  }

  /**
   * Get integration by ID
   */
  async getIntegration(integrationId) {
    return this.integrations.find(i => i.id === integrationId) || null;
  }

  /**
   * List integrations for a user
   */
  async listIntegrations(userId) {
    return this.integrations.filter(i => i.userId === userId && i.provider === 'slack');
  }

  /**
   * Update integration settings
   */
  async updateIntegration(integrationId, updates) {
    const integration = await this.getIntegration(integrationId);
    if (!integration) throw new Error('Integration not found');

    Object.assign(integration, updates, { updatedAt: new Date().toISOString() });
    await this.saveIntegrations();
    return integration;
  }

  /**
   * Disconnect integration
   */
  async disconnectIntegration(integrationId) {
    const index = this.integrations.findIndex(i => i.id === integrationId);
    if (index === -1) throw new Error('Integration not found');

    this.integrations.splice(index, 1);
    await this.saveIntegrations();
    return { success: true };
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(integrationId, channel, text, blocks = null) {
    const integration = await this.getIntegration(integrationId);
    if (!integration) throw new Error('Integration not found');

    try {
      const body = {
        channel,
        text,
        ...(blocks && { blocks }),
      };

      const response = await fetch(`${SLACK_API_URL}/chat.postMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${integration.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(`Slack error: ${data.error}`);
      }

      return { success: true, ts: data.ts, channel: data.channel };
    } catch (err) {
      console.error('[Slack] Send message error:', err.message);
      throw err;
    }
  }

  /**
   * Send a notification about document processing
   */
  async notifyDocumentProcessed(integrationId, documentData) {
    const integration = await this.getIntegration(integrationId);
    if (!integration || !integration.autoNotify || !integration.notificationChannel) {
      return { success: false, reason: 'Auto-notify not configured' };
    }

    try {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📄 Documento Procesado',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Archivo:*\n${documentData.fileName || 'Sin nombre'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Tipo:*\n${documentData.type || 'Desconocido'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Estado:*\n${documentData.status || 'Procesado'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Confianza:*\n${documentData.confidence || 'N/A'}`,
            },
          ],
        },
      ];

      if (documentData.summary) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Resumen:*\n${documentData.summary}`,
          },
        });
      }

      return await this.sendMessage(
        integrationId,
        integration.notificationChannel,
        `Documento procesado: ${documentData.fileName || 'Sin nombre'}`,
        blocks
      );
    } catch (err) {
      console.error('[Slack] Notification error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send error notification
   */
  async notifyError(integrationId, error) {
    const integration = await this.getIntegration(integrationId);
    if (!integration || !integration.autoNotify || !integration.notificationChannel) {
      return { success: false, reason: 'Auto-notify not configured' };
    }

    try {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Error en SYNK-IA',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `\`\`\`${error.message || error}\`\`\``,
          },
        },
      ];

      return await this.sendMessage(
        integrationId,
        integration.notificationChannel,
        `Error: ${error.message || error}`,
        blocks
      );
    } catch (err) {
      console.error('[Slack] Error notification failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get list of channels
   */
  async listChannels(integrationId) {
    const integration = await this.getIntegration(integrationId);
    if (!integration) throw new Error('Integration not found');

    try {
      const response = await fetch(`${SLACK_API_URL}/conversations.list`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${integration.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(`Slack error: ${data.error}`);
      }

      return data.channels || [];
    } catch (err) {
      console.error('[Slack] List channels error:', err.message);
      throw err;
    }
  }

  /**
   * Verify incoming Slack event signature
   */
  verifySlackRequest(body, signature, timestamp) {
    if (!this.signingSecret) {
      console.warn('[Slack] Signing secret not configured, skipping verification');
      return true;
    }

    // Check timestamp (must be within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
      return false;
    }

    const baseString = `v0:${timestamp}:${body}`;
    const expectedSignature = 'v0=' + crypto
      .createHmac('sha256', this.signingSecret)
      .update(baseString)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Test connection
   */
  async testConnection(integrationId) {
    try {
      const channels = await this.listChannels(integrationId);
      return { success: true, channels: channels.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const slackService = new SlackService();
export default slackService;
