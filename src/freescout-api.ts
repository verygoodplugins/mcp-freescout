import fetch from 'node-fetch';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
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
   * Convert Markdown formatting to HTML for FreeScout using a robust parser.
   * This preserves underscores, code fences, and inline code reliably.
   */
  private markdownToHtml(text: string): string {
    if (!text) {
      return '';
    }

    const html = marked.parse(text, {
      gfm: true,
      breaks: true,
    }) as string;

    return DOMPurify.sanitize(html).trim();
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
    status?: string,
    state?: string
  ): Promise<FreeScoutApiResponse<FreeScoutConversation>> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (status) params.append('status', status);
    if (state) params.append('state', state);

    return this.request<FreeScoutApiResponse<FreeScoutConversation>>(
      `/conversations?${params.toString()}`
    );
  }

  async listConversations(
    status?: string,
    state?: string,
    assignee?: string | null
  ): Promise<FreeScoutApiResponse<FreeScoutConversation>> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (state) params.append('state', state);
    if (assignee !== undefined) {
      if (assignee === null) {
        params.append('assignee', 'null');
      } else {
        params.append('assignee', assignee);
      }
    }

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