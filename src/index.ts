#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio, type ServeStdioOptions } from '@modelcontextprotocol/server/stdio';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { resolveDraftReplyRecipients, shouldInheritDraftRecipients } from './draft-recipients.js';
import { FreeScoutAPI } from './freescout-api.js';
import { installStdioLifecycle, type StdioLifecycle } from './stdio-lifecycle.js';
import { TicketAnalyzer } from './ticket-analyzer.js';
import { SearchFiltersSchema, type FreeScoutRecipients } from './types.js';
import { loadEnv } from './env.js';

type PackageJson = { version: string };
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as PackageJson;

type FreeScoutApiPort = Pick<
  FreeScoutAPI,
  | 'addThread'
  | 'createDraftReply'
  | 'getConversation'
  | 'getMailboxes'
  | 'parseTicketInput'
  | 'searchConversations'
  | 'updateConversation'
>;

type TicketAnalyzerPort = Pick<TicketAnalyzer, 'analyzeConversation' | 'stripHtml'>;

export interface BuildServerOptions {
  api?: FreeScoutApiPort;
  analyzer?: TicketAnalyzerPort;
  defaultUserId?: number;
  version?: string;
}

interface RuntimeConfiguration {
  url: string;
  apiKey: string;
  defaultUserId: number;
}

function loadRuntimeConfiguration(): RuntimeConfiguration {
  loadEnv();

  const url = process.env.FREESCOUT_URL;
  const apiKey = process.env.FREESCOUT_API_KEY;
  const defaultUserId = Number.parseInt(process.env.FREESCOUT_DEFAULT_USER_ID ?? '1', 10);

  if (!url || !apiKey) {
    throw new Error('Missing required environment variables: FREESCOUT_URL and FREESCOUT_API_KEY');
  }

  if (!Number.isSafeInteger(defaultUserId) || defaultUserId < 1) {
    throw new Error('FREESCOUT_DEFAULT_USER_ID must be a positive integer');
  }

  return { url, apiKey, defaultUserId };
}

const allowedThreadTypes = new Set(['customer', 'message', 'note']);
type ThreadType = 'customer' | 'message' | 'note';

const isValidThreadType = (type: unknown): type is ThreadType =>
  typeof type === 'string' && allowedThreadTypes.has(type as ThreadType);

const hasCreatedAt = (createdAt: unknown): createdAt is string =>
  typeof createdAt === 'string' && createdAt.length > 0;

const normalizeThreadBody = (body: unknown) => (typeof body === 'string' ? body : '');

/**
 * Builds a fresh server for each stdio connection. `serveStdio` uses this
 * factory for both the legacy 2025 handshake and the 2026 protocol era.
 */
