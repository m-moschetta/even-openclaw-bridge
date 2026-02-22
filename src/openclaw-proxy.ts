import WebSocket from 'ws';
import { config } from './config.js';

export class OpenClawProxy {
  private ws: WebSocket | null = null;
  private messageQueue: Array<{ text: string; resolve: (value: string) => void; reject: (error: Error) => void }> = [];
  private responseBuffer: string = '';
  private isProcessing: boolean = false;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(config.openClawWs);

      this.ws.on('open', () => {
        console.log('[OpenClaw] Connected');
        this.processQueue();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        console.error('[OpenClaw] Error:', error);
      });

      this.ws.on('close', () => {
        console.log('[OpenClaw] Disconnected, reconnecting...');
        setTimeout(() => this.connect(), 3000);
      });

    } catch (error) {
      console.error('[OpenClaw] Connection failed:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async ask(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.messageQueue.push({ text, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) return;
    if (!this.isConnected()) return;

    this.isProcessing = true;
    const { text, resolve, reject } = this.messageQueue.shift()!;

    const timeout = setTimeout(() => {
      reject(new Error('OpenClaw response timeout'));
      this.isProcessing = false;
      this.processQueue();
    }, 30000);

    this.responseBuffer = '';
    
    // Send message
    const message = JSON.stringify({
      type: 'message',
      content: text
    });

    this.ws!.send(message);

    // Wait for response (simplified - assumes single response)
    const checkResponse = setInterval(() => {
      // In real implementation, handle streaming/chunked responses
      // For now, simulate complete response after delay
    }, 100);

    // Mock response for now - replace with actual OpenClaw protocol
    setTimeout(() => {
      clearTimeout(timeout);
      clearInterval(checkResponse);
      
      // Forward to actual OpenClaw
      this.forwardToOpenClaw(text, resolve, reject);
    }, 100);
  }

  private forwardToOpenClaw(text: string, resolve: (value: string) => void, reject: (error: Error) => void) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      reject(new Error('OpenClaw not connected'));
      this.isProcessing = false;
      this.processQueue();
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const onMessage = (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'response' || msg.type === 'chunk') {
          this.responseBuffer += msg.content || '';
        }
        if (msg.type === 'end' || msg.type === 'response') {
          this.ws!.off('message', onMessage);
          resolve(this.responseBuffer || msg.content || 'Nessuna risposta');
          this.isProcessing = false;
          this.processQueue();
        }
      } catch {
        // Non-JSON message
        this.ws!.off('message', onMessage);
        resolve(data.toString());
        this.isProcessing = false;
        this.processQueue();
      }
    };

    this.ws.on('message', onMessage);

    this.ws.send(JSON.stringify({
      type: 'message',
      id: requestId,
      content: text
    }));
  }

  private handleMessage(data: string) {
    // Handle streaming responses
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'chunk') {
        this.responseBuffer += msg.content || '';
      }
    } catch {
      // Plain text response
      this.responseBuffer += data;
    }
  }
}
