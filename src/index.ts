#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from 'dotenv';
import { z } from 'zod';
import { FreeScoutAPI } from './freescout-api.js';
import { TicketAnalyzer } from './ticket-analyzer.js';
import { ConversationSchema, TicketAnalysisSchema, SearchFiltersSchema } from './types.js';

// Load environment variables
config();

// Validate required environment variables
const FREESCOUT_URL = process.env.FREESCOUT_URL;
const FREESCOUT_API_KEY = process.env.FREESCOUT_API_KEY;
const DEFAULT_USER_ID = parseInt(process.env.FREESCOUT_DEFAULT_USER_ID || '1');

if (!FREESCOUT_URL || !FREESCOUT_API_KEY) {
  console.error('Missing required environment variables: FREESCOUT_URL and FREESCOUT_API_KEY');
  process.exit(1);
}

// Initialize API and analyzer
const api = new FreeScoutAPI(FREESCOUT_URL, FREESCOUT_API_KEY);
const analyzer = new TicketAnalyzer();

// Create MCP server with new McpServer class
const server = new McpServer({
  name: 'mcp-freescout',
  version: '2.0.0',
});

// Tool 1: Get Ticket
server.registerTool(
  'freescout_get_ticket',
  {
    title: 'Get FreeScout Ticket',
    description: 'Fetch and analyze a FreeScout ticket by ID or URL',
    inputSchema: {
      ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
      includeThreads: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include all conversation threads'),
    },
    outputSchema: ConversationSchema,
  },
  async ({ ticket, includeThreads }) => {
    const ticketId = api.parseTicketInput(ticket);
    const conversation = await api.getConversation(ticketId, includeThreads ?? true);

    return {
      content: [{ type: 'text', text: JSON.stringify(conversation, null, 2) }],
      structuredContent: conversation,
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
    inputSchema: {
      ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
    },
    outputSchema: TicketAnalysisSchema,
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
    inputSchema: {
      ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
      note: z.string().describe('The note content to add'),
      userId: z.number().optional().describe('User ID for the note (default: from env)'),
    },
    outputSchema: {
      success: z.boolean(),
      message: z.string(),
      ticketId: z.string(),
    },
  },
  async ({ ticket, note, userId }) => {
    const ticketId = api.parseTicketInput(ticket);
    const actualUserId = userId ?? DEFAULT_USER_ID;

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
    inputSchema: {
      ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
      status: z
        .enum(['active', 'pending', 'closed', 'spam'])
        .optional()
        .describe('New ticket status'),
      assignTo: z.number().optional().describe('User ID to assign the ticket to'),
    },
    outputSchema: {
      success: z.boolean(),
      message: z.string(),
      ticketId: z.string(),
    },
  },
  async ({ ticket, status, assignTo }) => {
    const ticketId = api.parseTicketInput(ticket);

    const updates: {
      status?: 'active' | 'pending' | 'closed' | 'spam';
      assignTo?: number;
      byUser?: number;
    } = { byUser: DEFAULT_USER_ID };
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
    inputSchema: {
      ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
      replyText: z.string().describe('The draft reply content (generated by the LLM)'),
      userId: z
        .number()
        .optional()
        .describe('User ID creating the draft (defaults to env setting)'),
    },
    outputSchema: {
      success: z.boolean(),
      message: z.string(),
      ticketId: z.string(),
      draftId: z.number(),
    },
  },
  async ({ ticket, replyText, userId }) => {
    const ticketId = api.parseTicketInput(ticket);
    const actualUserId = userId ?? DEFAULT_USER_ID;

    const draftThread = await api.createDraftReply(ticketId, replyText, actualUserId);

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
          text: `✅ ${output.message}\n\nDraft ID: ${draftThread.id}\n\nThe draft reply is now saved in FreeScout and can be reviewed, edited, and sent from the FreeScout interface.`,
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
    inputSchema: {
      ticket: z.string().describe('Ticket ID, ticket number, or FreeScout URL'),
    },
    outputSchema: {
      ticketId: z.string(),
      customer: z.object({
        name: z.string(),
        email: z.string(),
      }),
      subject: z.string(),
      status: z.string(),
      issueDescription: z.string(),
      customerMessages: z.array(
        z.object({
          date: z.string(),
          content: z.string(),
        })
      ),
      teamMessages: z.array(
        z.object({
          date: z.string(),
          content: z.string(),
        })
      ),
      analysis: z.object({
        isBug: z.boolean(),
        isThirdPartyIssue: z.boolean(),
        testedByTeam: z.boolean(),
        rootCause: z.string().optional(),
      }),
    },
  },
  async ({ ticket }) => {
    const ticketId = api.parseTicketInput(ticket);
    const conversation = await api.getConversation(ticketId, true);
    const analysis = analyzer.analyzeConversation(conversation);

    const threads = conversation._embedded?.threads || [];
    const customerMessages = threads.filter((t) => t.type === 'customer');
    const teamMessages = threads.filter((t) => t.type === 'message' || t.type === 'note');

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
        content:
          analyzer.stripHtml(m.body).substring(0, 500) +
          (analyzer.stripHtml(m.body).length > 500 ? '...' : ''),
      })),
      teamMessages: teamMessages.slice(-3).map((m) => ({
        date: m.created_at,
        content:
          analyzer.stripHtml(m.body).substring(0, 300) +
          (analyzer.stripHtml(m.body).length > 300 ? '...' : ''),
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
      structuredContent: context,
    };
  }
);

// Tool 7: Search Tickets
server.registerTool(
  'freescout_search_tickets',
  {
    title: 'Search FreeScout Tickets',
    description:
      'Search for FreeScout tickets with explicit filter parameters. Use assignee: "unassigned" for unassigned tickets, or assignee: number for specific user. Supports relative time filters like "7d", "24h".',
    inputSchema: SearchFiltersSchema,
    outputSchema: {
      conversations: z.array(ConversationSchema),
      totalCount: z.number(),
      page: z.number().optional(),
      totalPages: z.number().optional(),
    },
  },
  async (filters) => {
    const results = await api.searchConversations(filters);

    const output = {
      conversations: results._embedded?.conversations || [],
      totalCount: results.page?.total_elements || 0,
      page: results.page?.number,
      totalPages: results.page?.total_pages,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// Tool 8: Get Mailboxes
server.registerTool(
  'freescout_get_mailboxes',
  {
    title: 'Get Mailboxes',
    description: 'Get list of available mailboxes',
    inputSchema: {},
    outputSchema: {
      mailboxes: z.array(z.any()),
    },
  },
  async () => {
    const mailboxes = await api.getMailboxes();

    const output = { mailboxes };

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FreeScout MCP Server v2.0.0 running...');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
