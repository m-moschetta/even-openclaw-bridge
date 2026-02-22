import WebSocket from 'ws';
import { config } from './config.js';

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageBuffer: string = '';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(config.openClawWs);

        this.ws.on('open', () => {
          console.log('[OpenClaw]: Connected');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (error) => {
          console.error('[OpenClaw]: WebSocket error:', error);
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        this.ws.on('close', () => {
          console.log('[OpenClaw]: Disconnected');
          this.handleReconnect();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async ask(question: string): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const requestId = this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send message to OpenClaw
      // Format depends on OpenClaw protocol - this is a generic implementation
      const message = JSON.stringify({
        type: 'message',
        id: requestId,
        content: question
      });

      this.ws!.send(message);
      console.log(`[OpenClaw]: Sent request ${requestId}`);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear all pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  private handleMessage(data: string): void {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(data);
      
      if (parsed.type === 'response' && parsed.id) {
        const request = this.pendingRequests.get(parsed.id);
        if (request) {
          clearTimeout(request.timeout);
          this.pendingRequests.delete(parsed.id);
          request.resolve(parsed.content || parsed.message || '');
        }
      } else if (parsed.type === 'chunk') {
        // Streaming response - accumulate
        this.messageBuffer += parsed.content || '';
      } else if (parsed.type === 'end') {
        // End of streaming
        const request = this.pendingRequests.get(parsed.id);
        if (request) {
          clearTimeout(request.timeout);
          this.pendingRequests.delete(parsed.id);
          request.resolve(this.messageBuffer);
          this.messageBuffer = '';
        }
      }
    } catch {
      // Not JSON - treat as plain text
      console.log('[OpenClaw]: Received:', data);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[OpenClaw]: Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[OpenClaw]: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
