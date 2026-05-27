/**
 * SYNK-IA — Zapier Integration Service
 * ====================================
 * Webhook-based automation triggers and event routing
 * 
 * Environment variables required:
 * - ZAPIER_WEBHOOK_SECRET (optional, for verification)
 */

import crypto from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { DATA_DIR } from '../../routes/data.js';

const INTEGRATIONS_DIR = path.join(DATA_DIR, 'integrations');
const ZAPIER_FILE = path.join(INTEGRATIONS_DIR, 'zapier.json');
const WEBHOOKS_FILE = path.join(INTEGRATIONS_DIR, 'zapier-webhooks.json');

class ZapierService {
  constructor() {
    this.webhookSecret = process.env.ZAPIER_WEBHOOK_SECRET || null;
    this.integrations = [];
    this.webhooks = [];
  }

  async init() {
    try {
      await mkdir(INTEGRATIONS_DIR, { recursive: true });
      await this.loadIntegrations();
      await this.loadWebhooks();
    } catch (err) {
      console.warn('[Zapier] Init error:', err.message);
    }
  }

  async loadIntegrations() {
    try {
      if (!existsSync(ZAPIER_FILE)) {
        this.integrations = [];
        return;
      }
      const data = await readFile(ZAPIER_FILE, 'utf8');
      this.integrations = JSON.parse(data) || [];
    } catch (err) {
      console.warn('[Zapier] Load error:', err.message);
      this.integrations = [];
    }
  }

  async loadWebhooks() {
    try {
      if (!existsSync(WEBHOOKS_FILE)) {
        this.webhooks = [];
        return;
      }
      const data = await readFile(WEBHOOKS_FILE, 'utf8');
      this.webhooks = JSON.parse(data) || [];
    } catch (err) {
      console.warn('[Zapier] Load webhooks error:', err.message);
      this.webhooks = [];
    }
  }

  async saveIntegrations() {
    try {
      await mkdir(INTEGRATIONS_DIR, { recursive: true });
      await writeFile(ZAPIER_FILE, JSON.stringify(this.integrations, null, 2));
    } catch (err) {
      console.error('[Zapier] Save error:', err.message);
    }
  }

  async saveWebhooks() {
    try {
      await mkdir(INTEGRATIONS_DIR, { recursive: true });
      await writeFile(WEBHOOKS_FILE, JSON.stringify(this.webhooks, null, 2));
    } catch (err) {
      console.error('[Zapier] Save webhooks error:', err.message);
    }
  }

  /**
   * Create a new Zapier integration
   */
  async createIntegration(userId, webhookUrl, metadata = {}) {
    const integration = {
      id: `zap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      provider: 'zapier',
      status: 'connected',
      webhookUrl,
      webhookId: crypto.randomBytes(16).toString('hex'),
      triggers: metadata.triggers || ['document_processed', 'extraction_complete'],
      autoRetry: metadata.autoRetry !== false,
      retryLimit: metadata.retryLimit || 3,
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
    return this.integrations.filter(i => i.userId === userId && i.provider === 'zapier');
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
   * Register a webhook trigger
   */
  async registerWebhook(integrationId, eventType, condition = null) {
    const integration = await this.getIntegration(integrationId);
    if (!integration) throw new Error('Integration not found');

    const webhook = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      integrationId,
      eventType,
      condition,
      enabled: true,
      retries: 0,
      lastFired: null,
      createdAt: new Date().toISOString(),
    };

    this.webhooks.push(webhook);
    await this.saveWebhooks();
    return webhook;
  }

  /**
   * Trigger a webhook
   */
  async triggerWebhook(integrationId, eventType, payload) {
    const integration = await this.getIntegration(integrationId);
    if (!integration || !integration.webhookUrl) {
      throw new Error('Integration not found or webhook URL not configured');
    }

    // Find matching webhooks
    const matchingWebhooks = this.webhooks.filter(
      w => w.integrationId === integrationId && w.eventType === eventType && w.enabled
    );

    if (matchingWebhooks.length === 0) {
      console.warn(`[Zapier] No webhooks found for event: ${eventType}`);
      return { success: false, webhooksTriggered: 0 };
    }

    let triggered = 0;
    for (const webhook of matchingWebhooks) {
      try {
        const response = await fetch(integration.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.webhookSecret && { 'X-Zapier-Secret': this.webhookSecret }),
          },
          body: JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload,
          }),
        });

        if (response.ok) {
          webhook.lastFired = new Date().toISOString();
          webhook.retries = 0;
          triggered++;
        } else if (integration.autoRetry && webhook.retries < integration.retryLimit) {
          webhook.retries++;
          console.warn(`[Zapier] Webhook retry ${webhook.retries}/${integration.retryLimit}`);
        }
      } catch (err) {
        console.error(`[Zapier] Webhook trigger error: ${err.message}`);
        if (integration.autoRetry && webhook.retries < integration.retryLimit) {
          webhook.retries++;
        }
      }
    }

    await this.saveWebhooks();
    return { success: triggered > 0, webhooksTriggered: triggered };
  }

  /**
   * List webhooks for integration
   */
  async listWebhooks(integrationId) {
    return this.webhooks.filter(w => w.integrationId === integrationId);
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId) {
    const index = this.webhooks.findIndex(w => w.id === webhookId);
    if (index === -1) throw new Error('Webhook not found');

    this.webhooks.splice(index, 1);
    await this.saveWebhooks();
    return { success: true };
  }

  /**
   * Test webhook connectivity
   */
  async testWebhook(integrationId) {
    const integration = await this.getIntegration(integrationId);
    if (!integration || !integration.webhookUrl) {
      return { success: false, error: 'Integration not found or webhook URL not configured' };
    }

    try {
      const response = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.webhookSecret && { 'X-Zapier-Secret': this.webhookSecret }),
        },
        body: JSON.stringify({
          event: 'test',
          timestamp: new Date().toISOString(),
          data: { message: 'Test webhook from SYNK-IA' },
        }),
      });

      return { success: response.ok, status: response.status };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle incoming webhook from Zapier
   */
  async handleWebhookPayload(payload, signature = null) {
    // Verify signature if secret is configured
    if (this.webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Log webhook received
    const webhookLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      payload,
      receivedAt: new Date().toISOString(),
      processed: true,
    };

    return webhookLog;
  }
}

export const zapierService = new ZapierService();
export default zapierService;
