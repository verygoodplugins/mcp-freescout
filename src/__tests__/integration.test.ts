/**
 * Integration tests against live FreeScout instance.
 * These tests require FREESCOUT_URL and FREESCOUT_API_KEY environment variables.
 * They query real tickets to validate the API client works with actual data.
 */

import { FreeScoutAPI } from '../freescout-api.js';

const FREESCOUT_URL = process.env.FREESCOUT_URL;
const FREESCOUT_API_KEY = process.env.FREESCOUT_API_KEY;

// Skip all tests if credentials not provided
const describeIf = FREESCOUT_URL && FREESCOUT_API_KEY ? describe : describe.skip;

describeIf('FreeScout Integration Tests', () => {
  let api: FreeScoutAPI;

  beforeAll(() => {
    if (!FREESCOUT_URL || !FREESCOUT_API_KEY) {
      throw new Error('FREESCOUT_URL and FREESCOUT_API_KEY must be set for integration tests');
    }
    api = new FreeScoutAPI(FREESCOUT_URL, FREESCOUT_API_KEY);
  });

  describe('searchConversations', () => {
    it('should fetch recent active tickets', async () => {
      const result = await api.searchConversations({
        status: 'active',
        pageSize: 5,
      });

      expect(result._embedded).toBeDefined();
      expect(result._embedded?.conversations).toBeDefined();
      expect(Array.isArray(result._embedded?.conversations)).toBe(true);
    });

    it('should fetch unassigned tickets', async () => {
      const result = await api.searchConversations({
        assignee: 'unassigned',
        pageSize: 5,
      });

      expect(result._embedded).toBeDefined();
      // Unassigned tickets should have user_id as null
      const conversations = result._embedded?.conversations || [];
      conversations.forEach((conv) => {
        expect(conv.user_id === null || conv.user_id === undefined).toBe(true);
      });
    });

    it('should handle pagination', async () => {
      const result = await api.searchConversations({
        status: 'all',
        pageSize: 2,
        page: 1,
      });

      expect(result.page).toBeDefined();
      expect(result.page?.size).toBeDefined();
    });
  });

  describe('getConversation', () => {
    let realTicketId: string | null = null;

    beforeAll(async () => {
      // Get a real ticket ID from search results
      const searchResult = await api.searchConversations({
        status: 'all',
        pageSize: 1,
      });
      const conversations = searchResult._embedded?.conversations || [];
      if (conversations.length > 0) {
        realTicketId = String(conversations[0].id);
      }
    });

    it('should fetch a real ticket with threads', async () => {
      if (!realTicketId) {
        console.warn('Skipping test - no tickets found in FreeScout');
        return;
      }

      const conversation = await api.getConversation(realTicketId, true);

      expect(conversation.id).toBeDefined();
      expect(conversation.number).toBeDefined();
      expect(conversation.subject).toBeDefined();
      expect(conversation.status).toBeDefined();
      expect(conversation._embedded).toBeDefined();
    });

    it('should handle ticket without threads', async () => {
      if (!realTicketId) {
        console.warn('Skipping test - no tickets found in FreeScout');
        return;
      }

      const conversation = await api.getConversation(realTicketId, false);

      expect(conversation.id).toBeDefined();
      expect(conversation.subject).toBeDefined();
    });
  });

  describe('getMailboxes', () => {
    it('should fetch list of mailboxes', async () => {
      const result = await api.getMailboxes();

      expect(result).toBeDefined();
      // Result structure may vary but should be valid response
    });
  });

  describe('URL parsing', () => {
    it('should extract ticket ID from FreeScout URL', () => {
      const testUrl = `${FREESCOUT_URL}/conversation/12345`;
      const ticketId = api.extractTicketIdFromUrl(testUrl);
      expect(ticketId).toBe('12345');
    });

    it('should parse numeric ticket input', () => {
      expect(api.parseTicketInput('12345')).toBe('12345');
      expect(api.parseTicketInput(' 67890 ')).toBe('67890');
    });
  });
});
