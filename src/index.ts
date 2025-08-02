#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
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

// Helper function to extract GitHub repo from git remote
function getGitHubRepo(): string | undefined {
  if (process.env.GITHUB_REPO) {
    return process.env.GITHUB_REPO;
  }
  
  try {
    // Try to get the GitHub remote URL
    const remoteUrl = execSync('git remote get-url origin 2>/dev/null', { 
      cwd: WORKING_DIRECTORY,
      encoding: 'utf-8' 
    }).trim();
    
    // Parse GitHub repo from various URL formats
    // SSH: git@github.com:owner/repo.git
    // HTTPS: https://github.com/owner/repo.git
    // HTTPS no .git: https://github.com/owner/repo
    
    let match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)(\.git)?$/);
    if (match) {
      return match[1];
    }
    
    // Try without .git extension
    match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/]+)$/);
    if (match) {
      return match[1];
    }
  } catch (error) {
    // Git command failed or no remote found
    console.error('Could not auto-detect GitHub repository. Set GITHUB_REPO environment variable if needed.');
  }
  
  return undefined;
}

// Get GitHub configuration
const GITHUB_REPO = getGitHubRepo();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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
const tools: Tool[] = [
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
    name: 'freescout_create_draft_reply',
    description: 'Create a draft reply in FreeScout that can be edited before sending',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: {
          type: 'string',
          description: 'Ticket ID, ticket number, or FreeScout URL',
        },
        replyText: {
          type: 'string',
          description: 'The draft reply content (generated by the LLM)',
        },
        userId: {
          type: 'number',
          description: 'User ID creating the draft (defaults to env setting)',
        },
      },
      required: ['ticket', 'replyText'],
    },
  },
  {
    name: 'freescout_get_ticket_context',
    description: 'Get ticket context and customer info to help draft personalized replies',
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
    name: 'github_create_pr',
    description: 'Create a GitHub pull request for the current branch',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'PR title',
        },
        body: {
          type: 'string',
          description: 'PR description/body',
        },
        ticketId: {
          type: 'string',
          description: 'FreeScout ticket ID for reference',
        },
        branch: {
          type: 'string',
          description: 'Branch name (defaults to current branch)',
        },
        baseBranch: {
          type: 'string',
          description: 'Base branch (default: master)',
          default: 'master',
        },
        draft: {
          type: 'boolean',
          description: 'Create as draft PR (default: false)',
          default: false,
        },
      },
      required: ['title', 'body'],
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
  const { name, arguments: args } = request.params || {};
  if (!args) {
    throw new Error('Arguments are missing');
  }

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

      case 'freescout_create_draft_reply': {
        const ticketId = api.parseTicketInput(args.ticket as string);
        const replyText = args.replyText as string;
        const userId = args.userId as number || DEFAULT_USER_ID;
        
        try {
          const draftThread = await api.createDraftReply(ticketId, replyText, userId);
          
          return {
            content: [
              {
                type: 'text',
                text: `✅ Draft reply created successfully in FreeScout ticket #${ticketId}\n\nDraft ID: ${draftThread.id}\n\nThe draft reply is now saved in FreeScout and can be reviewed, edited, and sent from the FreeScout interface.`,
              },
            ],
          };
        } catch (error: any) {
          throw new Error(`Failed to create draft reply: ${error.message}`);
        }
      }

      case 'freescout_get_ticket_context': {
        const ticketId = api.parseTicketInput(args.ticket as string);
        const conversation = await api.getConversation(ticketId, true);
        const analysis = analyzer.analyzeConversation(conversation);
        
        const threads = conversation._embedded?.threads || [];
        const customerMessages = threads.filter(t => t.type === 'customer');
        const teamMessages = threads.filter(t => t.type === 'message' || t.type === 'note');
        
        const context = {
          ticketId,
          customer: {
            name: analysis.customerName,
            email: analysis.customerEmail,
          },
          subject: conversation.subject,
          status: conversation.status,
          issueDescription: analysis.issueDescription,
          customerMessages: customerMessages.map(m => ({
            date: m.created_at,
            content: analyzer.stripHtml(m.body).substring(0, 500) + (analyzer.stripHtml(m.body).length > 500 ? '...' : ''),
          })),
          teamMessages: teamMessages.slice(-3).map(m => ({ // Last 3 team messages for context
            date: m.created_at,
            content: analyzer.stripHtml(m.body).substring(0, 300) + (analyzer.stripHtml(m.body).length > 300 ? '...' : ''),
          })),
          analysis: {
            isBug: analysis.isBug,
            isThirdPartyIssue: analysis.isThirdPartyIssue,
            testedByTeam: analysis.testedByTeam,
            rootCause: analysis.rootCause,
          },
        };
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(context, null, 2),
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

      case 'github_create_pr': {
        if (!GITHUB_TOKEN) {
          return {
            content: [
              {
                type: 'text',
                text: '⚠️ GitHub token not configured. Please set GITHUB_TOKEN environment variable to create PRs.',
              },
            ],
          };
        }

        if (!GITHUB_REPO) {
          return {
            content: [
              {
                type: 'text',
                text: '⚠️ Could not detect GitHub repository. Please ensure you are in a Git repository with a GitHub remote, or set GITHUB_REPO environment variable.',
              },
            ],
          };
        }

        const title = args.title as string;
        const body = args.body as string;
        const ticketId = args.ticketId as string;
        const branch = args.branch as string || '';
        const baseBranch = args.baseBranch as string || 'master';
        const draft = args.draft as boolean || false;

        try {
          // If ticketId is provided, add FreeScout link to the body
          let enhancedBody = body;
          if (ticketId) {
            enhancedBody = `${body}\n\n---\n\nFreeScout Ticket: ${FREESCOUT_URL}/conversation/${ticketId}`;
          }

          // Create the PR using GitHub CLI
          const draftFlag = draft ? '--draft' : '';
          const branchFlag = branch ? `--head ${branch}` : '';
          
          const command = `gh pr create --repo ${GITHUB_REPO} --title "${title.replace(/"/g, '\\"')}" --body "${enhancedBody.replace(/"/g, '\\"')}" --base ${baseBranch} ${draftFlag} ${branchFlag}`.trim();
          
          const result = execSync(command, { 
            cwd: WORKING_DIRECTORY,
            encoding: 'utf-8',
            env: {
              ...process.env,
              GH_TOKEN: GITHUB_TOKEN,
            }
          }).trim();

          return {
            content: [
              {
                type: 'text',
                text: `✅ Pull request created successfully!\n\n${result}`,
              },
            ],
          };
        } catch (error: any) {
          // Check if gh CLI is installed
          if (error.message.includes('gh: command not found')) {
            return {
              content: [
                {
                  type: 'text',
                  text: '⚠️ GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/ or create the PR manually.',
                },
              ],
            };
          }
          
          throw new Error(`Failed to create PR: ${error.message}`);
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

${GITHUB_REPO ? `## GitHub Repository\n- Repository: ${GITHUB_REPO}\n- Ready for PR creation with \`github_create_pr\` tool` : '## GitHub Repository\n- ⚠️ No GitHub repository detected. Set GITHUB_REPO env variable if needed.'}

## Next Steps
1. Review the analysis above
2. ${analysis.isBug ? 'Implement the fix in the worktree' : 'Draft an explanatory reply'}
3. Test the changes
4. Create a pull request${GITHUB_REPO ? ' using `github_create_pr` tool' : ''}
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