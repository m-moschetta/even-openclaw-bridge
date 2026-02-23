import { config } from './config.js';

type State = 'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'WAITING' | 'DISPLAYING';

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
}

export class GlassesManager {
  private ws: any = null;
  private state: State = 'IDLE';
  private pages: string[] = [];
  private currentPage: number = 0;
  private lastTranscription: string = '';
  private lastResponse: string = '';
  private connectedAt: Date | null = null;
  private chatHistory: ChatEntry[] = [];

  setConnection(ws: any) {
    this.ws = ws;
    this.connectedAt = new Date();
    this.state = 'IDLE';
  }

  clearConnection() {
    this.ws = null;
    this.state = 'IDLE';
  }

  getConnectedCount(): number {
    return this.ws ? 1 : 0;
  }

  getState(): State {
    return this.state;
  }

  setState(newState: State) {
    this.state = newState;
    console.log('[State]', newState);
  }

  getLastTranscription(): string {
    return this.lastTranscription;
  }

  setLastTranscription(text: string) {
    this.lastTranscription = text;
    this.chatHistory.push({ role: 'user', text });
  }

  getLastResponse(): string {
    return this.lastResponse;
  }

  setLastResponse(text: string) {
    this.lastResponse = text;
    this.chatHistory.push({ role: 'assistant', text });
  }

  getChatHistory(): ChatEntry[] {
    return this.chatHistory;
  }

  getConnectedAt(): Date | null {
    return this.connectedAt;
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  // Format the full conversation history for display on glasses (HUD style)
  formatConversation(): string {
    if (this.chatHistory.length === 0) return '';

    return this.chatHistory.map(entry => {
      if (entry.role === 'user') {
        return `> ${entry.text}`;
      } else {
        return entry.text;
      }
    }).join('\n');
  }

  // Paginate the full conversation, keeping each Q&A together when possible
  paginateConversation(): string[] {
    const text = this.formatConversation();
    return this.paginateText(text);
  }

  // Go to the last page (most recent content)
  goToLastPage(): { text: string; page: number; total: number } | null {
    if (this.pages.length === 0) return null;
    this.currentPage = this.pages.length - 1;
    return {
      text: this.pages[this.currentPage],
      page: this.currentPage + 1,
      total: this.pages.length
    };
  }

  paginateText(text: string): string[] {
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

  nextPage(): { text: string; page: number; total: number } | null {
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

  prevPage(): { text: string; page: number; total: number } | null {
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

  goToFirstPage(): { text: string; page: number; total: number } | null {
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
