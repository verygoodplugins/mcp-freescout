import fetch from 'node-fetch';
import type { 
  FreeScoutConversation, 
  FreeScoutApiResponse,
  FreeScoutThread 
} from './types.js';

export class FreeScoutAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Convert Markdown formatting to HTML for FreeScout
   */
  private markdownToHtml(text: string): string {
    // Convert bold text: **text** or __text__ -> <strong>text</strong>
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Convert italic text: *text* or _text_ -> <em>text</em> (avoid conflicts with bold)
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
    
    // Convert code: `text` -> <code>text</code>
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Process the entire text to handle lists that span paragraph breaks
    const lines = html.split('\n');
    const processedLines = [];
    let inOrderedList = false;
    let inUnorderedList = false;
    let currentParagraph = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check for empty lines (paragraph breaks)
      if (!trimmedLine) {
        // Check if the next non-empty line is also a list item
        const nextListItemIndex = lines.slice(i + 1).findIndex(nextLine => {
          const nextTrimmed = nextLine.trim();
          return nextTrimmed && (/^\d+\.\s+/.test(nextTrimmed) || /^[-*]\s+/.test(nextTrimmed));
        });
        
        // If we're in a list and the next item is also a list item, continue the list
        if ((inOrderedList || inUnorderedList) && nextListItemIndex !== -1) {
          continue; // Skip this empty line but keep the list open
        }
        
        // Close any current lists before starting new paragraph
        if (inOrderedList) {
          processedLines.push('</ol>');
          inOrderedList = false;
        }
        if (inUnorderedList) {
          processedLines.push('</ul>');
          inUnorderedList = false;
        }
        
        // Process accumulated paragraph
        if (currentParagraph.length > 0) {
          const paragraphContent = currentParagraph.join('<br>');
          processedLines.push(`<p>${paragraphContent}</p>`);
          currentParagraph = [];
        }
        
        // Skip extra empty lines
        continue;
      }
      
      // Check for numbered list items
      if (/^\d+\.\s+/.test(trimmedLine)) {
        // Finish any current paragraph
        if (currentParagraph.length > 0) {
          const paragraphContent = currentParagraph.join('<br>');
          processedLines.push(`<p>${paragraphContent}</p>`);
          currentParagraph = [];
        }
        
        if (!inOrderedList) {
          if (inUnorderedList) {
            processedLines.push('</ul>');
            inUnorderedList = false;
          }
          processedLines.push('<ol>');
          inOrderedList = true;
        }
        const content = trimmedLine.replace(/^\d+\.\s+/, '');
        processedLines.push(`<li>${content}</li>`);
      }
      // Check for bullet list items
      else if (/^[-*]\s+/.test(trimmedLine)) {
        // Finish any current paragraph
        if (currentParagraph.length > 0) {
          const paragraphContent = currentParagraph.join('<br>');
          processedLines.push(`<p>${paragraphContent}</p>`);
          currentParagraph = [];
        }
        
        if (!inUnorderedList) {
          if (inOrderedList) {
            processedLines.push('</ol>');
            inOrderedList = false;
          }
          processedLines.push('<ul>');
          inUnorderedList = true;
        }
        const content = trimmedLine.replace(/^[-*]\s+/, '');
        processedLines.push(`<li>${content}</li>`);
      }
      // Regular line
      else {
        // Close any lists
        if (inOrderedList) {
          processedLines.push('</ol>');
          inOrderedList = false;
        }
        if (inUnorderedList) {
          processedLines.push('</ul>');
          inUnorderedList = false;
        }
        
        // Add to current paragraph
        currentParagraph.push(trimmedLine);
      }
    }
    
    // Close any remaining lists
    if (inOrderedList) processedLines.push('</ol>');
    if (inUnorderedList) processedLines.push('</ul>');
    
    // Process any remaining paragraph
    if (currentParagraph.length > 0) {
      const paragraphContent = currentParagraph.join('<br>');
      processedLines.push(`<p>${paragraphContent}</p>`);
    }
    
    return processedLines.join('\n\n');
  }

  private async request<T>(
    path: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}/api${path}`;
    
    const headers: Record<string, string> = {
      'X-FreeScout-API-Key': this.apiKey,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FreeScout API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async getConversation(
    ticketId: string,
    includeThreads: boolean = true
  ): Promise<FreeScoutConversation> {
    const embed = includeThreads ? '?embed=threads' : '';
    return this.request<FreeScoutConversation>(
      `/conversations/${ticketId}${embed}`
    );
  }

  async addThread(
    ticketId: string,
    type: 'note' | 'message' | 'customer',
    text: string,
    userId?: number,
    state?: 'draft' | 'published'
  ): Promise<FreeScoutThread> {
    const body: any = {
      type,
      text,
    };

    if (userId) {
      body.user = userId;
    }

    if (state) {
      body.state = state;
    }

    return this.request<FreeScoutThread>(
      `/conversations/${ticketId}/threads`,
      'POST',
      body
    );
  }

  async createDraftReply(
    ticketId: string,
    text: string,
    userId: number
  ): Promise<FreeScoutThread> {
    // Convert Markdown formatting to HTML for proper display in FreeScout
    const htmlText = this.markdownToHtml(text);
    return this.addThread(ticketId, 'message', htmlText, userId, 'draft');
  }

  async updateConversation(
    ticketId: string,
    updates: {
      status?: 'active' | 'pending' | 'closed' | 'spam';
      assignTo?: number;
      byUser?: number;
    }
  ): Promise<FreeScoutConversation> {
    return this.request<FreeScoutConversation>(
      `/conversations/${ticketId}`,
      'PUT',
      updates
    );
  }

  async searchConversations(
    query: string,
    status?: string
  ): Promise<FreeScoutApiResponse<FreeScoutConversation>> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (status) params.append('status', status);

    return this.request<FreeScoutApiResponse<FreeScoutConversation>>(
      `/conversations?${params.toString()}`
    );
  }

  extractTicketIdFromUrl(url: string): string | null {
    // Match patterns like:
    // https://domain.com/conversation/12345
    // https://domain.com/conversations/12345
    const match = url.match(/conversations?\/(\d+)/);
    return match ? match[1] : null;
  }

  parseTicketInput(input: string): string {
    // Check if input is a URL
    if (input.includes('http')) {
      const ticketId = this.extractTicketIdFromUrl(input);
      if (ticketId) return ticketId;
    }
    
    // Check if input is numeric (ticket ID)
    if (/^\d+$/.test(input.trim())) {
      return input.trim();
    }

    // Try to extract ticket ID from text like "ticket #12345"
    const match = input.match(/#?(\d+)/);
    if (match) {
      return match[1];
    }

    throw new Error(`Could not extract ticket ID from input: ${input}`);
  }
}