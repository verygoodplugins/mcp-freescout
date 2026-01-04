import type {
  FreeScoutConversation,
  FreeScoutApiResponse,
  FreeScoutThread,
  SearchFilters,
} from './types.js';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeout?: number;
}

export class FreeScoutAPI {
  private baseUrl: string;
  private apiKey: string;
  private retryOptions: Required<RetryOptions>;

  constructor(baseUrl: string, apiKey: string, retryOptions?: RetryOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.retryOptions = {
      maxRetries: retryOptions?.maxRetries ?? 3,
      initialDelay: retryOptions?.initialDelay ?? 1000,
      maxDelay: retryOptions?.maxDelay ?? 10000,
      timeout: retryOptions?.timeout ?? 30000,
    };
  }

  /**
   * Parse relative time strings like "7d", "24h", "30m" to ISO date
   */
  private parseRelativeTime(relative: string): string | null {
    const match = relative.match(/^(\d+)([dhm])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];
    const now = new Date();

    switch (unit) {
      case 'd':
        now.setDate(now.getDate() - value);
        break;
      case 'h':
        now.setHours(now.getHours() - value);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() - value);
        break;
    }

    return now.toISOString();
  }

  /**
   * Exponential backoff retry logic with jitter
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable =
        message.includes('ECONNRESET') ||
        message.includes('ETIMEDOUT') ||
        message.includes('429') ||
        message.includes('503') ||
        message.includes('502');

      if (!isRetryable || retryCount >= this.retryOptions.maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        this.retryOptions.initialDelay * Math.pow(2, retryCount) + Math.random() * 1000,
        this.retryOptions.maxDelay
      );

      console.error(
        `[FreeScout API] Retry ${retryCount + 1}/${this.retryOptions.maxRetries} after ${Math.round(delay)}ms. Error: ${message}`
      );

      await this.sleep(delay);
      return this.retryWithBackoff(fn, retryCount + 1);
    }
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
        const nextListItemIndex = lines.slice(i + 1).findIndex((nextLine) => {
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

  private async request<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
    return this.retryWithBackoff(async () => {
      const url = `${this.baseUrl}/api${path}`;

      const headers: Record<string, string> = {
        'X-FreeScout-API-Key': this.apiKey,
      };

      if (body) {
        headers['Content-Type'] = 'application/json';
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.retryOptions.timeout);

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();

          // Include status code in error for retry logic
          if (response.status === 429) {
            throw new Error(`FreeScout API rate limit (429): ${errorText}`);
          }
          if (response.status >= 500) {
            throw new Error(`FreeScout API server error (${response.status}): ${errorText}`);
          }

          throw new Error(`FreeScout API error: ${response.status} - ${errorText}`);
        }

        return response.json() as Promise<T>;
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`FreeScout API timeout after ${this.retryOptions.timeout}ms`);
        }

        throw error;
      }
    });
  }

  async getConversation(
    ticketId: string,
    includeThreads: boolean = true
  ): Promise<FreeScoutConversation> {
    const embed = includeThreads ? '?embed=threads' : '';
    return this.request<FreeScoutConversation>(`/conversations/${ticketId}${embed}`);
  }

  async addThread(
    ticketId: string,
    type: 'note' | 'message' | 'customer',
    text: string,
    userId?: number,
    state?: 'draft' | 'published'
  ): Promise<FreeScoutThread> {
    const body: {
      type: 'note' | 'message' | 'customer';
      text: string;
      user?: number;
      state?: 'draft' | 'published';
    } = {
      type,
      text,
    };

    if (userId) {
      body.user = userId;
    }

    if (state) {
      body.state = state;
    }

    return this.request<FreeScoutThread>(`/conversations/${ticketId}/threads`, 'POST', body);
  }

  async createDraftReply(ticketId: string, text: string, userId: number): Promise<FreeScoutThread> {
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
    return this.request<FreeScoutConversation>(`/conversations/${ticketId}`, 'PUT', updates);
  }

  /**
   * Search conversations with explicit filter parameters
   */
  async searchConversations(
    filters: SearchFilters
  ): Promise<FreeScoutApiResponse<FreeScoutConversation>> {
    const params = new URLSearchParams();

    // Text search
    if (filters.textSearch) {
      params.append('query', filters.textSearch.trim());
    }

    // Assignee filter
    if (filters.assignee !== undefined) {
      if (filters.assignee === 'unassigned') {
        params.append('assignee', 'null');
      } else if (filters.assignee === 'any') {
        // Don't add assignee filter
      } else {
        params.append('assignee', filters.assignee.toString());
      }
    }

    // Status filter
    if (filters.status) {
      if (filters.status === 'all') {
        // When status is 'all', append each valid status explicitly
        ['active', 'pending', 'closed', 'spam'].forEach((status) => {
          params.append('status', status);
        });
      } else {
        params.append('status', filters.status);
      }
    }

    // State filter
    if (filters.state) {
      params.append('state', filters.state);
    }

    // Mailbox filter
    if (filters.mailboxId != null) {
      params.append('mailboxId', filters.mailboxId.toString());
    }

    // Date filters - convert relative times to ISO dates
    if (filters.updatedSince) {
      const isoDate = this.parseRelativeTime(filters.updatedSince) || filters.updatedSince;
      params.append('updatedSince', isoDate);
    }

    if (filters.createdSince) {
      const isoDate = this.parseRelativeTime(filters.createdSince) || filters.createdSince;
      params.append('createdSince', isoDate);
    }

    // Pagination
    if (filters.page) {
      params.append('page', filters.page.toString());
    }

    if (filters.pageSize) {
      params.append('per_page', filters.pageSize.toString());
    }

    return this.request<FreeScoutApiResponse<FreeScoutConversation>>(
      `/conversations?${params.toString()}`
    );
  }

  /**
   * @deprecated Use searchConversations with SearchFilters instead
   */
  async searchConversationsLegacy(
    query: string,
    status?: string,
    state?: string,
    mailboxId?: number
  ): Promise<FreeScoutApiResponse<FreeScoutConversation>> {
    const statusValue = status;
    const stateValue = state;

    return this.searchConversations({
      textSearch: query,
      status:
        statusValue &&
        ['active', 'pending', 'closed', 'spam', 'all'].includes(statusValue)
          ? (statusValue as SearchFilters['status'])
          : undefined,
      state:
        stateValue && ['published', 'deleted'].includes(stateValue)
          ? (stateValue as SearchFilters['state'])
          : undefined,
      mailboxId,
    });
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

  async getMailboxes(): Promise<unknown> {
    return this.request<unknown>('/mailboxes');
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
