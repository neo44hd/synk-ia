/**
 * SYNK-IA — Google Drive Integration Service
 * ==========================================
 * OAuth2-based file sync, auto-processing, and webhook support
 * 
 * Environment variables required:
 * - GOOGLE_DRIVE_CLIENT_ID
 * - GOOGLE_DRIVE_CLIENT_SECRET
 * - GOOGLE_DRIVE_REDIRECT_URI
 */

import crypto from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { DATA_DIR } from '../../routes/data.js';

const INTEGRATIONS_DIR = path.join(DATA_DIR, 'integrations');
const GOOGLE_DRIVE_FILE = path.join(INTEGRATIONS_DIR, 'google-drive.json');

// Google Drive API configuration
const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';

class GoogleDriveService {
  constructor() {
    this.clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || null;
    this.clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || null;
    this.redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:3001/api/integrations/google-drive/callback';
    this.integrations = [];
  }

  async init() {
    try {
      await mkdir(INTEGRATIONS_DIR, { recursive: true });
      await this.loadIntegrations();
    } catch (err) {
      console.warn('[GoogleDrive] Init error:', err.message);
    }
  }

  async loadIntegrations() {
    try {
      if (!existsSync(GOOGLE_DRIVE_FILE)) {
        this.integrations = [];
        return;
      }
      const data = await readFile(GOOGLE_DRIVE_FILE, 'utf8');
      this.integrations = JSON.parse(data) || [];
    } catch (err) {
      console.warn('[GoogleDrive] Load error:', err.message);
      this.integrations = [];
    }
  }

  async saveIntegrations() {
    try {
      await mkdir(INTEGRATIONS_DIR, { recursive: true });
      await writeFile(GOOGLE_DRIVE_FILE, JSON.stringify(this.integrations, null, 2));
    } catch (err) {
      console.error('[GoogleDrive] Save error:', err.message);
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
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly',
      state: state || crypto.randomBytes(16).toString('hex'),
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google Drive OAuth not configured');
    }

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[GoogleDrive] Token exchange error:', err.message);
      throw err;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google Drive OAuth not configured');
    }

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      return await response.json();
    } catch (err) {
      console.error('[GoogleDrive] Refresh error:', err.message);
      throw err;
    }
  }

  /**
   * Create a new integration record
   */
  async createIntegration(userId, tokens, metadata = {}) {
    const integration = {
      id: `gd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      provider: 'google-drive',
      status: 'connected',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      autoProcess: metadata.autoProcess || false,
      folders: metadata.folders || [],
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
    return this.integrations.filter(i => i.userId === userId && i.provider === 'google-drive');
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
   * Fetch files from Google Drive (with auto-refresh)
   */
  async listFiles(integrationId, folderId = 'root') {
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
      const response = await fetch(
        `${GOOGLE_DRIVE_API_URL}/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,mimeType,webViewLink,createdTime,modifiedTime,size)&pageSize=100`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[GoogleDrive] List files error:', err.message);
      throw err;
    }
  }

  /**
   * Download file from Google Drive
   */
  async downloadFile(integrationId, fileId) {
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
      const response = await fetch(`${GOOGLE_DRIVE_API_URL}/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      return await response.blob();
    } catch (err) {
      console.error('[GoogleDrive] Download error:', err.message);
      throw err;
    }
  }

  /**
   * Sync files from Google Drive to local storage
   */
  async syncFiles(integrationId, targetDir) {
    const integration = await this.getIntegration(integrationId);
    if (!integration) throw new Error('Integration not found');

    try {
      const folders = integration.folders.length > 0 ? integration.folders : ['root'];
      const allFiles = [];

      for (const folderId of folders) {
        const result = await this.listFiles(integrationId, folderId);
        allFiles.push(...(result.files || []));
      }

      // Filter for specific file types (PDFs, documents)
      const processableFiles = allFiles.filter(f => {
        const supportedMimes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ];
        return supportedMimes.includes(f.mimeType);
      });

      await this.updateIntegration(integrationId, {
        lastSync: new Date().toISOString(),
      });

      return {
        success: true,
        totalFiles: allFiles.length,
        processableFiles: processableFiles.length,
        files: processableFiles.map(f => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          webViewLink: f.webViewLink,
          size: f.size,
        })),
      };
    } catch (err) {
      console.error('[GoogleDrive] Sync error:', err.message);
      throw err;
    }
  }

  /**
   * Test connection
   */
  async testConnection(integrationId) {
    try {
      const files = await this.listFiles(integrationId);
      return { success: true, files: files.files?.length || 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const googleDriveService = new GoogleDriveService();
export default googleDriveService;
