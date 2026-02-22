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
- **Dashboard web**: Monitora stato, testa comandi, vedi log
- **Paginazione display**: Gestione testi lunghi su HUD
- **State machine**: IDLE → LISTENING → TRANSCRIBING → WAITING → DISPLAYING

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

1. **Installa Even Hub CLI**:
```bash
npm install -g @evenrealities/evenhub-cli
```

2. **Configura il plugin** per puntare al tuo bridge:
```javascript
// even-config.js
export default {
  plugins: [{
    name: 'OpenClaw Bridge',
    websocketUrl: 'wss://your-app.onrender.com/ws'
  }]
}
```

3. **Flash sulle G2**:
```bash
evenhub-cli start
```

## 🔌 API Endpoints

| Endpoint | Method | Descrizione |
|----------|--------|-------------|
| `/health` | GET | Stato sistema |
| `/api/session` | GET | Stato sessione corrente |
| `/api/command` | POST | Invia comando testuale |
| `/api/reset` | POST | Resetta sessione |
| `/ws` | WS | WebSocket per Even G2 |

## 💻 Sviluppo Locale

```bash
# 1. Installa dipendenze
npm install

# 2. Configura env
cp .env.example .env
# Aggiungi OPENAI_API_KEY

# 3. Dev mode (hot reload)
npm run dev

# 4. Apri http://localhost:3000 per dashboard
```

## 🎯 Interazioni G2

| Gesture | Azione |
|---------|--------|
| **Long Press** | Attiva registrazione audio |
| **Release Long Press** | Ferma registrazione, invia a OpenClaw |
| **Double Tap** | Annulla / Esci |
| **Tap** | Pagina successiva (quando visualizzando risposta) |

## 📝 TODO / Roadmap

- [ ] Integrazione SDK Even Hub ufficiale
- [ ] LC3 native decoder (senza ffmpeg)
- [ ] Autenticazione WebSocket (API key)
- [ ] Sessioni multi-utente
- [ ] History conversazioni
- [ ] Streaming risposte (parola per parola)

## ⚠️ Note

- **LC3 Decoding**: Richiede ffmpeg installato sul server
- **OpenClaw Gateway**: Deve essere accessibile pubblicamente (o stessa rete del server)
- **Whisper**: Richiede API key OpenAI (costo ~$0.006/minuto di audio)

## 📄 License

MIT
