import { spawn } from 'child_process';
import { config } from './config.js';
import FormData from 'form-data';
export class AudioProcessor {
    chunks = [];
    sequenceNumbers = [];
    pcmChunks = [];
    pcmSequenceNumbers = [];
    transcriptionTimeout = 15000; // 15s max for transcription
    inputFormat = 'lc3';
    addChunk(data, seq) {
        const insertIndex = this.sequenceNumbers.findIndex(s => s > seq);
        if (insertIndex === -1) {
            this.chunks.push(data);
            this.sequenceNumbers.push(seq);
        }
        else {
            this.chunks.splice(insertIndex, 0, data);
            this.sequenceNumbers.splice(insertIndex, 0, seq);
        }
        this.inputFormat = 'lc3';
    }
    addPcmChunk(data, seq) {
        const insertIndex = this.pcmSequenceNumbers.findIndex(s => s > seq);
        if (insertIndex === -1) {
            this.pcmChunks.push(data);
            this.pcmSequenceNumbers.push(seq);
        }
        else {
            this.pcmChunks.splice(insertIndex, 0, data);
            this.pcmSequenceNumbers.splice(insertIndex, 0, seq);
        }
        this.inputFormat = 'pcm';
    }
    async transcribe() {
        return new Promise((resolve, reject) => {
            // Timeout safety
            const timeout = setTimeout(() => {
                reject(new Error('Transcription timeout - audio too long or processing failed'));
            }, this.transcriptionTimeout);
            this.processTranscription()
                .then((text) => {
                clearTimeout(timeout);
                resolve(text);
            })
                .catch((error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
    async processTranscription() {
        try {
            let wavBuffer;
            if (this.inputFormat === 'pcm' && this.pcmChunks.length > 0) {
                wavBuffer = this.convertPCMtoWAV();
            }
            else {
                wavBuffer = await this.convertLC3toWAV();
            }
            return await this.whisperTranscribe(wavBuffer);
        }
        catch (error) {
            console.error('[Audio] Transcription error:', error);
            throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    reset() {
        this.chunks = [];
        this.sequenceNumbers = [];
        this.pcmChunks = [];
        this.pcmSequenceNumbers = [];
        this.inputFormat = 'lc3';
    }
    convertPCMtoWAV() {
        if (this.pcmChunks.length === 0) {
            throw new Error('No PCM audio data received');
        }
        const pcmData = Buffer.concat(this.pcmChunks);
        console.log(`[Audio] PCM data: ${pcmData.length} bytes, ${this.pcmChunks.length} chunks`);
        // G2 PCM format: 16kHz, 16-bit signed LE, mono
        const sampleRate = 16000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        // WAV header: 44 bytes
        const header = Buffer.alloc(44);
        header.write('RIFF', 0); // ChunkID
        header.writeUInt32LE(36 + pcmData.length, 4); // ChunkSize
        header.write('WAVE', 8); // Format
        header.write('fmt ', 12); // Subchunk1ID
        header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
        header.writeUInt16LE(1, 20); // AudioFormat (PCM = 1)
        header.writeUInt16LE(numChannels, 22); // NumChannels
        header.writeUInt32LE(sampleRate, 24); // SampleRate
        header.writeUInt32LE(byteRate, 28); // ByteRate
        header.writeUInt16LE(blockAlign, 32); // BlockAlign
        header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
        header.write('data', 36); // Subchunk2ID
        header.writeUInt32LE(pcmData.length, 40); // Subchunk2Size
        return Buffer.concat([header, pcmData]);
    }
    async convertLC3toWAV() {
        if (this.chunks.length === 0) {
            throw new Error('No audio data received');
        }
        const combined = Buffer.concat(this.chunks);
        try {
            return await this.convertWithFFmpeg(combined);
        }
        catch (ffmpegError) {
            console.warn('[Audio] FFmpeg failed:', ffmpegError);
            throw new Error('LC3 decoding requires ffmpeg. Install: brew install ffmpeg or apt-get install ffmpeg');
        }
    }
    convertWithFFmpeg(lc3Buffer) {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-hide_banner',
                '-loglevel', 'error',
                '-f', 'lc3',
                '-i', 'pipe:0',
                '-f', 'wav',
                '-ar', '16000',
                '-ac', '1',
                '-acodec', 'pcm_s16le',
                'pipe:1'
            ]);
            const chunks = [];
            let errorOutput = '';
            ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
            ffmpeg.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve(Buffer.concat(chunks));
                }
                else {
                    reject(new Error(`ffmpeg failed (code ${code}): ${errorOutput || 'Unknown error'}`));
                }
            });
            ffmpeg.on('error', (err) => {
                reject(new Error(`ffmpeg spawn error: ${err.message}`));
            });
            ffmpeg.stdin.write(lc3Buffer);
            ffmpeg.stdin.end();
        });
    }
    async whisperTranscribe(audioBuffer) {
        if (!config.openAiKey) {
            throw new Error('OPENAI_API_KEY not configured - transcription unavailable');
        }
        const form = new FormData();
        form.append('file', audioBuffer, {
            filename: 'audio.wav',
            contentType: 'audio/wav'
        });
        form.append('model', 'whisper-1');
        form.append('language', 'it');
        form.append('response_format', 'json');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s Whisper timeout
        try {
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.openAiKey}`,
                    ...form.getHeaders()
                },
                body: form,
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Whisper API error (${response.status}): ${errorText}`);
            }
            const data = await response.json();
            if (!data.text || data.text.trim().length === 0) {
                throw new Error('No speech detected in audio');
            }
            return data.text;
        }
        catch (error) {
            clearTimeout(timeout);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Whisper API timeout - try again');
            }
            throw error;
        }
    }
}
//# sourceMappingURL=audio-processor.js.map