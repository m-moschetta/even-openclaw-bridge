export declare class AudioProcessor {
    private chunks;
    private sequenceNumbers;
    private transcriptionTimeout;
    addChunk(data: Buffer, seq: number): void;
    transcribe(): Promise<string>;
    private processTranscription;
    reset(): void;
    private convertLC3toWAV;
    private convertWithFFmpeg;
    private whisperTranscribe;
}
//# sourceMappingURL=audio-processor.d.ts.map