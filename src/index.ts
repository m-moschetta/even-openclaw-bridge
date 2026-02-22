import { GlassesDisplay } from './glasses.js';
import { AudioPipeline, getTextInputFallback } from './audio.js';
import { OpenClawClient } from './openclaw.js';
import { config } from './config.js';

type State = 'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'WAITING' | 'DISPLAYING';

// Plugin context interface (simplified - actual SDK may differ)
interface PluginContext {
  enableMic: (enabled: boolean) => Promise<void>;
  onAudioData?: (callback: (data: Buffer, seq: number) => void) => void;
}

// Global state
let state: State = 'IDLE';
const glasses = new GlassesDisplay();
const audioPipeline = new AudioPipeline();
const openClawClient = new OpenClawClient();
let useFallbackInput = false; // Set to true if LC3 decoding fails

// Plugin definition
const OpenClawBridgePlugin = {
  name: 'OpenClaw Bridge',
  version: '1.0.0',

  async onStart(ctx: PluginContext) {
    console.log('[Plugin]: OpenClaw Bridge started');
    
    try {
      await openClawClient.connect();
      await glasses.showStatus('🤖 Pronto');
    } catch (error) {
      console.error('[Plugin]: Failed to connect to OpenClaw:', error);
      await glasses.showStatus('❌ Errore connessione');
    }

    // Setup audio data handler if available
    if (ctx.onAudioData) {
      ctx.onAudioData((data: Buffer, seq: number) => {
        if (state === 'LISTENING') {
          audioPipeline.addChunk(data, seq);
        }
      });
    }
  },

  async onTouchBarEvent(event: string, ctx: PluginContext) {
    console.log(`[Plugin]: Touchbar event ${event}`);

    switch (event) {
      case 'LONG_PRESS_START':
        await handleActivation(ctx);
        break;
      case 'LONG_PRESS_END':
        await handleRecordingEnd(ctx);
        break;
      case 'DOUBLE_TAP':
        await handleExit(ctx);
        break;
      case 'TAP':
        // Navigate pages during DISPLAYING state
        if (state === 'DISPLAYING') {
          await handlePageNavigation();
        }
        break;
    }
  },

  async onStop() {
    console.log('[Plugin]: Stopping');
    openClawClient.disconnect();
  }
};

// State handlers
async function handleActivation(ctx: PluginContext): Promise<void> {
  if (state !== 'IDLE') {
    console.log(`[Plugin]: Ignoring activation, current state: ${state}`);
    return;
  }

  try {
    state = 'LISTENING';
    await glasses.showStatus('🎤 Sto ascoltando...');
    audioPipeline.reset();
    
    if (!useFallbackInput) {
      await ctx.enableMic(true);
    }

    // Timeout safety
    setTimeout(() => {
      if (state === 'LISTENING') {
        console.log('[Plugin]: Recording timeout');
        handleRecordingEnd(ctx).catch(console.error);
      }
    }, config.maxRecordingMs);

  } catch (error) {
    console.error('[Plugin]: Activation error:', error);
    await handleError('Errore attivazione');
  }
}

async function handleRecordingEnd(ctx: PluginContext): Promise<void> {
  if (state !== 'LISTENING') return;

  try {
    state = 'TRANSCRIBING';
    await ctx.enableMic(false);
    await glasses.showStatus('⏳ Elaboro...');

    let text: string;

    if (useFallbackInput) {
      // Use CLI fallback for testing
      text = await getTextInputFallback();
    } else {
      // Use audio transcription
      text = await audioPipeline.transcribe();
    }

    if (!text.trim()) {
      await handleError('Nessun audio rilevato');
      return;
    }

    console.log(`[Plugin]: Transcribed: "${text}"`);
    await processQuery(text);

  } catch (error) {
    console.error('[Plugin]: Transcription error:', error);
    
    // If LC3 decoding fails, suggest fallback mode
    if (error instanceof Error && error.message.includes('LC3')) {
      useFallbackInput = true;
      await glasses.showStatus('⚠️ Audio non disponibile');
      console.log('[Plugin]: Switched to fallback input mode');
    } else {
      await handleError('Errore trascrizione');
    }
  }
}

async function processQuery(text: string): Promise<void> {
  try {
    state = 'WAITING';
    await glasses.showStatus('🤖 Rispondo...');

    const response = await openClawClient.ask(text);
    
    state = 'DISPLAYING';
    await glasses.sendText(response);

    // Auto-reset after display timeout
    setTimeout(() => {
      if (state === 'DISPLAYING') {
        state = 'IDLE';
        glasses.showStatus('🤖 Pronto').catch(console.error);
      }
    }, 60000); // Reset after 1 minute

  } catch (error) {
    console.error('[Plugin]: Query error:', error);
    await handleError('Errore risposta');
  }
}

async function handleExit(ctx: PluginContext): Promise<void> {
  console.log('[Plugin]: Exit requested');
  
  try {
    if (state === 'LISTENING') {
      await ctx.enableMic(false);
    }
    
    await glasses.clearDisplay();
    await glasses.showStatus('👋 Arrivederci');
    
    state = 'IDLE';
    
    // Clear status after a moment
    setTimeout(() => {
      glasses.clearDisplay().catch(console.error);
    }, 2000);
    
  } catch (error) {
    console.error('[Plugin]: Exit error:', error);
    state = 'IDLE';
  }
}

async function handlePageNavigation(): Promise<void> {
  // TODO: Implement page up/down based on touch patterns
  // For now, just advance to next page if available
  if (glasses.hasMorePages) {
    await glasses.nextPage();
  }
}

async function handleError(message: string): Promise<void> {
  await glasses.showStatus(`❌ ${message}`);
  state = 'IDLE';
  
  // Clear error after 3 seconds
  setTimeout(() => {
    if (state === 'IDLE') {
      glasses.showStatus('🤖 Pronto').catch(console.error);
    }
  }, 3000);
}

// Export for Even Hub SDK
export default OpenClawBridgePlugin;

// Also export for direct testing
export { OpenClawBridgePlugin };
