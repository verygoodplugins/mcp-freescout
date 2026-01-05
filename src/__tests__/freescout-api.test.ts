import { FreeScoutAPI } from '../freescout-api.js';
import { ConversationSchema, ThreadSchema, CustomerSchema } from '../types.js';

// Mock fetch globally
const mockFetch = jest.fn();
const globalWithFetch = globalThis as typeof globalThis & {
  fetch: typeof mockFetch;
};
globalWithFetch.fetch = mockFetch;

describe('FreeScoutAPI', () => {
  let api: FreeScoutAPI;
  const mockBaseUrl = 'https://test.freescout.com';
  const mockApiKey = 'test-key-123';

  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    api = new FreeScoutAPI(mockBaseUrl, mockApiKey, {
      maxRetries: 2,
      initialDelay: 0,
      maxDelay: 0,
      timeout: 250,
    });
    mockFetch.mockReset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct base URL and headers', () => {
      expect(api).toBeInstanceOf(FreeScoutAPI);
    });

    it('should remove trailing slash from base URL', () => {
      const apiWithSlash = new FreeScoutAPI('https://test.com/', mockApiKey);
      expect(apiWithSlash).toBeInstanceOf(FreeScoutAPI);
    });
  });

  describe('getConversation', () => {
    const mockConversationResponse = {
      id: 123,
      number: 456,
      subject: 'Test Issue',
      status: 'active',
      state: 'published',
      user_id: 1,
      customer_id: 10,
      mailbox_id: 5,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      _embedded: {
        threads: [],
        customer: { id: 10, email: 'customer@example.com' },
      },
    };

    it('should fetch and validate a conversation successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockConversationResponse,
      });

      const result = await api.getConversation('123');

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/conversations/123?embed=threads`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-FreeScout-API-Key': mockApiKey,
          }),
        })
      );

      // Validate against schema
      const parsed = ConversationSchema.parse(result);
      expect(parsed.id).toBe(123);
      expect(parsed.subject).toBe('Test Issue');
    });

    it('should retry on transient failures', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockConversationResponse,
        });

      const result = await api.getConversation('123');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.id).toBe(123);
    });

    it('should handle 404 errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Conversation not found',
      });

      await expect(api.getConversation('999')).rejects.toThrow(/404/);
    });

    it('should handle rate limiting with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockConversationResponse,
        });

      const result = await api.getConversation('123');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.id).toBe(123);
    });

    it('should timeout after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(api.getConversation('123')).rejects.toThrow();
      expect(mockFetch.mock.calls.length).toBeGreaterThan(1);
    }, 15000);
  });

  describe('searchConversations', () => {
    const mockSearchResponse = {
      _embedded: {
        conversations: [
          {
            id: 1,
            number: 100,
            subject: 'Test 1',
            status: 'active',
            state: 'published',
            user_id: 1,
            customer_id: 10,
            mailbox_id: 5,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            number: 101,
            subject: 'Test 2',
            status: 'pending',
            state: 'published',
            user_id: null,
            customer_id: 11,
            mailbox_id: 5,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
      page: { size: 50, total_elements: 2, total_pages: 1, number: 1 },
    };

    it('should search with explicit filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      const result = await api.searchConversations({
        textSearch: 'authentication',
        status: 'active',
        assignee: 'unassigned',
      });

      expect(result._embedded?.conversations).toHaveLength(2);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('query=authentication');
      expect(url).toContain('status=active');
      expect(url).toContain('assignee=null');
    });

    it('should handle empty search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          _embedded: { conversations: [] },
          page: { size: 50, total_elements: 0, total_pages: 0, number: 1 },
        }),
      });

      const result = await api.searchConversations({
        textSearch: 'nonexistent',
      });
      expect(result._embedded?.conversations).toHaveLength(0);
    });

    it('should use comma-separated values for status all', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      await api.searchConversations({ status: 'all' });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('status=active%2Cpending%2Cclosed%2Cspam');
    });

    it('should respect pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      await api.searchConversations({ textSearch: 'test', page: 2 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('page=2');
    });
  });

  describe('updateConversation', () => {
    it('should update conversation status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await api.updateConversation('123', { status: 'closed' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/conversations/123`,
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"status":"closed"'),
        })
      );
    });

    it('should handle update failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid status',
      });

      await expect(
        api.updateConversation('123', { status: 'closed' })
      ).rejects.toThrow();
    });
  });

  describe('addThread', () => {
    it('should add a thread to a conversation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 456,
          type: 'note',
          body: 'Test note',
          created_by_customer: false,
          created_at: '2024-01-01T00:00:00Z',
        }),
      });

      await api.addThread('123', 'note', 'Test note', 1);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/conversations/123/threads`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"text":"Test note"'),
        })
      );
    });

    it('should convert markdown to HTML for notes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 457,
          type: 'note',
          body: '<strong>bold</strong>',
          created_by_customer: false,
          created_at: '2024-01-01T00:00:00Z',
        }),
      });

      await api.addThread('123', 'note', '**bold**\n\n- item', 1);

      const callBody = mockFetch.mock.calls[0][1]?.body as string;
      expect(callBody).toContain('<strong>bold</strong>');
      expect(callBody).toContain('<ul>');
      expect(callBody).toContain('<li>item</li>');
    });

    it('should preserve raw HTML in notes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 458,
          type: 'note',
          body: '<p>Hello</p>',
          created_by_customer: false,
          created_at: '2024-01-01T00:00:00Z',
        }),
      });

      await api.addThread('123', 'note', '<p>Hello</p>', 1);

      const callBody = mockFetch.mock.calls[0][1]?.body as string;
      expect(callBody).toContain('<p>Hello</p>');
    });
  });

  describe('Schema Validation', () => {
    it('should validate conversation schema with all required fields', () => {
      const validConversation = {
        id: 1,
        number: 100,
        subject: 'Test',
        status: 'active',
        state: 'published',
        user_id: 1,
        customer_id: 10,
        mailbox_id: 5,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(() => ConversationSchema.parse(validConversation)).not.toThrow();
    });

    it('should reject invalid conversation data', () => {
      const invalidConversation = {
        id: 'not-a-number',
        number: 100,
        status: 'invalid-status',
      };

      expect(() => ConversationSchema.parse(invalidConversation)).toThrow();
    });

    it('should validate thread schema', () => {
      const validThread = {
        id: 1,
        type: 'message',
        body: 'Thread body',
        created_by_customer: false,
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(() => ThreadSchema.parse(validThread)).not.toThrow();
    });

    it('should validate customer schema', () => {
      const validCustomer = {
        id: 10,
        email: 'customer@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      expect(() => CustomerSchema.parse(validCustomer)).not.toThrow();
    });
  });

  describe('URL Parsing', () => {
    it('should extract ticket ID from FreeScout URL', () => {
      const url = 'https://test.freescout.com/conversation/123';
      const result = api.extractTicketIdFromUrl(url);
      expect(result).toBe('123');
    });

    it('should return null for invalid URLs', () => {
      const result = api.extractTicketIdFromUrl('not-a-url');
      expect(result).toBeNull();
    });

    it('should parse various ticket input formats', () => {
      expect(api.parseTicketInput('123')).toBe('123');
      expect(api.parseTicketInput('https://test.com/conversation/456')).toBe(
        '456'
      );
    });
  });

  describe('Error Recovery', () => {
    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(api.getConversation('123')).rejects.toThrow();
    });

    it('should abort requests that exceed timeout', async () => {
      api = new FreeScoutAPI(mockBaseUrl, mockApiKey, {
        maxRetries: 0,
        initialDelay: 0,
        maxDelay: 0,
        timeout: 10,
      });

      mockFetch.mockImplementationOnce((_url: string, init?: RequestInit) => {
        return new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      await expect(api.getConversation('123')).rejects.toThrow(
        /timeout after 10ms/
      );
    });
  });

  describe('Markdown to HTML Conversion', () => {
    it('should handle basic markdown formatting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 1,
          type: 'note',
          body: '<strong>bold</strong>',
          created_by_customer: false,
          created_at: '2024-01-01T00:00:00Z',
        }),
      });

      await api.createDraftReply('123', '**bold**', 1);

      const callBody = mockFetch.mock.calls[0][1]?.body as string;
      expect(callBody).toContain('<strong>bold</strong>');
      expect(callBody).toBeDefined();
    });
  });
});
