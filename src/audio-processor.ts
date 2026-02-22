import { spawn } from 'child_process';
import { config } from './config.js';
import FormData from 'form-data';

export class AudioProcessor {
  private chunks: Buffer[] = [];
  private sequenceNumbers: number[] = [];
  private transcriptionTimeout: number = 15000; // 15s max for transcription

  addChunk(data: Buffer, seq: number): void {
    const insertIndex = this.sequenceNumbers.findIndex(s => s > seq);
    if (insertIndex === -1) {
      this.chunks.push(data);
      this.sequenceNumbers.push(seq);
    } else {
      this.chunks.splice(insertIndex, 0, data);
      this.sequenceNumbers.splice(insertIndex, 0, seq);
    }
  }

  async transcribe(): Promise<string> {
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

  private async processTranscription(): Promise<string> {
    try {
      const wavBuffer = await this.convertLC3toWAV();
      return await this.whisperTranscribe(wavBuffer);
    } catch (error) {
      console.error('[Audio] Transcription error:', error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  reset(): void {
    this.chunks = [];
    this.sequenceNumbers = [];
  }

  private async convertLC3toWAV(): Promise<Buffer> {
    if (this.chunks.length === 0) {
      throw new Error('No audio data received');
    }

    const combined = Buffer.concat(this.chunks);
    
    try {
      return await this.convertWithFFmpeg(combined);
    } catch (ffmpegError) {
      console.warn('[Audio] FFmpeg failed:', ffmpegError);
      throw new Error('LC3 decoding requires ffmpeg. Install: brew install ffmpeg or apt-get install ffmpeg');
    }
  }

  private convertWithFFmpeg(lc3Buffer: Buffer): Promise<Buffer> {
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

      const chunks: Buffer[] = [];
      let errorOutput = '';
      
      ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
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

  private async whisperTranscribe(audioBuffer: Buffer): Promise<string> {
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
        body: form as unknown as BodyInit,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as { text: string };
      
      if (!data.text || data.text.trim().length === 0) {
        throw new Error('No speech detected in audio');
      }

      return data.text;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Whisper API timeout - try again');
      }
      throw error;
    }
  }
}
