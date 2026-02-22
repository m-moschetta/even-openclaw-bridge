# Even G2 × OpenClaw Bridge

Plugin per Even Realities G2 che collega gli occhiali smart a OpenClaw AI assistant.

## Setup

```bash
npm install
```

## Environment Variables

Crea un file `.env`:

```
OPENAI_API_KEY=sk-...
OPENCLAW_WS=ws://127.0.0.1:18789
```

## Uso

```bash
npm run dev    # Development mode con hot reload
npm run build  # Build produzione
npm start      # Esegui build
```

## Interazioni

- **Long press** sul touchbar: attiva registrazione
- **Double tap** sul touchbar: annulla/uscita

## Architettura

- `config.ts` - Configurazione centralizzata
- `glasses.ts` - Wrapper SDK Even Hub
- `audio.ts` - Pipeline audio LC3 → Whisper
- `openclaw.ts` - Client WebSocket OpenClaw
- `index.ts` - Entry point plugin

## Stato

WIP - Implementazione in corso
