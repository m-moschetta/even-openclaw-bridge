type State = 'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'WAITING' | 'DISPLAYING';
export declare class GlassesManager {
    private ws;
    private state;
    private pages;
    private currentPage;
    private lastTranscription;
    private lastResponse;
    private connectedAt;
    setConnection(ws: any): void;
    clearConnection(): void;
    getConnectedCount(): number;
    getState(): State;
    setState(newState: State): void;
    getLastTranscription(): string;
    setLastTranscription(text: string): void;
    getLastResponse(): string;
    setLastResponse(text: string): void;
    getConnectedAt(): Date | null;
    getCurrentPage(): number;
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