export function buildServer(options: BuildServerOptions = {}): McpServer {
  const runtime = options.api ? undefined : loadRuntimeConfiguration();
  const api = options.api ?? new FreeScoutAPI(runtime!.url, runtime!.apiKey);
  const analyzer = options.analyzer ?? new TicketAnalyzer();
  const defaultUserId = options.defaultUserId ?? runtime?.defaultUserId ?? 1;
  const server = new McpServer({
    name: 'mcp-freescout',
    version: options.version ?? packageJson.version,
  });

  // Tool 1: Get Ticket
  server.registerTool(
    'freescout_get_ticket',
    {
      title: 'Get FreeScout Ticket',
      description: 'Fetch and analyze a FreeScout ticket by ID or URL',
      inputSchema: z.object({
        ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
        includeThreads: z
          .boolean()
          .optional()
          .default(true)
          .describe('Include all conversation threads'),
      }),
    },
    async ({ ticket, includeThreads }) => {
      const ticketId = api.parseTicketInput(ticket);
      const conversation = await api.getConversation(ticketId, includeThreads ?? true);

      return {
        content: [{ type: 'text', text: JSON.stringify(conversation, null, 2) }],
      };
    }
  );

  // Tool 2: Analyze Ticket
  server.registerTool(
    'freescout_analyze_ticket',
    {
      title: 'Analyze FreeScout Ticket',
      description:
        'Analyze a FreeScout ticket to determine issue type, root cause, and suggested solution',
      inputSchema: z.object({
        ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
      }),
    },
    async ({ ticket }) => {
      const ticketId = api.parseTicketInput(ticket);
      const conversation = await api.getConversation(ticketId, true);
      const analysis = analyzer.analyzeConversation(conversation);

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
        structuredContent: analysis,
      };
    }
  );

  // Tool 3: Add Note
  server.registerTool(
    'freescout_add_note',
    {
      title: 'Add Note to Ticket',
      description: 'Add an internal note to a FreeScout ticket',
      inputSchema: z.object({
        ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
        note: z.string().describe('The note content to add'),
        userId: z.number().optional().describe('User ID for the note (default: from env)'),
      }),
    },
    async ({ ticket, note, userId }) => {
      const ticketId = api.parseTicketInput(ticket);
      const actualUserId = userId ?? defaultUserId;

      await api.addThread(ticketId, 'note', note, actualUserId);

      const output = {
        success: true,
        message: `Note added to ticket #${ticketId}`,
        ticketId,
      };

      return {
        content: [{ type: 'text', text: output.message }],
        structuredContent: output,
      };
    }
  );

  // Tool 4: Update Ticket
  server.registerTool(
    'freescout_update_ticket',
    {
      title: 'Update Ticket Status/Assignment',
      description: 'Update ticket status and/or assignment',
      inputSchema: z.object({
        ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
        status: z
          .enum(['active', 'pending', 'closed', 'spam'])
          .optional()
          .describe('New ticket status'),
        assignTo: z.number().optional().describe('User ID to assign the ticket to'),
        userId: z.number().optional().describe('User ID recording this update (default: from env)'),
      }),
    },
    async ({ ticket, status, assignTo, userId }) => {
      const ticketId = api.parseTicketInput(ticket);

      const updates: {
        status?: 'active' | 'pending' | 'closed' | 'spam';
        assignTo?: number;
        byUser?: number;
      } = { byUser: userId ?? defaultUserId };
      if (status) updates.status = status;
      if (assignTo) updates.assignTo = assignTo;

      await api.updateConversation(ticketId, updates);

      const output = {
        success: true,
        message: `Ticket #${ticketId} updated successfully`,
        ticketId,
      };

      return {
        content: [{ type: 'text', text: output.message }],
        structuredContent: output,
      };
    }
  );

  // Tool 5: Create Draft Reply
  server.registerTool(
    'freescout_create_draft_reply',
    {
      title: 'Create Draft Reply',
      description: 'Create a draft reply in FreeScout that can be edited before sending',
      inputSchema: z.object({
        ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
        replyText: z.string().describe('The draft reply content (generated by the LLM)'),
        userId: z
          .number()
          .optional()
          .describe('User ID creating the draft (defaults to env setting)'),
        to: z
          .array(z.string().email())
          .optional()
          .describe(
            'Optional TO recipients. Omit to preserve existing recipients; pass [] to clear.'
          ),
        cc: z
          .array(z.string().email())
          .optional()
          .describe(
            'Optional CC recipients. Omit to preserve existing recipients; pass [] to clear.'
          ),
        bcc: z
          .array(z.string().email())
          .optional()
          .describe(
            'Optional BCC recipients. Omit to preserve existing recipients; pass [] to clear.'
          ),
      }),
    },
    async ({ ticket, replyText, userId, to, cc, bcc }) => {
      const ticketId = api.parseTicketInput(ticket);
      const actualUserId = userId ?? defaultUserId;
      const requestedRecipients: FreeScoutRecipients = { to, cc, bcc };
      let recipientWarning: string | null = null;

      let inheritedRecipients: FreeScoutRecipients = {};
      if (shouldInheritDraftRecipients(requestedRecipients)) {
        try {
          const conversation = await api.getConversation(ticketId, false);
          inheritedRecipients = {
            to: conversation.to,
            cc: conversation.cc,
            bcc: conversation.bcc,
          };
        } catch {
          recipientWarning =
            'Unable to load existing recipients, so FreeScout default recipients were used for omitted fields.';
        }
      }

      const resolvedRecipients = resolveDraftReplyRecipients(
        requestedRecipients,
        inheritedRecipients
      );

      const draftThread = await api.createDraftReply(
        ticketId,
        replyText,
        actualUserId,
        resolvedRecipients
      );

      const output = {
        success: true,
        message: `Draft reply created successfully in FreeScout ticket #${ticketId}`,
        ticketId,
        draftId: draftThread.id,
      };

      return {
        content: [
          {
            type: 'text',
            text: `✅ ${output.message}\n\nDraft ID: ${draftThread.id}\n\nThe draft reply is now saved in FreeScout and can be reviewed, edited, and sent from the FreeScout interface.${recipientWarning ? `\n\nWarning: ${recipientWarning}` : ''}`,
          },
        ],
        structuredContent: output,
      };
    }
  );

  // Tool 6: Get Ticket Context
  server.registerTool(
    'freescout_get_ticket_context',
    {
      title: 'Get Ticket Context',
      description: 'Get ticket context and customer info to help draft personalized replies',
      inputSchema: z.object({
        ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
      }),
    },
    async ({ ticket }) => {
      const ticketId = api.parseTicketInput(ticket);
      const conversation = await api.getConversation(ticketId, true);
      const analysis = analyzer.analyzeConversation(conversation);

      const threads = conversation._embedded?.threads || [];
      const safeThreads = threads.filter(
        (t) => isValidThreadType(t.type) && hasCreatedAt(t.created_at)
      );
      const customerMessages = safeThreads.filter((t) => t.type === 'customer');
      const teamMessages = safeThreads.filter((t) => t.type === 'message' || t.type === 'note');

      const context = {
        ticketId,
        customer: {
          name: analysis.customerName,
          email: analysis.customerEmail,
        },
        subject: conversation.subject,
        status: conversation.status,
        issueDescription: analysis.issueDescription,
        customerMessages: customerMessages.map((m) => ({
          date: m.created_at,
          content: (() => {
            const body = normalizeThreadBody(m.body);
            const stripped = analyzer.stripHtml(body);
            return stripped.substring(0, 500) + (stripped.length > 500 ? '...' : '');
          })(),
        })),
        teamMessages: teamMessages.slice(-3).map((m) => ({
          date: m.created_at,
          content: (() => {
            const body = normalizeThreadBody(m.body);
            const stripped = analyzer.stripHtml(body);
            return stripped.substring(0, 300) + (stripped.length > 300 ? '...' : '');
          })(),
        })),
        analysis: {
          isBug: analysis.isBug,
          isThirdPartyIssue: analysis.isThirdPartyIssue,
          testedByTeam: analysis.testedByTeam,
          rootCause: analysis.rootCause,
        },
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(context, null, 2) }],
      };
    }
  );

  // Tool 7: Search Tickets
  server.registerTool(
    'freescout_search_tickets',
    {
      title: 'Search FreeScout Tickets',
      description:
        'Search for FreeScout tickets with explicit filter parameters. Use assignee: "unassigned" for unassigned tickets, or assignee: number for specific user. Supports relative time filters like "7d", "24h". Use includeLastMessage: true to get a preview of the most recent message for each ticket.',
      inputSchema: SearchFiltersSchema,
    },
    async (filters) => {
      const results = await api.searchConversations(filters);
      const conversations = results._embedded?.conversations || [];

      // If includeLastMessage is true, fetch threads for each conversation
      // and include a preview of the most recent message
      let conversationsWithPreview = conversations;
      if (filters.includeLastMessage && conversations.length > 0) {
        conversationsWithPreview = await Promise.all(
          conversations.map(async (conv) => {
            try {
              const fullConv = await api.getConversation(String(conv.id), true);
              const threads = fullConv._embedded?.threads || [];

              // Filter to actual messages (customer or message type, not notes)
              const messages = threads
                .filter((t) => t.type === 'customer' || t.type === 'message')
                .filter((t) => hasCreatedAt(t.created_at));

              // Sort by created_at descending and get the most recent
              const sortedMessages = messages.sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
              });

              const lastMessage = sortedMessages[0];
              if (lastMessage) {
                const body = normalizeThreadBody(lastMessage.body);
                const stripped = analyzer.stripHtml(body);
                const preview = stripped.substring(0, 300) + (stripped.length > 300 ? '...' : '');

                return {
                  ...conv,
                  lastMessage: {
                    type: lastMessage.type,
                    date: lastMessage.created_at,
                    preview,
                  },
                };
              }
            } catch {
              // If fetching threads fails, just return the conversation without preview
            }
            return conv;
          })
        );
      }

      const output = {
        conversations: conversationsWithPreview,
        totalCount: results.page?.total_elements || 0,
        page: results.page?.number,
        totalPages: results.page?.total_pages,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      };
    }
  );

  // Tool 8: Get Mailboxes
  server.registerTool(
    'freescout_get_mailboxes',
    {
      title: 'Get Mailboxes',
      description: 'Get list of available mailboxes',
      inputSchema: z.object({}),
    },
    async () => {
      const mailboxes = await api.getMailboxes();

      return {
        content: [{ type: 'text', text: JSON.stringify(mailboxes, null, 2) }],
      };
    }
  );

  return server;
}

export function startStdioServer(options: Omit<ServeStdioOptions, 'onerror'> = {}): StdioLifecycle {
  // Preserve the original launcher PID before any startup work can yield.
  const parentPid = process.ppid;

  // Fail fast before opening stdio, while buildServer still returns a fresh
  // isolated instance for each legacy or modern connection.
  loadRuntimeConfiguration();

  const handle = serveStdio(() => buildServer(), {
    ...options,
    onerror: (error) => {
      console.error('FreeScout MCP server error:', error);
    },
  });

  return installStdioLifecycle({
    handle,
    parentPid,
    onError: (error) => {
      console.error('FreeScout MCP server shutdown error:', error);
    },
  });
}

function main(): void {
  try {
    startStdioServer();
    console.error(`FreeScout MCP Server v${packageJson.version} running...`);
  } catch (error) {
    console.error(
      'FreeScout MCP server startup error:',
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
