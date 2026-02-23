import { config } from './config.js';
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
    // Format the full conversation history for display on glasses
    formatConversation() {
        if (this.chatHistory.length === 0)
            return '';
        return this.chatHistory.map(entry => {
            if (entry.role === 'user') {
                return `> ${entry.text}`;
            }
            else {
                return entry.text;
            }
        }).join('\n---\n');
    }
    // Paginate the full conversation, keeping each Q&A together when possible
    paginateConversation() {
        const text = this.formatConversation();
        return this.paginateText(text);
    }
    // Go to the last page (most recent content)
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
//# sourceMappingURL=glasses-manager.js.map