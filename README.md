# Even G2 × OpenClaw Bridge

Bridge cloud per collegare Even Realities G2 smart glasses a OpenClaw AI assistant.

## 🏗️ Architettura

```
┌─────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌──────────┐
│  Even G2    │ ◄────────────────► │  Bridge      │ ◄────────────────► │ OpenClaw │
│  Glasses    │                    │  (Cloud)     │                    │  Gateway │
└─────────────┘                    └──────────────┘                    └──────────┘
                                          │
                                          ▼
                                    ┌──────────────┐
                                    │  Whisper API │
                                    │  (OpenAI)    │
                                    └──────────────┘
```

## ✨ Features

- **Cloud-deployed**: Accessibile da ovunque, non solo localhost
- **WebSocket bidirezionale**: Comunicazione real-time con gli occhiali
- **Audio LC3 → Whisper**: Trascrizione italiana
- **Streaming response**: Parole visualizzate man mano che arrivano da OpenClaw
- **Dashboard web**: Monitora stato, testa comandi, vedi log
- **Paginazione display**: Gestione testi lunghi su HUD con navigazione tap
- **State machine**: IDLE → LISTENING → TRANSCRIBING → WAITING → DISPLAYING
- **Error handling completo**: Try/catch ovunque, messaggi chiari nel HUD
- **Timeout management**: 30s recording max, 15s transcription, 30s OpenClaw response

## 🚀 Deploy Rapido

### 1. Render (Consigliato)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YOUR_USERNAME/even-openclaw-bridge)

Oppure manualmente:

```bash
# 1. Forka o clona questo repo
git clone https://github.com/YOUR_USERNAME/even-openclaw-bridge.git

# 2. Crea nuovo servizio su render.com
# - Type: Web Service
# - Build: npm install && npm run build
# - Start: npm start
# - Environment: Node

# 3. Configura env vars in Render Dashboard:
# - OPENAI_API_KEY=sk-...
# - OPENCLAW_WS=wss://your-openclaw.com (o ws://IP:PORT)
```

### 2. Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login e deploy
railway login
railway init
railway up

# Configura variables
railway variables set OPENAI_API_KEY=sk-...
railway variables set OPENCLAW_WS=ws://...
```

### 3. VPS/Dedicated

```bash
# 1. Clone e install
git clone https://github.com/YOUR_USERNAME/even-openclaw-bridge.git
cd even-openclaw-bridge
npm install
npm run build

# 2. Crea .env
cp .env.example .env
# Modifica con le tue chiavi

# 3. Installa ffmpeg (per LC3 decoding)
# Ubuntu/Debian:
sudo apt-get install ffmpeg
# macOS:
brew install ffmpeg

# 4. Avvia
npm start

