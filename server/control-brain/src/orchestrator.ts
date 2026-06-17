/**
 * Agent Orchestrator - Intelligent task routing and workflow management
 */

import { sinkiaClient } from './sinkia-client.js';

export interface TaskRequest {
  prompt: string;
  preferredAgent?: string;
  preferredModel?: string;
  confidenceThreshold?: number;
}

export interface RoutingDecision {
  agent: string;
  model: string;
  reason: string;
}

export class Orchestrator {
  private agentMap: Record<string, string[]> = {
    classify: ['classify'],
    extract: ['extract'],
    analyze: ['analyze'],
    document: ['document'],
  };

  private modelPreferences: Record<string, string> = {
    classify: 'local-fast',
    extract: 'local-fast',
    analyze: 'local-reason',
    document: 'local-reason',
  };

  /**
   * Analyze task and decide best agent + model
   */
  async routeTask(request: TaskRequest): Promise<RoutingDecision> {
    // If preferred agent specified, use it
    if (request.preferredAgent) {
      const model = request.preferredModel || this.modelPreferences[request.preferredAgent] || 'local-fast';
      return {
        agent: request.preferredAgent,
        model,
        reason: 'User preference',
      };
    }

    // Simple keyword-based routing for MVP
    const prompt = request.prompt.toLowerCase();

    if (prompt.includes('classify') || prompt.includes('categorize')) {
      return {
        agent: 'classify',
        model: this.modelPreferences.classify,
        reason: 'Keyword matching: classify',
      };
    }

    if (prompt.includes('extract') || prompt.includes('pull out') || prompt.includes('get')) {
      return {
        agent: 'extract',
        model: this.modelPreferences.extract,
        reason: 'Keyword matching: extract',
      };
    }

    if (prompt.includes('analyze') || prompt.includes('deep') || prompt.includes('complex')) {
      return {
        agent: 'analyze',
        model: this.modelPreferences.analyze,
        reason: 'Keyword matching: analyze',
      };
    }

    if (prompt.includes('document') || prompt.includes('summarize')) {
      return {
        agent: 'document',
        model: this.modelPreferences.document,
        reason: 'Keyword matching: document',
      };
    }

    // Default fallback
    return {
      agent: 'analyze',
      model: 'local-reason',
      reason: 'Default routing',
    };
  }

  /**
   * Execute task via appropriate agent
   */
  async executeTask(
    agent: string,
    prompt: string,
    model: string
  ): Promise<{ success: boolean; result: any; latency_ms: number; cost?: number }> {
    try {
      const startTime = Date.now();

      // Map agent to sinkia method
      let response;
      switch (agent) {
        case 'classify':
          response = await sinkiaClient.classify(prompt, model);
          break;
        case 'extract':
          response = await sinkiaClient.extract(prompt, model);
          break;
        case 'document':
          response = await sinkiaClient.document(prompt, model);
          break;
        case 'analyze':
        default:
          response = await sinkiaClient.analyze(prompt, model);
      }

      const latency_ms = Date.now() - startTime;

      return {
        success: response.success || false,
        result: response.result || response.error,
        latency_ms,
        cost: response.estimated_cost,
      };
    } catch (error: any) {
      return {
        success: false,
        result: error.message,
        latency_ms: 0,
      };
    }
  }
}

export const orchestrator = new Orchestrator();
