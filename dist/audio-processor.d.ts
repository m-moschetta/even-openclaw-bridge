export declare class AudioProcessor {
    private chunks;
    private sequenceNumbers;
    private pcmChunks;
    private pcmSequenceNumbers;
    private transcriptionTimeout;
    private inputFormat;
    addChunk(data: Buffer, seq: number): void;
    addPcmChunk(data: Buffer, seq: number): void;
    transcribe(): Promise<string>;
    private processTranscription;
    reset(): void;
    private convertPCMtoWAV;
    private convertLC3toWAV;
    private convertWithFFmpeg;
    private whisperTranscribe;
}
//# sourceMappingURL=audio-processor.d.ts.map