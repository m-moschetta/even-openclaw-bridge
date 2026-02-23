import { config } from './config.js';

export class OpenClawProxy {
  private baseUrl: string;
  private password: string;

  constructor() {
    // Convert ws(s):// to http(s):// for the HTTP API
    this.baseUrl = config.openClawWs
      .replace(/^wss:\/\//, 'https://')
      .replace(/^ws:\/\//, 'http://');
    this.password = config.openClawPassword;

    console.log(`[OpenClaw] HTTP API: ${this.baseUrl}/v1/chat/completions`);
  }

  isConnected(): boolean {
    // HTTP is stateless — always "connected" if configured
    return !!this.password;
  }

  async ask(text: string, onChunk?: (chunk: string) => void): Promise<string> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.password}`,
          'Content-Type': 'application/json',
          'x-openclaw-agent-id': 'main',
        },
        body: JSON.stringify({
          model: 'openclaw',
          stream: !!onChunk,
          messages: [{ role: 'user', content: text }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenClaw API error (${response.status}): ${errText}`);
      }

      // Non-streaming
      if (!onChunk) {
        const data = await response.json() as any;
        return data.choices?.[0]?.message?.content || 'Nessuna risposta';
      }

      // Streaming SSE
      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      let result = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              result += content;
              onChunk(content);
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      return result || 'Nessuna risposta';

    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenClaw response timeout (60s)');
      }
      throw error;
    }
  }
}
