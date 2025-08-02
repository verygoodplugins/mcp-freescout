#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
  TextContentSchema,
  ImageContentSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from 'dotenv';
import { execSync } from 'child_process';
import { FreeScoutAPI } from './freescout-api.js';
import { TicketAnalyzer } from './ticket-analyzer.js';
import type { TicketAnalysis, ImplementationPlan } from './types.js';

// Load environment variables
config();

// Validate required environment variables
const FREESCOUT_URL = process.env.FREESCOUT_URL;
const FREESCOUT_API_KEY = process.env.FREESCOUT_API_KEY;
const DEFAULT_USER_ID = parseInt(process.env.FREESCOUT_DEFAULT_USER_ID || '1');

// WORKING_DIRECTORY defaults to current working directory if not specified
// This allows the server to work with the current project context automatically
const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || process.cwd();

if (!FREESCOUT_URL || !FREESCOUT_API_KEY) {
  console.error('Missing required environment variables: FREESCOUT_URL and FREESCOUT_API_KEY');
  process.exit(1);
}

// Initialize API and analyzer
const api = new FreeScoutAPI(FREESCOUT_URL, FREESCOUT_API_KEY);
const analyzer = new TicketAnalyzer();

// Create MCP server
const server = new Server(
  {
    name: 'mcp-freescout',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool schemas
const tools: ToolSchema[] = [
  {
    name: 'freescout_get_ticket',
    description: 'Fetch and analyze a FreeScout ticket by ID or URL',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'string',
          description: 'Ticket ID, ticket number, or FreeScout URL',
        },
        includeThreads: {
          type: 'boolean',
          description: 'Include all conversation threads (default: true)',
          default: true,
        },
      },
      required: ['ticket'],
    },
  },
  {
    name: 'freescout_analyze_ticket',
    description: 'Analyze a FreeScout ticket to determine issue type, root cause, and suggested solution',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'string',
          description: 'Ticket ID, ticket number, or FreeScout URL',
        },
      },
      required: ['ticket'],
    },
  },
  {
    name: 'freescout_add_note',
    description: 'Add an internal note to a FreeScout ticket',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'string',
          description: 'Ticket ID, ticket number, or FreeScout URL',
        },
        note: {
          type: 'string',
          description: 'The note content to add',
        },
        userId: {
          type: 'number',
          description: 'User ID for the note (default: from env)',
        },
      },
      required: ['ticket', 'note'],
    },
  },
  {
    name: 'freescout_update_ticket',
    description: 'Update ticket status and/or assignment',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'string',
          description: 'Ticket ID, ticket number, or FreeScout URL',
        },
        status: {
          type: 'string',
          enum: ['active', 'pending', 'closed', 'spam'],
          description: 'New ticket status',
        },
        assignTo: {
          type: 'number',
          description: 'User ID to assign the ticket to',
        },
      },
      required: ['ticket'],
    },
  },
  {
    name: 'freescout_draft_reply',
    description: 'Generate a draft customer reply based on ticket analysis',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'string',
          description: 'Ticket ID, ticket number, or FreeScout URL',
        },
        fixDescription: {
          type: 'string',
          description: 'Description of the fix or solution implemented',
        },
        isExplanatory: {
          type: 'boolean',
          description: 'Whether this is an explanatory reply (no code changes)',
          default: false,
        },
      },
      required: ['ticket'],
    },
  },
  {
    name: 'freescout_search_tickets',
    description: 'Search for FreeScout tickets',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        status: {
          type: 'string',
          enum: ['active', 'pending', 'closed', 'spam', 'all'],
          description: 'Filter by status (default: all)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'git_create_worktree',
    description: 'Create a Git worktree for working on a ticket',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Ticket ID for the worktree',
        },
        branchName: {
          type: 'string',
          description: 'Branch name (default: fix/freescout-{ticketId})',
        },
        baseBranch: {
          type: 'string',
          description: 'Base branch to create from (default: master)',
          default: 'master',
        },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'git_remove_worktree',
    description: 'Remove a Git worktree after work is complete',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Ticket ID of the worktree to remove',
        },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'freescout_implement_ticket',
    description: 'Full workflow: analyze ticket, create worktree, and prepare implementation plan',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'string',
          description: 'Ticket ID, ticket number, or FreeScout URL',
        },
        additionalContext: {
          type: 'string',
          description: 'Additional context or suggestions for implementation',
        },
        autoCreateWorktree: {
          type: 'boolean',
          description: 'Automatically create Git worktree (default: true)',
          default: true,
        },
      },
      required: ['ticket'],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'freescout_get_ticket': {
        const ticketId = api.parseTicketInput(args.ticket as string);
        const conversation = await api.getConversation(
          ticketId,
          args.includeThreads !== false
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(conversation, null, 2),
            },
          ],
        };
      }

      case 'freescout_analyze_ticket': {
        const ticketId = api.parseTicketInput(args.ticket as string);
        const conversation = await api.getConversation(ticketId, true);
        const analysis = analyzer.analyzeConversation(conversation);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(analysis, null, 2),
            },
          ],
        };
      }

      case 'freescout_add_note': {
        const ticketId = api.parseTicketInput(args.ticket as string);
        const userId = args.userId || DEFAULT_USER_ID;
        
        const thread = await api.addThread(
          ticketId,
          'note',
          args.note as string,
          userId as number
        );
        
        return {
          content: [
            {
              type: 'text',
              text: `Note added to ticket #${ticketId}`,
            },
          ],
        };
      }

      case 'freescout_update_ticket': {
        const ticketId = api.parseTicketInput(args.ticket as string);
        
        const updates: any = {
          byUser: DEFAULT_USER_ID,
        };
        
        if (args.status) {
          updates.status = args.status;
        }
        
        if (args.assignTo) {
          updates.assignTo = args.assignTo;
        }
        
        const updated = await api.updateConversation(ticketId, updates);
        
        return {
          content: [
            {
              type: 'text',
              text: `Ticket #${ticketId} updated successfully`,
            },
          ],
        };
      }

      case 'freescout_draft_reply': {
        const ticketId = api.parseTicketInput(args.ticket as string);
        const conversation = await api.getConversation(ticketId, true);
        const analysis = analyzer.analyzeConversation(conversation);
        
        const reply = analyzer.generateCustomerReply(
          analysis,
          args.fixDescription as string,
          args.isExplanatory as boolean
        );
        
        return {
          content: [
            {
              type: 'text',
              text: reply,
            },
          ],
        };
      }

      case 'freescout_search_tickets': {
        const results = await api.searchConversations(
          args.query as string,
          args.status as string
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'git_create_worktree': {
        const ticketId = args.ticketId as string;
        const branchName = args.branchName || `fix/freescout-${ticketId}`;
        const baseBranch = args.baseBranch || 'master';
        const worktreeDir = `${WORKING_DIRECTORY}/worktrees/ticket-${ticketId}`;
        
        try {
          // Create worktrees directory if it doesn't exist
          execSync(`mkdir -p ${WORKING_DIRECTORY}/worktrees`, { cwd: WORKING_DIRECTORY });
          
          // Create worktree
          execSync(
            `git worktree add "${worktreeDir}" -b "${branchName}" ${baseBranch}`,
            { cwd: WORKING_DIRECTORY }
          );
          
          // Add to .gitignore if needed
          try {
            const gitignore = execSync(`cat ${WORKING_DIRECTORY}/.gitignore`, { encoding: 'utf-8' });
            if (!gitignore.includes('worktrees/')) {
              execSync(`echo "worktrees/" >> ${WORKING_DIRECTORY}/.gitignore`, { cwd: WORKING_DIRECTORY });
            }
          } catch {
            // .gitignore might not exist
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `✅ Created worktree at: ${worktreeDir}\n✅ Working on branch: ${branchName}\n✅ Ready for implementation`,
              },
            ],
          };
        } catch (error: any) {
          throw new Error(`Failed to create worktree: ${error.message}`);
        }
      }

      case 'git_remove_worktree': {
        const ticketId = args.ticketId as string;
        const worktreeDir = `${WORKING_DIRECTORY}/worktrees/ticket-${ticketId}`;
        
        try {
          execSync(`git worktree remove "${worktreeDir}"`, { cwd: WORKING_DIRECTORY });
          
          return {
            content: [
              {
                type: 'text',
                text: `✅ Worktree removed for ticket #${ticketId}`,
              },
            ],
          };
        } catch (error: any) {
          throw new Error(`Failed to remove worktree: ${error.message}`);
        }
      }

      case 'freescout_implement_ticket': {
        const ticketId = api.parseTicketInput(args.ticket as string);
        const conversation = await api.getConversation(ticketId, true);
        const analysis = analyzer.analyzeConversation(conversation);
        
        let worktreeInfo = '';
        if (args.autoCreateWorktree !== false) {
          try {
            const branchName = `fix/freescout-${ticketId}`;
            const worktreeDir = `${WORKING_DIRECTORY}/worktrees/ticket-${ticketId}`;
            
            execSync(`mkdir -p ${WORKING_DIRECTORY}/worktrees`, { cwd: WORKING_DIRECTORY });
            execSync(
              `git worktree add "${worktreeDir}" -b "${branchName}" master`,
              { cwd: WORKING_DIRECTORY }
            );
            
            worktreeInfo = `\n\n## Git Worktree Created\n- Branch: ${branchName}\n- Location: ${worktreeDir}`;
          } catch (error: any) {
            worktreeInfo = `\n\n⚠️ Could not create worktree: ${error.message}`;
          }
        }
        
        const plan: ImplementationPlan = {
          issue: analysis.issueDescription,
          rootCause: analysis.rootCause || 'To be determined',
          solution: analysis.suggestedSolution || 'To be implemented',
          filesToModify: [],
          alternativeApproaches: [],
          hasBreakingChanges: false,
          requiresDocumentationUpdate: false,
        };
        
        const output = `# FreeScout Ticket #${ticketId} Implementation Plan

## Customer Information
- Name: ${analysis.customerName}
- Email: ${analysis.customerEmail}

## Issue Analysis
- **Is Bug**: ${analysis.isBug ? 'Yes' : 'No'}
- **Is Third-Party Issue**: ${analysis.isThirdPartyIssue ? 'Yes' : 'No'}
- **Tested by Team**: ${analysis.testedByTeam ? 'Yes' : 'No'}
- **Reproducible**: ${analysis.isReproducible ? 'Yes' : 'No'}

## Issue Description
${analysis.issueDescription}

## Root Cause
${plan.rootCause}

## Proposed Solution
${plan.solution}

${analysis.codeSnippets.length > 0 ? `## Code Snippets from Ticket\n${analysis.codeSnippets.join('\n\n')}` : ''}

${analysis.errorMessages.length > 0 ? `## Error Messages\n${analysis.errorMessages.join('\n')}` : ''}

${analysis.hasAttachments ? `## Attachments\n${analysis.attachments.join('\n')}` : ''}

${args.additionalContext ? `## Additional Context\n${args.additionalContext}` : ''}

${worktreeInfo}

## Next Steps
1. Review the analysis above
2. ${analysis.isBug ? 'Implement the fix in the worktree' : 'Draft an explanatory reply'}
3. Test the changes
4. Create a pull request
5. Update the FreeScout ticket`;

        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FreeScout MCP Server running...');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});