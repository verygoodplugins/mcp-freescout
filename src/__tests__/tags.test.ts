import { vi } from 'vitest';
import { FreeScoutAPI } from '../freescout-api.js';
import { buildServer } from '../index.js';
import { TagToolInputSchema } from '../types.js';

const page = (names: string[], number: number, totalPages: number, totalElements: number) => ({
  _embedded: { tags: names.map((name, id) => ({ id, name })) },
  page: { number, totalPages, totalElements, size: 100 },
});

describe('tag support', () => {
  const fetchMock = vi.fn();
  let api: FreeScoutAPI;
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    api = new FreeScoutAPI('https://example.invalid', 'test-key', { maxRetries: 0 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the native tag search filter with other search parameters', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ _embedded: { conversations: [] } })));
    await api.searchConversations({ tag: 'needs help', status: 'all' });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('tag')).toBe('needs help');
    expect(url.searchParams.get('status')).toBe('active,pending,closed,spam');
  });

  it('lists tags globally or for a ticket with the requested page', async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify(page(['alpha'], 2, 2, 1)))
    );
    await api.listTags({ ticketId: '123', page: 2, pageSize: 25 });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/tags');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      conversationId: '123',
      page: '2',
      pageSize: '25',
    });
    await api.listTags();
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://example.invalid/api/tags');
  });

  it('reads all pages before adding tags and preserves existing tags', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(page(['one'], 1, 2, 2))))
      .mockResolvedValueOnce(new Response(JSON.stringify(page(['two'], 2, 2, 2))))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await api.updateTags('123', 'add', ['two', 'three']);
    expect(result).toEqual(['one', 'two', 'three']);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1].body))).toEqual({
      tags: ['one', 'two', 'three'],
    });
    expect(fetchMock.mock.calls[2][0]).toBe('https://example.invalid/api/conversations/123/tags');
    expect(fetchMock.mock.calls[2][1].method).toBe('PUT');
  });

  it('does not write if a page is missing, malformed, or incomplete', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(page(['one'], 1, 2, 2))))
      .mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { tags: [] } })));
    await expect(api.updateTags('123', 'remove', ['one'])).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses to update when pagination changes or the returned count is incomplete', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(page(['one'], 1, 2, 2))))
      .mockResolvedValueOnce(new Response(JSON.stringify(page(['two'], 2, 2, 3))));
    await expect(api.updateTags('123', 'add', ['three'])).rejects.toThrow(/pagination changed/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(page(['one'], 1, 1, 2))));
    await expect(api.updateTags('123', 'remove', ['one'])).rejects.toThrow(/incomplete tag list/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('replaces or clears tags without reading them, and removes only requested tags', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await api.updateTags('123', 'replace', [])).toEqual([]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ tags: [] });
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(page(['a', 'b'], 1, 1, 2))))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await api.updateTags('123', 'remove', ['a'])).toEqual(['b']);
  });

  it('validates action-specific inputs and registers one conservative tag tool', async () => {
    expect(TagToolInputSchema.safeParse({ action: 'add', tags: ['x'] }).success).toBe(false);
    expect(TagToolInputSchema.safeParse({ action: 'add', ticket: '123', tags: [] }).success).toBe(
      false
    );
    expect(
      TagToolInputSchema.safeParse({ action: 'replace', ticket: '123', tags: [] }).success
    ).toBe(true);
    expect(TagToolInputSchema.safeParse({ action: 'list', tags: ['x'] }).success).toBe(false);
    expect(
      TagToolInputSchema.safeParse({ action: 'replace', ticket: '123', tags: [], page: 1 }).success
    ).toBe(false);
    expect(TagToolInputSchema.safeParse({ action: 'list', pageSize: 101 }).success).toBe(false);
    const server = buildServer({ api });
    const tools = (
      server as unknown as {
        _registeredTools: Record<
          string,
          {
            annotations: unknown;
            executor: (args: unknown, ctx: unknown) => Promise<{ structuredContent: unknown }>;
          }
        >;
      }
    )._registeredTools;
    expect(tools.freescout_tags.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await tools.freescout_tags.executor(
      { action: 'replace', ticket: '123', tags: [] },
      {}
    );
    expect(result.structuredContent).toMatchObject({
      action: 'replace',
      ticketId: '123',
      tags: [],
    });
  });
});