# 5. (Optional) PM2 per production
npm install -g pm2
pm2 start dist/server.js --name even-bridge
```

## 📱 Configurazione Even G2

### Prerequisiti
- Even Realities G2 (hardware)
- Beta app Even Realities (TestFlight/Google Play — non quella normale)
- Accesso al Discord Even Realities (per troubleshooting)

### Setup Plugin

1. **Installa Even Hub CLI**:
```bash
npm install -g @evenrealities/evenhub-cli
```

2. **Configura il plugin** per puntare al tuo bridge:
```javascript
// plugin-config.js
export default {
  name: 'OpenClaw Bridge',
  websocketUrl: 'wss://your-app.onrender.com/ws',
  
  onStart(ctx) {
    console.log('Plugin started');
  },
  
  onTouchBarEvent(event, ctx) {
    // Forward events to bridge
    ctx.ws.send(JSON.stringify({
      type: 'touchbar',
      event: event  // LONG_PRESS_START, LONG_PRESS_END, DOUBLE_TAP, TAP
    }));
  },
  
  onAudioData(data, seq, ctx) {
    // Forward audio chunks
    ctx.ws.send(JSON.stringify({
      type: 'audio_chunk',
      data: data.toString('base64'),
      sequence: seq
    }));
  }
};
```

3. **Flash sulle G2**:
```bash
evenhub-cli start
```

## 🎯 Interazioni G2

| Gesture | Azione |
|---------|--------|
| **Long Press** | Attiva registrazione audio (🎤 Sto ascoltando...) |
| **Release Long Press** | Ferma registrazione, invia a OpenClaw (⏳ Elaboro...) |
| **Double Tap** | Annulla / Esci (👋 Arrivederci) |
| **Tap** | Pagina successiva (quando visualizzando risposta) |

## 🔌 API Endpoints

| Endpoint | Method | Descrizione |
|----------|--------|-------------|
| `/health` | GET | Stato sistema |
| `/api/session` | GET | Stato sessione corrente |
| `/api/command` | POST | Invia comando testuale |
| `/api/reset` | POST | Resetta sessione |
| `/ws` | WS | WebSocket per Even G2 |

### WebSocket Message Format

**Client → Server:**
```json
{ "type": "touchbar", "event": "LONG_PRESS_START" }
{ "type": "audio_chunk", "data": "base64...", "sequence": 0 }
{ "type": "audio_end" }
{ "type": "text_input", "text": "messaggio di test" }
```

**Server → Client:**
```json
{ "type": "status", "message": "🤖 Pronto" }
{ "type": "display", "text": "risposta...", "page": 1, "total": 3 }
{ "type": "mic", "enabled": true }
{ "type": "clear" }
{ "type": "error", "message": "❌ Errore" }
```

## 🧪 Test su Hardware Reale (Fase 6)

### Test Progressivi

1. **Test text sending** (hardcoded):
   ```javascript
   // Invia dal server al G2
   ws.send(JSON.stringify({
     type: 'display',
     text: 'Test OK',
     page: 1,
     total: 1
   }));
   ```

2. **Test mic activation**:
   - Long press → dovrebbe apparire "🎤 Sto ascoltando..."
   - Verifica nel log server che arrivino audio_chunk

3. **Test trascrizione**:
   - Parla chiaramente per 3-5 secondi
   - Rilascia long press
   - Verifica "⏳ Elaboro..." → ricezione testo

4. **Test OpenClaw response**:
   - La risposta dovrebbe apparire nel HUD
   - Verifica streaming (parole che appaiono progressivamente)

5. **Test end-to-end**:
   - Flusso completo: touch → audio → trascrizione → OpenClaw → display

### Calibrazione Display (Fase 6.3)

Modifica `src/config.ts` per adattare al G2:

```typescript
export const config = {
  displayWidth: 488,    // Valore demo, potrebbe variare
  linesPerScreen: 5,    // Default, meno = font più grande
  fontSize: 21,         // Sperimenta 18-24 per leggibilità
};
```

Testa con testi lunghi e corti per trovare il bilanciamento ottimale.

## 🎨 UX Refinements (Fase 7)

### 7.1 Feedback Visivo Immediato ✅
Implementato: subito dopo long press appare "🎤 Sto ascoltando..."

### 7.2 Risposta in Streaming ✅
Implementato: parole appaiono man mano che arrivano da OpenClaw

### 7.3 Navigazione Pagine ✅
Implementato: tap durante DISPLAYING per cambiare pagina

### 7.4 Timeout ✅
Implementati:
- Recording: 30s max
- Transcription: 15s max
- OpenClaw: 30s max
- Auto-reset: 60s dopo display

## ⚠️ Possibili Blocchi

### LC3 Decoding
- **Problema**: LC3 non è supportato nativamente da Whisper
- **Soluzione**: ffmpeg come fallback
- **Fallback**: Se ffmpeg non disponibile, errore chiaro nel HUD

### WebSocket OpenClaw
- **Problema**: Protocollo non documentato pubblicamente
- **Soluzione**: Reverse engineering dal codice sorgente OpenClaw
- **Implementazione**: Supporta JSON messages (chunk, response, complete)

### Latenza Totale
- **Attesa**: 3-5 secondi tipici (Mic → STT → OpenClaw → Display)
- **Gestione**: Feedback intermedi nel HUD per non far pensare a crash
  - "🎤 Sto ascoltando..."
  - "⏳ Elaboro..."
  - "🤖 Rispondo..."

## 💻 Sviluppo Locale

```bash
# 1. Installa dipendenze
npm install

# 2. Configura env
cp .env.example .env
# Aggiungi OPENAI_API_KEY e verifica OPENCLAW_WS

# 3. Installa ffmpeg
brew install ffmpeg  # macOS
# oppure
sudo apt-get install ffmpeg  # Ubuntu

# 4. Dev mode (hot reload)
npm run dev

# 5. Apri http://localhost:3000 per dashboard
```

## 🌐 Dashboard

Dopo il deploy avrai:
- **Dashboard**: `https://even-openclaw-bridge.onrender.com`
- **WebSocket**: `wss://even-openclaw-bridge.onrender.com/ws`
- **Health API**: `https://even-openclaw-bridge.onrender.com/health`

La dashboard mostra:
- Stato connessione (Server, Occhiali, OpenClaw)
- Sessione attiva (stato, ultima trascrizione, ultima risposta)
- Test manuale (invia comandi testuali)
- Log in tempo reale

## 📊 Timeline Realistica

| Giorno | Obiettivo |
|--------|-----------|
| 1 | Setup + comprensione SDK + primo plugin visibile nel simulatore |
| 2 | Plugin scheletro con eventi touchbar funzionanti |
| 3 | Audio pipeline + Whisper integration |
| 4 | OpenClaw client + integrazione completa in simulatore |
| 5 | Test su hardware reale + fix bug |
| 6 | UX polish + stabilità |

Se il LC3 decoding si blocca, aggiungi 1-2 giorni.

## 📝 TODO / Roadmap

- [x] Server Express con WebSocket
- [x] Audio pipeline LC3 → Whisper
- [x] OpenClaw proxy con streaming
- [x] State machine completa
- [x] Error handling robusto
- [x] Timeout management
- [x] Dashboard web
- [x] Render deployment config
- [ ] Integrazione SDK Even Hub ufficiale (quando disponibile)
- [ ] LC3 native decoder (senza ffmpeg)
- [ ] Autenticazione WebSocket (API key)
- [ ] Sessioni multi-utente
- [ ] History conversazioni persistente

## 📄 License

MIT
