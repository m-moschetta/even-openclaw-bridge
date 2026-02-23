export const config = {
    port: parseInt(process.env.PORT || '3000'),
    openClawWs: process.env.OPENCLAW_WS || 'ws://127.0.0.1:18789',
    openClawPassword: process.env.OPENCLAW_GATEWAY_PASSWORD || '',
    openAiKey: process.env.OPENAI_API_KEY || '',
    maxRecordingMs: 30000,
    displayWidth: 576,
    linesPerScreen: 9,
    fontSize: 16,
    nodeEnv: process.env.NODE_ENV || 'development'
};
//# sourceMappingURL=config.js.map