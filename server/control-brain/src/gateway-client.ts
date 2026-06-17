/**
 * Gateway Client - Interfaz HTTP hacia el gateway LiteLLM
 */

interface GatewayModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

interface GatewayHealthResponse {
  status: string;
  [key: string]: any;
}

export class GatewayClient {
  private baseUrl: string;
  private timeout: number = 5000;

  constructor(baseUrl: string = 'http://127.0.0.1:4000') {
    this.baseUrl = baseUrl;
  }

  async getHealth(): Promise<{ alive: boolean; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(`${this.baseUrl}/health/liveliness`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await response.text();
      return { alive: response.ok, error: response.ok ? undefined : text };
    } catch (error: any) {
      return { alive: false, error: error.message };
    }
  }

  async listModels(): Promise<GatewayModel[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        console.error('Failed to list models:', response.statusText);
        return [];
      }
      const data = (await response.json()) as { data: GatewayModel[] };
      return data.data || [];
    } catch (error: any) {
      console.error('Error listing gateway models:', error.message);
      return [];
    }
  }

  async chatCompletion(
    model: string,
    messages: { role: string; content: string }[]
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      return { success: true, content };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
