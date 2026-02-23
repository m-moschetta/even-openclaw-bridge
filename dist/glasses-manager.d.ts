type State = 'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'WAITING' | 'DISPLAYING';
interface ChatEntry {
    role: 'user' | 'assistant';
    text: string;
}
export declare class GlassesManager {
    private ws;
    private state;
    private pages;
    private currentPage;
    private lastTranscription;
    private lastResponse;
    private connectedAt;
    private chatHistory;
    setConnection(ws: any): void;
    clearConnection(): void;
    getConnectedCount(): number;
    getState(): State;
    setState(newState: State): void;
    getLastTranscription(): string;
    setLastTranscription(text: string): void;
    getLastResponse(): string;
    setLastResponse(text: string): void;
    getChatHistory(): ChatEntry[];
    getConnectedAt(): Date | null;
    getCurrentPage(): number;
    formatConversation(): string;
    paginateConversation(): string[];
    goToLastPage(): {
        text: string;
        page: number;
        total: number;
    } | null;
    paginateText(text: string): string[];
    nextPage(): {
        text: string;
        page: number;
        total: number;
    } | null;
    prevPage(): {
        text: string;
        page: number;
        total: number;
    } | null;
    goToFirstPage(): {
        text: string;
        page: number;
        total: number;
    } | null;
    reset(): void;
}
export {};
//# sourceMappingURL=glasses-manager.d.ts.map