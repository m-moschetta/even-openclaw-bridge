import { spawn } from 'child_process';
import { config } from './config.js';
import FormData from 'form-data';

export class AudioPipeline {
  private chunks: Buffer[] = [];
  private sequenceNumbers: number[] = [];

  addChunk(data: Buffer, seq: number): void {
    // Insert in correct order based on sequence number
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
      console.error('Transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  reset(): void {
    this.chunks = [];
    this.sequenceNumbers = [];
  }

  private async convertLC3toWAV(): Promise<Buffer> {
    // Combine all chunks
    const combined = Buffer.concat(this.chunks);
    
    // Try ffmpeg conversion first
    try {
      return await this.convertWithFFmpeg(combined);
    } catch (ffmpegError) {
      console.warn('FFmpeg conversion failed, trying fallback:', ffmpegError);
      
      // Fallback: assume input is already raw PCM or try direct
      // This is a placeholder - actual LC3 decoding requires proper implementation
      throw new Error('LC3 decoding not implemented. Install ffmpeg or provide LC3 decoder.');
    }
  }

  private convertWithFFmpeg(lc3Buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'lc3',           // Input format LC3
        '-i', 'pipe:0',        // Read from stdin
        '-f', 'wav',           // Output format WAV
        '-ar', '16000',        // Sample rate 16kHz (Whisper optimal)
        '-ac', '1',            // Mono
        'pipe:1'               // Write to stdout
      ]);

      const chunks: Buffer[] = [];
      
      ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
      ffmpeg.stderr.on('data', (data) => {
        console.log(`[ffmpeg]: ${data}`);
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
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-1');
    form.append('language', 'it'); // Italian transcription

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

// Fallback CLI input for testing without audio
export async function getTextInputFallback(): Promise<string> {
  const readline = await import('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('🎤 Enter text (fallback mode): ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
