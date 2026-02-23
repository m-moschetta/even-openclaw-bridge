import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GlassesManager } from './glasses-manager.js';
import { OpenClawProxy } from './openclaw-proxy.js';
import { AudioProcessor } from './audio-processor.js';
import { config } from './config.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Managers
const glassesManager = new GlassesManager();
const openclawProxy = new OpenClawProxy();
const audioProcessor = new AudioProcessor();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    glassesConnected: glassesManager.getConnectedCount(),
    openclawConnected: openclawProxy.isConnected(),
    sessionState: glassesManager.getState()
  });
});

// Even Hub web app endpoint - serves the G2 app with correct WebSocket URL
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.get('/app', (req, res) => {
  const host = req.headers.host || 'localhost:3000';
  const wsProtocol = host.includes('onrender.com') || host.includes('ngrok') ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${host}/ws`;

  // Try multiple paths: from dist/ or from project root
  const candidates = [
    join(__dirname, '..', 'public', 'app.html'),
    join(__dirname, 'public', 'app.html'),
    join(process.cwd(), 'public', 'app.html')
  ];

  let html = '';
  for (const p of candidates) {
    try {
      html = readFileSync(p, 'utf8');
      break;
    } catch {}
  }

  if (!html) {
    console.error('[App] app.html not found in:', candidates);
    return res.status(500).send('app.html not found');
  }

  html = html.replace('%%WS_URL%%', wsUrl);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Legacy plugin endpoint - redirect to new web app
app.get('/plugin', (req, res) => {
  res.redirect('/app');
});

// QR Code redirect endpoint
app.get('/qr-plugin', (req, res) => {
  res.redirect('/app');
});

// Get current session status
app.get('/api/session', (req, res) => {
  res.json({
    state: glassesManager.getState(),
    lastTranscription: glassesManager.getLastTranscription(),
    lastResponse: glassesManager.getLastResponse(),
    connectedAt: glassesManager.getConnectedAt()
  });
});

// Send text command (for testing without glasses)
app.post('/api/command', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }

  try {
    const response = await openclawProxy.ask(text);
    res.json({ success: true, response });
  } catch (error) {
    console.error('[API] Command error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Reset session
app.post('/api/reset', (req, res) => {
  glassesManager.reset();
  res.json({ success: true });
});

// WebSocket connection from Even G2 glasses
wss.on('connection', (ws, req) => {
  console.log('[WS] Glasses connected from:', req.socket.remoteAddress);
  
  glassesManager.setConnection(ws);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      await handleGlassesMessage(message, ws);
    } catch (error) {
      console.error('[WS] Message error:', error);
      sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    console.log('[WS] Glasses disconnected');
    glassesManager.clearConnection();
  });

  ws.on('error', (error) => {
    console.error('[WS] Error:', error);
  });

  // Send welcome
  sendStatus(ws, '🤖 Pronto');
});

// Send helpers
function sendStatus(ws: any, message: string) {
  ws.send(JSON.stringify({ type: 'status', message }));
}

function sendError(ws: any, message: string) {
  ws.send(JSON.stringify({ type: 'error', message }));
}

function sendDisplay(ws: any, text: string, page: number, total: number) {
  ws.send(JSON.stringify({ type: 'display', text, page, total }));
}

function sendMic(ws: any, enabled: boolean) {
  ws.send(JSON.stringify({ type: 'mic', enabled }));
}

function sendClear(ws: any) {
  ws.send(JSON.stringify({ type: 'clear' }));
}

function sendChatUpdate(ws: any, role: 'user' | 'assistant', text: string) {
  ws.send(JSON.stringify({ type: 'chat_update', role, text }));
}

async function handleGlassesMessage(message: any, ws: any) {
  try {
    switch (message.type) {
      case 'touchbar':
        await handleTouchbarEvent(message.event, ws);
        break;
      
      case 'audio_chunk':
        // Receive LC3 audio chunk (legacy plugin)
        audioProcessor.addChunk(
          Buffer.from(message.data, 'base64'),
          message.sequence
        );
        break;

      case 'audio_pcm':
        // Receive PCM audio chunk from Even Hub web app
        audioProcessor.addPcmChunk(
          Buffer.from(message.data, 'base64'),
          message.sequence
        );
        break;
      
      case 'audio_end':
        // Transcription complete
        await handleTranscription(ws);
        break;
      
      case 'page_prev':
        // Previous page navigation from web app scroll
        if (glassesManager.getState() === 'DISPLAYING') {
          const prevPage = glassesManager.prevPage();
          if (prevPage) {
            sendDisplay(ws, prevPage.text, prevPage.page, prevPage.total);
          }
        }
        break;

      case 'text_input':
        // Fallback text input
        await processQuery(message.text, ws);
        break;
      
      default:
        console.log('[WS] Unknown message type:', message.type);
    }
  } catch (error) {
    console.error('[WS] Handler error:', error);
    sendError(ws, error instanceof Error ? error.message : 'Unknown error');
    glassesManager.setState('IDLE');
  }
}

async function handleTouchbarEvent(event: string, ws: any) {
  console.log('[Touchbar]', event);
  
  try {
    switch (event) {
      case 'LONG_PRESS_START':
        await handleActivation(ws);
        break;
      
      case 'LONG_PRESS_END':
        await handleRecordingEnd(ws);
        break;
      
      case 'DOUBLE_TAP':
        await handleExit(ws);
        break;
      
      case 'TAP':
        // Page navigation during DISPLAYING
        if (glassesManager.getState() === 'DISPLAYING') {
          await handlePageNavigation(ws);
        }
        break;
    }
  } catch (error) {
    console.error('[Touchbar] Error:', error);
    sendError(ws, 'Operation failed');
    glassesManager.setState('IDLE');
  }
}

async function handleActivation(ws: any) {
  const currentState = glassesManager.getState();
  if (currentState !== 'IDLE' && currentState !== 'DISPLAYING') {
    console.log('[Activation] Ignored - state is', currentState);
    return;
  }

  try {
    glassesManager.setState('LISTENING');
    audioProcessor.reset();
    
    // 7.1 Immediate feedback - show something right away
    sendStatus(ws, '🎤 Sto ascoltando...');
    sendMic(ws, true);

    // Safety timeout - max 30 seconds recording
    setTimeout(() => {
      if (glassesManager.getState() === 'LISTENING') {
        console.log('[Activation] Recording timeout - auto stopping');
        sendMic(ws, false);
        handleRecordingEnd(ws).catch(err => {
          console.error('[Activation] Timeout handler error:', err);
        });
      }
    }, 30000);

  } catch (error) {
    console.error('[Activation] Error:', error);
    sendError(ws, 'Errore attivazione');
    glassesManager.setState('IDLE');
  }
}

// Alias for audio_end event - same as handleRecordingEnd
async function handleTranscription(ws: any) {
  return handleRecordingEnd(ws);
}

async function handleRecordingEnd(ws: any) {
  if (glassesManager.getState() !== 'LISTENING') {
    console.log('[RecordingEnd] Ignored - not in LISTENING state');
    return;
  }

  try {
    glassesManager.setState('TRANSCRIBING');
    sendMic(ws, false);
    sendStatus(ws, '⏳ Elaboro...');

    // 7.4 Timeout handling - transcription
    let text: string;
    try {
      text = await audioProcessor.transcribe();
    } catch (transError) {
      console.error('[RecordingEnd] Transcription failed:', transError);
      
      // Check if it's a specific error we can handle
      const errorMsg = transError instanceof Error ? transError.message : 'Unknown error';
      
      if (errorMsg.includes('ffmpeg')) {
        sendError(ws, '❌ Audio codec error');
      } else if (errorMsg.includes('timeout')) {
        sendError(ws, '❌ Troppo lento - riprova');
      } else if (errorMsg.includes('speech')) {
        sendError(ws, '❌ Non ho capito - riprova');
      } else {
        sendError(ws, '❌ Errore trascrizione');
      }
      
      glassesManager.setState('IDLE');
      return;
    }

    if (!text || text.trim().length === 0) {
      sendError(ws, '❌ Nessun audio rilevato');
      glassesManager.setState('IDLE');
      return;
    }

    console.log('[RecordingEnd] Transcribed:', text);
    glassesManager.setLastTranscription(text);
    sendChatUpdate(ws, 'user', text);

    // Show conversation with new user message
    glassesManager.paginateConversation();
    const lastPage = glassesManager.goToLastPage();
    if (lastPage) {
      sendDisplay(ws, lastPage.text, lastPage.page, lastPage.total);
    }

    await processQuery(text, ws);

  } catch (error) {
    console.error('[RecordingEnd] Unexpected error:', error);
    sendError(ws, '❌ Errore elaborazione');
    glassesManager.setState('IDLE');
  }
}

async function processQuery(text: string, ws: any) {
  try {
    glassesManager.setState('WAITING');

    // Show conversation so far + loading indicator at the bottom
    const waitingText = glassesManager.formatConversation() + '\n...';
    glassesManager.paginateText(waitingText);
    const waitLast = glassesManager.goToLastPage();
    if (waitLast) {
      sendDisplay(ws, waitLast.text, waitLast.page, waitLast.total);
    }

    let response: string;
    try {
      response = await openclawProxy.ask(text);
    } catch (openclawError) {
      console.error('[ProcessQuery] OpenClaw error:', openclawError);

      const errorMsg = openclawError instanceof Error ? openclawError.message : '';

      if (errorMsg.includes('timeout')) {
        sendError(ws, '❌ OpenClaw lento - riprova');
      } else if (errorMsg.includes('connect')) {
        sendError(ws, '❌ OpenClaw offline');
      } else {
        sendError(ws, '❌ Errore risposta');
      }

      glassesManager.setState('IDLE');
      return;
    }

    console.log('[ProcessQuery] Response:', response.substring(0, 100) + '...');

    glassesManager.setLastResponse(response);
    sendChatUpdate(ws, 'assistant', response);
    glassesManager.setState('DISPLAYING');

    // Paginate the full conversation and show the last page
    glassesManager.paginateConversation();
    const lastPage = glassesManager.goToLastPage();
    if (lastPage) {
      sendDisplay(ws, lastPage.text, lastPage.page, lastPage.total);
    }

    // Auto-reset after 5 minutes of inactivity
    setTimeout(() => {
      if (glassesManager.getState() === 'DISPLAYING') {
        console.log('[ProcessQuery] Auto-reset after timeout');
        glassesManager.setState('IDLE');
        sendStatus(ws, '🤖 Pronto');
      }
    }, 300000);

  } catch (error) {
    console.error('[ProcessQuery] Unexpected error:', error);
    sendError(ws, '❌ Errore imprevisto');
    glassesManager.setState('IDLE');
  }
}

async function handlePageNavigation(ws: any) {
  try {
    // 7.3 Page navigation - cycle through pages
    const nextPage = glassesManager.nextPage();
    if (nextPage) {
      sendDisplay(ws, nextPage.text, nextPage.page, nextPage.total);
    } else {
      // Back to first page if at end
      const firstPage = glassesManager.goToFirstPage();
      if (firstPage) {
        sendDisplay(ws, firstPage.text, firstPage.page, firstPage.total);
      }
    }
  } catch (error) {
    console.error('[PageNav] Error:', error);
  }
}

async function handleExit(ws: any) {
  console.log('[Exit] Exit requested');
  
  try {
    // Stop mic if recording
    if (glassesManager.getState() === 'LISTENING') {
      sendMic(ws, false);
    }
    
    sendClear(ws);
    sendStatus(ws, '👋 Arrivederci');
    
    glassesManager.reset();
    
    // Clear status after 2 seconds
    setTimeout(() => {
      sendClear(ws);
    }, 2000);
    
  } catch (error) {
    console.error('[Exit] Error:', error);
    glassesManager.reset();
  }
}

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`🚀 Even OpenClaw Bridge running on port ${PORT}`);
  console.log(`📱 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`🔍 Health: http://localhost:${PORT}/health`);
  console.log(`⚙️  Config: OpenClaw=${config.openClawWs}, Whisper=${config.openAiKey ? '✅' : '❌'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Keep running but log
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  // Keep running but log
});
// Force redeploy Mon Feb 23 14:08:19 CET 2026
