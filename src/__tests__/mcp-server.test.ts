import { InMemoryTransport } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { vi } from 'vitest';
import { buildServer, startStdioServer } from '../index.js';

const conversation = {
  id: 123,
  number: 456,
  subject: 'Checkout error',
  status: 'active' as const,
  to: ['customer@example.com'],
  cc: ['team@example.com'],
  bcc: ['audit@example.com'],
  _embedded: {
    customer: {
      id: 1,
      email: 'customer@example.com',
      first_name: 'Casey',
      last_name: 'Customer',
    },
    threads: [
      {
        id: 1,
        type: 'customer' as const,
        body: '<p>Checkout failed with an error: payment rejected</p>',
        created_at: '2026-08-14T00:00:00Z',
      },
    ],
  },
};

function createApi() {
  return {
    parseTicketInput: vi.fn((ticket: string) => ticket.replace('#', '')),
    getConversation: vi.fn().mockResolvedValue(conversation),
    addThread: vi.fn().mockResolvedValue({ id: 77 }),
    updateConversation: vi.fn().mockResolvedValue(undefined),
    createDraftReply: vi.fn().mockResolvedValue({ id: 88 }),
    searchConversations: vi.fn().mockResolvedValue({
      _embedded: { conversations: [conversation] },
      page: { size: 50, totalElements: 1, number: 1, totalPages: 1 },
    }),
    getMailboxes: vi.fn().mockResolvedValue([{ id: 4, name: 'Support' }]),
  };
}

type RegisteredTool = {
  executor: (args: unknown, context: unknown) => Promise<Record<string, unknown>>;
  outputSchema?: unknown;
};

function registeredTools(server: ReturnType<typeof buildServer>): Record<string, RegisteredTool> {
  return (server as unknown as { _registeredTools: Record<string, RegisteredTool> })
    ._registeredTools;
}

async function execute(
  tools: Record<string, RegisteredTool>,
  name: string,
  args: Record<string, unknown>
) {
  return tools[name].executor(args, {});
}

describe('buildServer', () => {
  it('validates required configuration before opening the stdio entry', async () => {
    const [, serverTransport] = InMemoryTransport.createLinkedPair();
    vi.stubEnv('FREESCOUT_URL', 'https://example.invalid');
    vi.stubEnv('FREESCOUT_API_KEY', 'test-only-key');
    vi.stubEnv('FREESCOUT_DEFAULT_USER_ID', '12');

    const lifecycle = startStdioServer({ transport: serverTransport });
    await lifecycle.close();

    vi.unstubAllEnvs();
  });

  it('registers the eight tools without declared output schemas', () => {
    const server = buildServer({ api: createApi() as never });
    const tools = registeredTools(server);

    expect(Object.keys(tools)).toHaveLength(8);
    expect(Object.values(tools).every((tool) => tool.outputSchema === undefined)).toBe(true);
  });

  it('preserves the eight tool behaviors and structured content where it is stable', async () => {
    const api = createApi();
    const tools = registeredTools(buildServer({ api: api as never, defaultUserId: 7 }));

    const ticket = await execute(tools, 'freescout_get_ticket', { ticket: '#123' });
    const analysis = await execute(tools, 'freescout_analyze_ticket', { ticket: '123' });
    const note = await execute(tools, 'freescout_add_note', {
      ticket: '123',
      note: 'Investigating',
    });
    const update = await execute(tools, 'freescout_update_ticket', {
      ticket: '123',
      status: 'pending',
      assignTo: 11,
      userId: 9,
    });
    const draft = await execute(tools, 'freescout_create_draft_reply', {
      ticket: '123',
      replyText: 'Thanks for the report.',
    });
    const context = await execute(tools, 'freescout_get_ticket_context', { ticket: '123' });
    const search = await execute(tools, 'freescout_search_tickets', { status: 'active' });
    const mailboxes = await execute(tools, 'freescout_get_mailboxes', {});

    expect(ticket.structuredContent).toBeUndefined();
    expect(analysis.structuredContent).toMatchObject({ ticketId: '123', isBug: true });
    expect(note.structuredContent).toMatchObject({ success: true, ticketId: '123' });
    expect(update.structuredContent).toMatchObject({ success: true, ticketId: '123' });
    expect(draft.structuredContent).toMatchObject({ success: true, draftId: 88 });
    expect(context.structuredContent).toBeUndefined();
    expect(search.structuredContent).toBeUndefined();
    // totalCount must read the FreeScout `page.totalElements` key, not a
    // snake_case variant that would silently resolve to 0.
    const searchText = (search.content as Array<{ type: string; text: string }>)[0].text;
    expect(JSON.parse(searchText).totalCount).toBe(1);
    expect(mailboxes.structuredContent).toBeUndefined();
    expect(api.addThread).toHaveBeenCalledWith('123', 'note', 'Investigating', 7);
    expect(api.updateConversation).toHaveBeenCalledWith('123', {
      status: 'pending',
      assignTo: 11,
      byUser: 9,
    });
    expect(api.createDraftReply).toHaveBeenCalledWith(
      '123',
      'Thanks for the report.',
      7,
      conversation.to ? { to: conversation.to, cc: conversation.cc, bcc: conversation.bcc } : {}
    );
  });
});

describe('serveStdio', () => {
  it.each([
    [
      '2025 legacy initialize',
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      },
      'legacy',
    ],
    [
      '2026 server discovery',
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'server/discover',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      },
      'modern',
    ],
  ])('serves %s from the same buildServer factory', async (_label, request, era) => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const factory = vi.fn(() => buildServer({ api: createApi() as never }));
    const response = new Promise<Record<string, unknown>>((resolve) => {
      clientTransport.onmessage = (message) => resolve(message as Record<string, unknown>);
    });
    const handle = serveStdio(factory, { transport: serverTransport });

    await clientTransport.send(request);

    await expect(response).resolves.toMatchObject({ jsonrpc: '2.0', id: 1, result: {} });
    expect(factory).toHaveBeenCalledWith({ era });
    await handle.close();
  });
});
