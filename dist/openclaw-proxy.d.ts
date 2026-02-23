export declare class OpenClawProxy {
    private baseUrl;
    private password;
    constructor();
    isConnected(): boolean;
    ask(text: string, onChunk?: (chunk: string) => void): Promise<string>;
}
//# sourceMappingURL=openclaw-proxy.d.ts.map