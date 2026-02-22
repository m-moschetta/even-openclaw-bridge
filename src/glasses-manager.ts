import { config } from './config.js';

type State = 'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'WAITING' | 'DISPLAYING';

export class GlassesManager {
  private ws: any = null;
  private state: State = 'IDLE';
  private pages: string[] = [];
  private currentPage: number = 0;
  private lastTranscription: string = '';
  private lastResponse: string = '';
  private connectedAt: Date | null = null;

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
  }

  getLastResponse(): string {
    return this.lastResponse;
  }

  setLastResponse(text: string) {
    this.lastResponse = text;
    this.paginateText(text);
    this.currentPage = 0;
  }

  getConnectedAt(): Date | null {
    return this.connectedAt;
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

  reset() {
    this.state = 'IDLE';
    this.pages = [];
    this.currentPage = 0;
    this.lastTranscription = '';
    this.lastResponse = '';
  }
}
