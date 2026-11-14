import { InMemoryTransport } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { vi } from 'vitest';
import { buildServer, startStdioServer } from '../index.js';
import { FreeScoutAPI } from '../freescout-api.js';

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
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean };
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
  it('reports Resource-ID for an empty 201 draft response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201, headers: { 'Resource-ID': '25' } }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const tools = registeredTools(
        buildServer({ api: new FreeScoutAPI('https://example.invalid', 'test-key') })
      );
      const draft = await execute(tools, 'freescout_create_draft_reply', {
        ticket: '123',
        replyText: 'hello',
        userId: 1,
        to: [],
        cc: [],
        bcc: [],
      });
      expect(draft.structuredContent).toMatchObject({ success: true, draftId: 25 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('reports successful thread creation even if an empty response has no resource ID', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const tools = registeredTools(
        buildServer({ api: new FreeScoutAPI('https://example.invalid', 'test-key') })
      );
      const note = await execute(tools, 'freescout_add_note', {
        ticket: '123',
        note: 'hello',
        userId: 1,
      });
      const draft = await execute(tools, 'freescout_create_draft_reply', {
        ticket: '123',
        replyText: 'hello',
        userId: 1,
        to: [],
        cc: [],
        bcc: [],
      });
      expect(note.structuredContent).toMatchObject({ success: true });
      expect(draft.structuredContent).toMatchObject({ success: true });
      expect(JSON.stringify(draft)).toMatch(/ID.*(?:unavailable|not returned)/i);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('opens the stdio entry without FreeScout credentials', async () => {
    const [, serverTransport] = InMemoryTransport.createLinkedPair();
    vi.stubEnv('FREESCOUT_URL', '');
    vi.stubEnv('FREESCOUT_API_KEY', '');

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

  it('declares safety hints matching each tool operation', () => {
    const tools = registeredTools(buildServer({ api: createApi() as never }));
    const writes = [
      'freescout_add_note',
      'freescout_update_ticket',
      'freescout_create_draft_reply',
    ];
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: !writes.includes(name),
        destructiveHint: name === 'freescout_update_ticket',
        openWorldHint: true,
      });
    }
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

describe('buildServer without FreeScout credentials', () => {
  const missingMessage =
    'Missing required environment variables: FREESCOUT_URL and FREESCOUT_API_KEY';

  beforeEach(() => {
    // Empty values keep dotenv from filling them in from a local .env file.
    vi.stubEnv('FREESCOUT_URL', '');
    vi.stubEnv('FREESCOUT_API_KEY', '');
    vi.stubEnv('FREESCOUT_DEFAULT_USER_ID', '1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('builds the server and registers all eight tools', () => {
    const tools = registeredTools(buildServer());

    expect(Object.keys(tools)).toHaveLength(8);
  });

  it.each([
    ['freescout_get_ticket', { ticket: '123' }],
    ['freescout_analyze_ticket', { ticket: '123' }],
    ['freescout_add_note', { ticket: '123', note: 'Investigating' }],
    ['freescout_update_ticket', { ticket: '123', status: 'closed' }],
    ['freescout_create_draft_reply', { ticket: '123', replyText: 'Hello' }],
    ['freescout_get_ticket_context', { ticket: '123' }],
    ['freescout_search_tickets', { subject: 'checkout' }],
    ['freescout_get_mailboxes', {}],
  ])('reports the missing variables when %s is called', async (name, args) => {
    const tools = registeredTools(buildServer());

    await expect(execute(tools, name, args)).rejects.toThrow(missingMessage);
  });

  it('does not log credential values in the missing-variables error', async () => {
    vi.stubEnv('FREESCOUT_API_KEY', 'secret-test-key');
    const tools = registeredTools(buildServer());

    const error = await execute(tools, 'freescout_get_mailboxes', {}).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('secret-test-key');
  });

  it('uses the credentials once they are available on a later tool call', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify([{ id: 4, name: 'Support' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const tools = registeredTools(buildServer());

    await expect(execute(tools, 'freescout_get_mailboxes', {})).rejects.toThrow(missingMessage);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv('FREESCOUT_URL', 'https://support.example.invalid');
    vi.stubEnv('FREESCOUT_API_KEY', 'test-only-key');

    await expect(execute(tools, 'freescout_get_mailboxes', {})).resolves.toMatchObject({
      content: [{ type: 'text' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls as unknown[][])[0][0])).toBe(
      'https://support.example.invalid/api/mailboxes'
    );
  });

  it('validates FREESCOUT_DEFAULT_USER_ID when a tool is called, not when building', async () => {
    vi.stubEnv('FREESCOUT_URL', 'https://support.example.invalid');
    vi.stubEnv('FREESCOUT_API_KEY', 'test-only-key');
    vi.stubEnv('FREESCOUT_DEFAULT_USER_ID', 'abc');
    const tools = registeredTools(buildServer());

    await expect(execute(tools, 'freescout_get_mailboxes', {})).rejects.toThrow(
      'FREESCOUT_DEFAULT_USER_ID must be a positive integer'
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
