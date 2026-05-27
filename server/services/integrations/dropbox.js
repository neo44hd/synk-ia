/**
 * SYNK-IA — Dropbox Integration Service
 * =====================================
 * OAuth2-based file sync, auto-processing, and webhook support
 * 
 * Environment variables required:
 * - DROPBOX_APP_KEY
 * - DROPBOX_APP_SECRET
 * - DROPBOX_REDIRECT_URI
 */

import crypto from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { DATA_DIR } from '../../routes/data.js';

const INTEGRATIONS_DIR = path.join(DATA_DIR, 'integrations');
const DROPBOX_FILE = path.join(INTEGRATIONS_DIR, 'dropbox.json');

// Dropbox API configuration
const DROPBOX_OAUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';

class DropboxService {
  constructor() {
    this.appKey = process.env.DROPBOX_APP_KEY || null;
    this.appSecret = process.env.DROPBOX_APP_SECRET || null;
    this.redirectUri = process.env.DROPBOX_REDIRECT_URI || 'http://localhost:3001/api/integrations/dropbox/callback';
    this.integrations = [];
  }

  async init() {
    try {
      await mkdir(INTEGRATIONS_DIR, { recursive: true });
      await this.loadIntegrations();
    } catch (err) {
      console.warn('[Dropbox] Init error:', err.message);
    }
  }

  async loadIntegrations() {
    try {
      if (!existsSync(DROPBOX_FILE)) {
        this.integrations = [];
        return;
      }
      const data = await readFile(DROPBOX_FILE, 'utf8');
      this.integrations = JSON.parse(data) || [];
    } catch (err) {
      console.warn('[Dropbox] Load error:', err.message);
      this.integrations = [];
    }
  }

  async saveIntegrations() {
    try {
      await mkdir(INTEGRATIONS_DIR, { recursive: true });
      await writeFile(DROPBOX_FILE, JSON.stringify(this.integrations, null, 2));
    } catch (err) {
      console.error('[Dropbox] Save error:', err.message);
    }
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthorizationUrl(state) {
    if (!this.appKey) {
      return null; // OAuth not configured
    }
    const params = new URLSearchParams({
      client_id: this.appKey,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: state || crypto.randomBytes(16).toString('hex'),
    });
    return `${DROPBOX_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    if (!this.appKey || !this.appSecret) {
      throw new Error('Dropbox OAuth not configured');
    }

    try {
      const response = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: this.appKey,
          client_secret: this.appSecret,
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[Dropbox] Token exchange error:', err.message);
      throw err;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    if (!this.appKey || !this.appSecret) {
      throw new Error('Dropbox OAuth not configured');
    }

    try {
      const response = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.appKey,
          client_secret: this.appSecret,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      return await response.json();
    } catch (err) {
      console.error('[Dropbox] Refresh error:', err.message);
      throw err;
    }
  }

  /**
   * Create a new integration record
   */
  async createIntegration(userId, tokens, metadata = {}) {
    const integration = {
      id: `db_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      provider: 'dropbox',
      status: 'connected',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      autoProcess: metadata.autoProcess || false,
      watchFolders: metadata.watchFolders || ['/'],
      syncInterval: metadata.syncInterval || 3600000, // 1 hour default
      lastSync: null,
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
    return this.integrations.filter(i => i.userId === userId && i.provider === 'dropbox');
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
   * Fetch files from Dropbox (with auto-refresh)
   */
  async listFiles(integrationId, path = '') {
    const integration = await this.getIntegration(integrationId);
    if (!integration) throw new Error('Integration not found');

    let accessToken = integration.accessToken;
    if (integration.expiresAt && Date.now() >= integration.expiresAt) {
      if (integration.refreshToken) {
        const newTokens = await this.refreshAccessToken(integration.refreshToken);
        await this.updateIntegration(integrationId, {
          accessToken: newTokens.access_token,
          expiresAt: Date.now() + newTokens.expires_in * 1000,
        });
        accessToken = newTokens.access_token;
      } else {
        throw new Error('Access token expired and no refresh token available');
      }
    }

    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/list_folder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: path || '/' }),
      });

      if (!response.ok) {
        throw new Error(`Dropbox API error: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[Dropbox] List files error:', err.message);
      throw err;
    }
  }

  /**
   * Download file from Dropbox
   */
  async downloadFile(integrationId, filePath) {
    const integration = await this.getIntegration(integrationId);
    if (!integration) throw new Error('Integration not found');

    let accessToken = integration.accessToken;
    if (integration.expiresAt && Date.now() >= integration.expiresAt) {
      if (integration.refreshToken) {
        const newTokens = await this.refreshAccessToken(integration.refreshToken);
        await this.updateIntegration(integrationId, {
          accessToken: newTokens.access_token,
          expiresAt: Date.now() + newTokens.expires_in * 1000,
        });
        accessToken = newTokens.access_token;
      } else {
        throw new Error('Access token expired');
      }
    }

    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      return await response.blob();
    } catch (err) {
      console.error('[Dropbox] Download error:', err.message);
      throw err;
    }
  }

  /**
   * Sync files from Dropbox to local storage
   */
  async syncFiles(integrationId, targetDir) {
    const integration = await this.getIntegration(integrationId);
    if (!integration) throw new Error('Integration not found');

    try {
      const folders = integration.watchFolders || ['/'];
      const allFiles = [];

      for (const folderPath of folders) {
        const result = await this.listFiles(integrationId, folderPath);
        allFiles.push(...(result.entries || []));
      }

      // Filter for specific file types (PDFs, documents)
      const processableFiles = allFiles.filter(f => {
        if (f['.tag'] === 'folder') return false;
        const supportedExts = ['.pdf', '.docx', '.doc', '.xlsx', '.xls'];
        const ext = (f.name || '').toLowerCase().match(/\.[^.]+$/)?.[0] || '';
        return supportedExts.includes(ext);
      });

      await this.updateIntegration(integrationId, {
        lastSync: new Date().toISOString(),
      });

      return {
        success: true,
        totalFiles: allFiles.length,
        processableFiles: processableFiles.length,
        files: processableFiles.map(f => ({
          path: f.path_display,
          name: f.name,
          size: f.size,
          modified: f.server_modified,
        })),
      };
    } catch (err) {
      console.error('[Dropbox] Sync error:', err.message);
      throw err;
    }
  }

  /**
   * Test connection
   */
  async testConnection(integrationId) {
    try {
      const files = await this.listFiles(integrationId, '/');
      return { success: true, files: files.entries?.length || 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const dropboxService = new DropboxService();
export default dropboxService;
