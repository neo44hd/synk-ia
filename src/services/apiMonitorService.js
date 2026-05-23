/**
 * API Monitor Service
 * Verifica la salud de todas las APIs configuradas
 * Google Gemini, OpenRouter, Anthropic Claude, NVIDIA, Ollama
 */

export const apiMonitorService = {
  /**
   * Verifica el estado de Ollama Local
   */
  async checkOllama() {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        timeout: 5000
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return {
        status: 'healthy',
        provider: 'Ollama',
        models: data.models?.length || 0,
        latency: 0,
        endpoint: 'http://localhost:11434',
        message: `${data.models?.length || 0} modelos disponibles`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: 'Ollama',
        message: error.message || 'No responde',
        endpoint: 'http://localhost:11434'
      };
    }
  },

  /**
   * Verifica Google Gemini API
   */
  async checkGemini(apiKey) {
    try {
      const start = Date.now();
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }]
          })
        }
      );
      
      const latency = Date.now() - start;
      
      if (!response.ok) {
        if (response.status === 429) {
          return {
            status: 'rate-limited',
            provider: 'Google Gemini',
            latency,
            message: 'Rate limit alcanzado (15 req/min)',
            endpoint: 'generativelanguage.googleapis.com'
          };
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        status: 'healthy',
        provider: 'Google Gemini',
        latency,
        model: 'gemini-flash-latest',
        message: 'API respondiendo',
        endpoint: 'generativelanguage.googleapis.com'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: 'Google Gemini',
        message: error.message || 'Error conectando',
        endpoint: 'generativelanguage.googleapis.com'
      };
    }
  },

  /**
   * Verifica OpenRouter API
   */
  async checkOpenRouter(apiKey) {
    try {
      const start = Date.now();
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const latency = Date.now() - start;
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      return {
        status: 'healthy',
        provider: 'OpenRouter',
        latency,
        usage: data.data?.usage || 0,
        isFreetier: data.data?.is_free_tier,
        message: `Uso: $${(data.data?.usage || 0).toFixed(2)}`,
        endpoint: 'openrouter.ai'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: 'OpenRouter',
        message: error.message || 'API key inválida',
        endpoint: 'openrouter.ai'
      };
    }
  },

  /**
   * Verifica Anthropic Claude API
   */
  async checkClaude(apiKey) {
    try {
      const start = Date.now();
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });
      
      const latency = Date.now() - start;
      
      if (!response.ok) {
        if (response.status === 401) {
          return {
            status: 'unhealthy',
            provider: 'Anthropic Claude',
            latency,
            message: 'API key inválida',
            endpoint: 'api.anthropic.com'
          };
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      return {
        status: 'healthy',
        provider: 'Anthropic Claude',
        latency,
        model: 'claude-3-5-sonnet-20241022',
        message: 'API respondiendo',
        endpoint: 'api.anthropic.com'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: 'Anthropic Claude',
        message: error.message || 'Error conectando',
        endpoint: 'api.anthropic.com'
      };
    }
  },

  /**
   * Verifica NVIDIA API (solo verifica configuración)
   */
  async checkNvidia(apiKey) {
    try {
      // NVIDIA generalmente requiere autenticación específica
      // Por ahora solo verificamos que la key existe
      if (!apiKey || apiKey.length < 20) {
        return {
          status: 'unhealthy',
          provider: 'NVIDIA',
          message: 'API key no configurada',
          endpoint: 'api.nvinferce.ai'
        };
      }
      
      return {
        status: 'healthy',
        provider: 'NVIDIA',
        message: 'API key configurada',
        endpoint: 'api.nvinferce.ai',
        note: 'Enterprise models disponibles'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: 'NVIDIA',
        message: error.message,
        endpoint: 'api.nvinferce.ai'
      };
    }
  },

  /**
   * Verifica Backend SynK-IA
   */
  async checkBackend() {
    try {
      const start = Date.now();
      const response = await fetch('http://localhost:59401/api/health', {
        method: 'GET'
      });
      
      const latency = Date.now() - start;
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      return {
        status: data.status === 'ok' ? 'healthy' : 'degraded',
        provider: 'SynK-IA Backend',
        latency,
        message: data.status === 'ok' ? 'Todos los servicios activos' : 'Algunos servicios offline',
        uptime: data.uptime,
        memory: data.memory,
        aiEngine: data.services?.ai?.engine,
        endpoint: 'http://localhost:59401'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: 'SynK-IA Backend',
        message: 'Backend offline',
        endpoint: 'http://localhost:59401'
      };
    }
  },

  /**
   * Verifica TODAS las APIs
   */
  async checkAllApis() {
    const apiKey = localStorage.getItem('GOOGLE_GEMINI_API_KEY') || import.meta.env.VITE_GOOGLE_GEMINI_API_KEY;
    const openRouterKey = localStorage.getItem('OPENROUTER_API_KEY') || import.meta.env.VITE_OPENROUTER_API_KEY;
    const claudeKey = localStorage.getItem('ANTHROPIC_API_KEY') || import.meta.env.VITE_ANTHROPIC_API_KEY;
    const nvidiaKey = localStorage.getItem('NVIDIA_API_KEY') || import.meta.env.VITE_NVIDIA_API_KEY;
    
    const results = await Promise.all([
      this.checkBackend(),
      this.checkOllama(),
      this.checkGemini(apiKey),
      this.checkOpenRouter(openRouterKey),
      this.checkClaude(claudeKey),
      this.checkNvidia(nvidiaKey)
    ]);
    
    return {
      timestamp: new Date().toISOString(),
      healthy: results.filter(r => r.status === 'healthy').length,
      total: results.length,
      apis: results
    };
  },

  /**
   * Obtiene el resumen de estado
   */
  getSummary(results) {
    const healthy = results.apis.filter(a => a.status === 'healthy').length;
    const unhealthy = results.apis.filter(a => a.status === 'unhealthy').length;
    const degraded = results.apis.filter(a => a.status === 'degraded').length;
    
    let overallStatus = 'healthy';
    if (unhealthy > 0) overallStatus = 'unhealthy';
    else if (degraded > 0) overallStatus = 'degraded';
    
    return {
      status: overallStatus,
      healthy,
      unhealthy,
      degraded,
      percentage: Math.round((healthy / results.total) * 100)
    };
  }
};
