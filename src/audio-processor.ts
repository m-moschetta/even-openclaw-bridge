import { spawn } from 'child_process';
import { config } from './config.js';
import FormData from 'form-data';

export class AudioProcessor {
  private chunks: Buffer[] = [];
  private sequenceNumbers: number[] = [];

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
    try {
      const wavBuffer = await this.convertLC3toWAV();
      return await this.whisperTranscribe(wavBuffer);
    } catch (error) {
      console.error('[Audio] Transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  reset(): void {
    this.chunks = [];
    this.sequenceNumbers = [];
  }

  private async convertLC3toWAV(): Promise<Buffer> {
    const combined = Buffer.concat(this.chunks);
    
    try {
      return await this.convertWithFFmpeg(combined);
    } catch (ffmpegError) {
      console.warn('[Audio] FFmpeg failed:', ffmpegError);
      throw new Error('LC3 decoding requires ffmpeg. Install: brew install ffmpeg');
    }
  }

  private convertWithFFmpeg(lc3Buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'lc3',
        '-i', 'pipe:0',
        '-f', 'wav',
        '-ar', '16000',
        '-ac', '1',
        'pipe:1'
      ]);

      const chunks: Buffer[] = [];
      
      ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
      ffmpeg.stderr.on('data', (data) => {
        // ffmpeg outputs to stderr even on success
        console.log(`[ffmpeg] ${data}`);
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
      
      ffmpeg.stdin.write(lc3Buffer);
      ffmpeg.stdin.end();
    });
  }

  private async whisperTranscribe(audioBuffer: Buffer): Promise<string> {
    if (!config.openAiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const form = new FormData();
    form.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-1');
    form.append('language', 'it');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openAiKey}`,
        ...form.getHeaders()
      },
      body: form as unknown as BodyInit
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const data = await response.json() as { text: string };
    return data.text;
  }
}
