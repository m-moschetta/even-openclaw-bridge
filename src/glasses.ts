import { config } from './config.js';

export class GlassesDisplay {
  private currentPage: number = 0;
  private pages: string[] = [];

  /**
   * Paginate long text into multiple screens
   */
  async sendText(text: string): Promise<void> {
    this.pages = this.paginateText(text, config.displayWidth, config.linesPerScreen);
    this.currentPage = 0;
    
    if (this.pages.length > 0) {
      await this.showPage(0);
    }
  }

  /**
   * Show brief status message
   */
  async showStatus(msg: string): Promise<void> {
    // Use Even Hub SDK to display status
    // This is a simplified implementation
    console.log(`[HUD STATUS]: ${msg}`);
    // TODO: Integrate with actual Even Hub SDK
  }

  /**
   * Clear the display
   */
  async clearDisplay(): Promise<void> {
    this.pages = [];
    this.currentPage = 0;
    console.log('[HUD]: Display cleared');
    // TODO: Integrate with actual Even Hub SDK
  }

  /**
   * Navigate to next page
   */
  async nextPage(): Promise<void> {
    if (this.currentPage < this.pages.length - 1) {
      this.currentPage++;
      await this.showPage(this.currentPage);
    }
  }

  /**
   * Navigate to previous page
   */
  async prevPage(): Promise<void> {
    if (this.currentPage > 0) {
      this.currentPage--;
      await this.showPage(this.currentPage);
    }
  }

  private async showPage(index: number): Promise<void> {
    if (index < 0 || index >= this.pages.length) return;
    
    const pageText = this.pages[index];
    const indicator = this.pages.length > 1 ? ` (${index + 1}/${this.pages.length})` : '';
    
    console.log(`[HUD DISPLAY${indicator}]:`);
    console.log(pageText);
    console.log('---');
    
    // TODO: Integrate with actual Even Hub SDK
    // await sdk.displayText(pageText + indicator);
  }

  private paginateText(text: string, width: number, linesPerScreen: number): string[] {
    const charsPerLine = Math.floor(width / (config.fontSize * 0.6));
    const charsPerPage = charsPerLine * linesPerScreen;
    
    const pages: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      const page = remaining.slice(0, charsPerPage);
      pages.push(page);
      remaining = remaining.slice(charsPerPage);
    }
    
    return pages.length > 0 ? pages : [text];
  }

  get hasMorePages(): boolean {
    return this.currentPage < this.pages.length - 1;
  }

  get hasPrevPages(): boolean {
    return this.currentPage > 0;
  }
}
