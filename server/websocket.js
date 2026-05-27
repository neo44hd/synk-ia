// ── WebSocket handlers para Hermes Agent y OpenCode ──────────────────────────
// Uso: importar las funciones de setup y llamarlas ANTES del dispatcher central.
// Cada una crea un WebSocketServer y devuelve una función de upgrade handler.
import { WebSocketServer } from 'ws';

export function createHermesWSS() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    let model = 'harmonic-hermes-9b:latest';

    try {
      const url = new URL(req.url, 'http://localhost');
      model = url.searchParams.get('model') || model;
    } catch {}

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'config') {
          if (msg.model) model = msg.model;
          ws.send(JSON.stringify({ type: 'config', model, success: true }));
          return;
        }
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        const text = msg.message || msg.text || '';
        if (!text) return;

        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

        try {
          const res = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              prompt: text,
              stream: true,
              options: { temperature: 0.7, num_predict: 2048 }
            }),
            signal: AbortSignal.timeout(120_000)
          });

          if (!res.ok || !res.body) {
            ws.send(JSON.stringify({ type: 'error', message: `HTTP ${res.status}` }));
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.trim());
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  ws.send(JSON.stringify({ type: 'chunk', text: data.response }));
                }
                if (data.done) {
                  ws.send(JSON.stringify({ type: 'done', model, total_duration: data.total_duration, eval_duration: data.eval_duration }));
                }
              } catch {}
            }
          }
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: e.message }));
      }
    });

    ws.on('close', () => {});
    ws.on('error', () => {});
  });

  return wss;
}

export function createOpenCodeWSS() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    let model = 'negentropy-claude-opus-4.7-9b';

    try {
      const url = new URL(req.url, 'http://localhost');
      model = url.searchParams.get('model') || model;
    } catch {}

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'config') {
          if (msg.model) model = msg.model;
          ws.send(JSON.stringify({ type: 'config', model, success: true }));
          return;
        }
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        const text = msg.message || msg.text || '';
        if (!text) return;

        const provider = model.includes('/') ? 'openrouter' : 'lmstudio';
        let apiUrl;

        if (provider === 'lmstudio') {
          apiUrl = `${process.env.LMSTUDIO_URL || 'http://localhost:1234/v1'}/chat/completions`;
        } else {
          apiUrl = `${process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1'}/chat/completions`;
        }

        const headers = { 'Content-Type': 'application/json' };
        if (provider === 'openrouter' && process.env.OPENROUTER_KEY) {
          headers['Authorization'] = `Bearer ${process.env.OPENROUTER_KEY}`;
        }

        try {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: text }],
              stream: true,
              temperature: 0.7,
              max_tokens: 2048
            }),
            signal: AbortSignal.timeout(120_000)
          });

          if (!res.ok || !res.body) {
            ws.send(JSON.stringify({ type: 'error', message: `HTTP ${res.status}` }));
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              ws.send(JSON.stringify({ type: 'done', model, content: fullContent }));
              break;
            }
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.trim());
            for (const line of lines) {
              try {
                const data = JSON.parse(line.replace(/^data:\s*/, ''));
                if (data.choices?.[0]?.delta?.content) {
                  const t = data.choices[0].delta.content;
                  fullContent += t;
                  ws.send(JSON.stringify({ type: 'chunk', text: t }));
                }
              } catch {}
            }
          }
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: e.message }));
      }
    });

    ws.on('close', () => {});
    ws.on('error', () => {});
  });

  return wss;
}