/**
 * Sinkia Client - HTTP interface to Sinkia API agents
 */

export interface SinkiaResponse {
  success: boolean;
  result?: any;
  confidence?: number;
  model: string;
  provider: string;
  latency_ms: number;
  estimated_cost?: number;
  error?: string;
}

export interface SinkiaStatus {
  success: boolean;
  engine: string;
  online: boolean;
  models: Record<string, string>;
  providers: Record<string, string[]>;
  gateway_online: boolean;
}

export class SinkiaClient {
  private baseUrl: string;
  private timeout: number = 30000; // 30s for task execution

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async getStatus(): Promise<SinkiaStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(`${this.baseUrl}/api/ai/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }
      const data = await response.json() as SinkiaStatus;
      return data;
    } catch (error: any) {
      console.error('Sinkia status error:', error.message);
      return {
        success: false,
        engine: 'unknown',
        online: false,
        models: {},
        providers: {},
        gateway_online: false,
      };
    }
  }

  async classify(text: string, model?: string): Promise<SinkiaResponse> {
    return this.callAgent('classify', { text, model });
  }

  async extract(text: string, model?: string): Promise<SinkiaResponse> {
    return this.callAgent('extract', { text, model });
  }

  async analyze(text: string, model?: string): Promise<SinkiaResponse> {
    return this.callAgent('analyze', { text, model });
  }

  async document(text: string, model?: string): Promise<SinkiaResponse> {
    return this.callAgent('document', { text, model });
  }

  private async callAgent(
    agent: string,
    payload: Record<string, any>
  ): Promise<SinkiaResponse> {
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(`${this.baseUrl}/api/ai/${agent}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latency_ms = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          model: 'unknown',
          provider: 'unknown',
          latency_ms,
          error: `HTTP ${response.status}`,
        };
      }

      const result = await response.json() as SinkiaResponse;
      return {
        success: result.success,
        result: result.result,
        confidence: result.confidence,
        model: result.model,
        provider: result.provider,
        latency_ms,
        estimated_cost: result.estimated_cost,
        error: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        model: 'unknown',
        provider: 'unknown',
        latency_ms: 0,
        error: error.message,
      };
    }
  }
}

export const sinkiaClient = new SinkiaClient();
