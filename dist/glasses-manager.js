import { config } from './config.js';
// HUD screen width in characters
const HUD_W = 36;
export class GlassesManager {
    ws = null;
    state = 'IDLE';
    pages = [];
    currentPage = 0;
    lastTranscription = '';
    lastResponse = '';
    connectedAt = null;
    chatHistory = [];
    setConnection(ws) {
        this.ws = ws;
        this.connectedAt = new Date();
        this.state = 'IDLE';
    }
    clearConnection() {
        this.ws = null;
        this.state = 'IDLE';
    }
    getConnectedCount() {
        return this.ws ? 1 : 0;
    }
    getState() {
        return this.state;
    }
    setState(newState) {
        this.state = newState;
        console.log('[State]', newState);
    }
    getLastTranscription() {
        return this.lastTranscription;
    }
    setLastTranscription(text) {
        this.lastTranscription = text;
        this.chatHistory.push({ role: 'user', text });
    }
    getLastResponse() {
        return this.lastResponse;
    }
    setLastResponse(text) {
        this.lastResponse = text;
        this.chatHistory.push({ role: 'assistant', text });
    }
    getChatHistory() {
        return this.chatHistory;
    }
    getConnectedAt() {
        return this.connectedAt;
    }
    getCurrentPage() {
        return this.currentPage;
    }
    // ─── HUD Screens ────────────────────────────────
    static hudIdle() {
        return [
            '\u250C' + '\u2500'.repeat(HUD_W) + '\u2510',
            '\u2502' + center('J.A.R.V.I.S.', HUD_W) + '\u2502',
            '\u2502' + center('', HUD_W) + '\u2502',
            '\u2502' + center('\u25C9  SISTEMA ONLINE  \u25C9', HUD_W) + '\u2502',
            '\u2502' + center('', HUD_W) + '\u2502',
            '\u2502' + center('Tap per parlare', HUD_W) + '\u2502',
            '\u2514' + '\u2500'.repeat(HUD_W) + '\u2518',
        ].join('\n');
    }
    static hudListening() {
        return [
            '\u250C' + '\u2500'.repeat(HUD_W) + '\u2510',
            '\u2502' + center('J.A.R.V.I.S.', HUD_W) + '\u2502',
            '\u2502' + center('', HUD_W) + '\u2502',
            '\u2502' + center('\u2588\u2588 REC \u2588\u2588', HUD_W) + '\u2502',
            '\u2502' + center('((( ASCOLTO )))', HUD_W) + '\u2502',
            '\u2502' + center('', HUD_W) + '\u2502',
            '\u2502' + center('Tap per inviare', HUD_W) + '\u2502',
            '\u2514' + '\u2500'.repeat(HUD_W) + '\u2518',
        ].join('\n');
    }
    static hudProcessing() {
        return [
            '\u250C' + '\u2500'.repeat(HUD_W) + '\u2510',
            '\u2502' + center('J.A.R.V.I.S.', HUD_W) + '\u2502',
            '\u2502' + center('', HUD_W) + '\u2502',
            '\u2502' + center('\u2591\u2592\u2593 ANALISI \u2593\u2592\u2591', HUD_W) + '\u2502',
            '\u2502' + center('Elaborazione in corso...', HUD_W) + '\u2502',
            '\u2502' + center('', HUD_W) + '\u2502',
            '\u2514' + '\u2500'.repeat(HUD_W) + '\u2518',
        ].join('\n');
    }
    // ─── Conversation formatting ────────────────────
    formatConversation() {
        if (this.chatHistory.length === 0)
            return '';
        const header = '\u2500\u2500 JARVIS COMM LOG ' + '\u2500'.repeat(18);
        const lines = [header];
        for (const entry of this.chatHistory) {
            if (entry.role === 'user') {
                lines.push(`\u25B8 ${entry.text}`);
            }
            else {
                lines.push(entry.text);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    formatWaiting() {
        const conv = this.formatConversation();
        return conv + '\u2591\u2592\u2593 Elaboro...\u2593\u2592\u2591';
    }
    // Wrap the display page with a HUD footer showing page info
    wrapPage(text, page, total) {
        if (total <= 1)
            return text;
        const footer = `\u2500\u2500 [${page}/${total}] ` + '\u2500'.repeat(Math.max(0, 20));
        return text + '\n' + footer;
    }
    paginateConversation() {
        const text = this.formatConversation();
        return this.paginateText(text);
    }
    goToLastPage() {
        if (this.pages.length === 0)
            return null;
        this.currentPage = this.pages.length - 1;
        return {
            text: this.pages[this.currentPage],
            page: this.currentPage + 1,
            total: this.pages.length
        };
    }
    paginateText(text) {
        const charsPerLine = Math.floor(config.displayWidth / (config.fontSize * 0.6));
        const charsPerPage = charsPerLine * config.linesPerScreen;
        this.pages = [];
        let remaining = text;
        while (remaining.length > 0) {
            const page = remaining.slice(0, charsPerPage);
            this.pages.push(page);
            remaining = remaining.slice(charsPerPage);
        }
        if (this.pages.length === 0) {
            this.pages = [text];
        }
        return this.pages;
    }
    nextPage() {
        if (this.currentPage < this.pages.length - 1) {
            this.currentPage++;
            return {
                text: this.pages[this.currentPage],
                page: this.currentPage + 1,
                total: this.pages.length
            };
        }
        return null;
    }
    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            return {
                text: this.pages[this.currentPage],
                page: this.currentPage + 1,
                total: this.pages.length
            };
        }
        return null;
    }
    goToFirstPage() {
        if (this.pages.length > 0) {
            this.currentPage = 0;
            return {
                text: this.pages[0],
                page: 1,
                total: this.pages.length
            };
        }
        return null;
    }
    reset() {
        this.state = 'IDLE';
        this.pages = [];
        this.currentPage = 0;
        this.lastTranscription = '';
        this.lastResponse = '';
        this.chatHistory = [];
    }
}
// Helper: center text in a given width
function center(text, width) {
    if (text.length >= width)
        return text.slice(0, width);
    const left = Math.floor((width - text.length) / 2);
    const right = width - text.length - left;
    return ' '.repeat(left) + text + ' '.repeat(right);
}
//# sourceMappingURL=glasses-manager.js.map