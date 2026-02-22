import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
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
    openclawConnected: openclawProxy.isConnected()
  });
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
  ws.send(JSON.stringify({
    type: 'status',
    message: '🤖 Pronto'
  }));
});

async function handleGlassesMessage(message: any, ws: any) {
  switch (message.type) {
    case 'touchbar':
      await handleTouchbarEvent(message.event, ws);
      break;
    
    case 'audio_chunk':
      // Receive LC3 audio chunk
      audioProcessor.addChunk(
        Buffer.from(message.data, 'base64'),
        message.sequence
      );
      break;
    
    case 'audio_end':
      // Transcription complete
      await handleTranscription(ws);
      break;
    
    case 'text_input':
      // Fallback text input
      await processQuery(message.text, ws);
      break;
    
    default:
      console.log('[WS] Unknown message type:', message.type);
  }
}

async function handleTouchbarEvent(event: string, ws: any) {
  console.log('[Touchbar]', event);
  
  switch (event) {
    case 'LONG_PRESS_START':
      glassesManager.setState('LISTENING');
      audioProcessor.reset();
      ws.send(JSON.stringify({
        type: 'status',
        message: '🎤 Sto ascoltando...'
      }));
      // Tell glasses to start mic
      ws.send(JSON.stringify({ type: 'mic', enabled: true }));
      break;
    
    case 'LONG_PRESS_END':
      ws.send(JSON.stringify({ type: 'mic', enabled: false }));
      await handleTranscription(ws);
      break;
    
    case 'DOUBLE_TAP':
      glassesManager.reset();
      ws.send(JSON.stringify({
        type: 'clear'
      }));
      ws.send(JSON.stringify({
        type: 'status',
        message: '👋 Arrivederci'
      }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'clear' }));
      }, 2000);
      break;
    
    case 'TAP':
      // Page navigation
      const pageDelta = glassesManager.nextPage();
      if (pageDelta) {
        ws.send(JSON.stringify({
          type: 'display',
          text: pageDelta.text,
          page: pageDelta.page,
          total: pageDelta.total
        }));
      }
      break;
  }
}

async function handleTranscription(ws: any) {
  glassesManager.setState('TRANSCRIBING');
  ws.send(JSON.stringify({
    type: 'status',
    message: '⏳ Elaboro...'
  }));

  try {
    const text = await audioProcessor.transcribe();
    console.log('[Transcription]', text);
    glassesManager.setLastTranscription(text);
    await processQuery(text, ws);
  } catch (error) {
    console.error('[Transcription error]', error);
    ws.send(JSON.stringify({
      type: 'status',
      message: '❌ Errore trascrizione'
    }));
    glassesManager.setState('IDLE');
  }
}

async function processQuery(text: string, ws: any) {
  glassesManager.setState('WAITING');
  ws.send(JSON.stringify({
    type: 'status',
    message: '🤖 Rispondo...'
  }));

  try {
    const response = await openclawProxy.ask(text);
    console.log('[OpenClaw]', response.substring(0, 100) + '...');
    
    glassesManager.setLastResponse(response);
    glassesManager.setState('DISPLAYING');
    
    // Paginate and send first page
    const pages = glassesManager.paginateText(response);
    if (pages.length > 0) {
      ws.send(JSON.stringify({
        type: 'display',
        text: pages[0],
        page: 1,
        total: pages.length
      }));
    }

    // Auto-reset after 1 minute
    setTimeout(() => {
      if (glassesManager.getState() === 'DISPLAYING') {
        glassesManager.setState('IDLE');
        ws.send(JSON.stringify({
          type: 'status',
          message: '🤖 Pronto'
        }));
      }
    }, 60000);

  } catch (error) {
    console.error('[OpenClaw error]', error);
    ws.send(JSON.stringify({
      type: 'status',
      message: '❌ Errore risposta'
    }));
    glassesManager.setState('IDLE');
  }
}

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`🚀 Even OpenClaw Bridge running on port ${PORT}`);
  console.log(`📱 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`🌐 Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
