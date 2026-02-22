import WebSocket from 'ws';
import { config } from './config.js';
export class OpenClawProxy {
    ws = null;
    messageQueue = [];
    isProcessing = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    constructor() {
        this.connect();
    }
    connect() {
        try {
            console.log('[OpenClaw] Connecting to', config.openClawWs);
            this.ws = new WebSocket(config.openClawWs);
            this.ws.on('open', () => {
                console.log('[OpenClaw] Connected');
                this.reconnectAttempts = 0;
                this.processQueue();
            });
            this.ws.on('message', (data) => {
                this.handleMessage(data.toString());
            });
            this.ws.on('error', (error) => {
                console.error('[OpenClaw] Error:', error.message);
            });
            this.ws.on('close', (code) => {
                console.log(`[OpenClaw] Disconnected (code ${code}), reconnecting...`);
                this.scheduleReconnect();
            });
        }
        catch (error) {
            console.error('[OpenClaw] Connection failed:', error);
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[OpenClaw] Max reconnection attempts reached');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
        console.log(`[OpenClaw] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
    }
    isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
    async ask(text, onChunk) {
        return new Promise((resolve, reject) => {
            // Global timeout for entire request
            const timeout = setTimeout(() => {
                reject(new Error('OpenClaw response timeout (30s)'));
            }, 30000);
            const wrappedResolve = (value) => {
                clearTimeout(timeout);
                resolve(value);
            };
            const wrappedReject = (error) => {
                clearTimeout(timeout);
                reject(error);
            };
            this.messageQueue.push({
                text,
                onChunk: onChunk || (() => { }),
                resolve: wrappedResolve,
                reject: wrappedReject
            });
            this.processQueue();
        });
    }
    async processQueue() {
        if (this.isProcessing || this.messageQueue.length === 0)
            return;
        if (!this.isConnected())
            return;
        this.isProcessing = true;
        const { text, onChunk, resolve, reject } = this.messageQueue.shift();
        console.log('[OpenClaw] Sending:', text.substring(0, 50) + '...');
        let responseBuffer = '';
        let messageHandler = null;
        let timeout = null;
        const cleanup = () => {
            if (messageHandler && this.ws) {
                this.ws.off('message', messageHandler);
            }
            if (timeout) {
                clearTimeout(timeout);
            }
            this.isProcessing = false;
            this.processQueue(); // Process next in queue
        };
        // Setup message handler for streaming response
        messageHandler = (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'chunk' || msg.type === 'delta') {
                    // Streaming chunk
                    const content = msg.content || msg.delta || '';
                    responseBuffer += content;
                    onChunk(content);
                }
                else if (msg.type === 'response' || msg.type === 'complete') {
                    // Complete response
                    const finalResponse = msg.content || responseBuffer || 'Nessuna risposta';
                    cleanup();
                    resolve(finalResponse);
                }
                else if (msg.type === 'error') {
                    cleanup();
                    reject(new Error(msg.message || 'OpenClaw error'));
                }
            }
            catch {
                // Non-JSON message - treat as plain text response
                const text = data.toString();
                responseBuffer += text;
                onChunk(text);
                // Assume complete after a short delay of no messages
                if (timeout)
                    clearTimeout(timeout);
                timeout = setTimeout(() => {
                    cleanup();
                    resolve(responseBuffer);
                }, 500);
            }
        };
        this.ws.on('message', messageHandler);
        // Send message with timeout for initial acknowledgment
        const sendTimeout = setTimeout(() => {
            cleanup();
            reject(new Error('OpenClaw send timeout'));
        }, 5000);
        try {
            this.ws.send(JSON.stringify({
                type: 'message',
                content: text
            }));
            clearTimeout(sendTimeout);
        }
        catch (error) {
            clearTimeout(sendTimeout);
            cleanup();
            reject(new Error('Failed to send message to OpenClaw'));
        }
    }
    handleMessage(data) {
        // Handled in processQueue per-request
    }
}
//# sourceMappingURL=openclaw-proxy.js.map