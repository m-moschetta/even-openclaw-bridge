export declare class OpenClawProxy {
    private ws;
    private messageQueue;
    private isProcessing;
    private reconnectAttempts;
    private maxReconnectAttempts;
    constructor();
    private connect;
    private scheduleReconnect;
    isConnected(): boolean;
    ask(text: string, onChunk?: (chunk: string) => void): Promise<string>;
    private processQueue;
    private handleMessage;
}
//# sourceMappingURL=openclaw-proxy.d.ts.map