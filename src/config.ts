export const config = {
  openClawWs: process.env.OPENCLAW_WS || 'ws://127.0.0.1:18789',
  openAiKey: process.env.OPENAI_API_KEY || '',
  maxRecordingMs: 30000,
  displayWidth: 488,
  linesPerScreen: 5,
  fontSize: 21,
};
