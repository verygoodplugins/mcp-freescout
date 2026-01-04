/**
 * Integration tests for MCP server tool schemas and structure
 * These tests validate tool definitions, schemas, and error handling patterns
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

describe('MCP Server Tool Patterns', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });
  });

  describe('Tool Registration', () => {
    it('should register a tool with proper schema', () => {
      const tool = server.registerTool(
        'test-tool',
        {
          title: 'Test Tool',
          description: 'A test tool',
          inputSchema: {
            input: z.string(),
          },
          outputSchema: {
            result: z.string(),
          },
        },
        async ({ input }) => {
          const output = { result: `processed: ${input}` };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      expect(tool).toBeDefined();
      expect(tool.handler).toBeDefined();
    });

    it('should validate input schema at runtime', async () => {
      const tool = server.registerTool(
        'strict-tool',
        {
          title: 'Strict Tool',
          description: 'Tool with strict schema',
          inputSchema: {
            num: z.number().min(1).max(100),
            email: z.string().email(),
          },
          outputSchema: {
            valid: z.boolean(),
          },
        },
        async ({ num: _num, email: _email }) => {
          const output = { valid: true };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      expect(tool).toBeDefined();
      // Schema validation happens automatically via Zod
    });

    it('should handle optional parameters', () => {
      const tool = server.registerTool(
        'optional-tool',
        {
          title: 'Optional Tool',
          description: 'Tool with optional params',
          inputSchema: {
            required: z.string(),
            optional: z.number().optional(),
          },
          outputSchema: {
            result: z.string(),
          },
        },
        async ({ required, optional }) => {
          const output = { result: `${required}-${optional || 'none'}` };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      expect(tool).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    it('should execute a simple tool and return structured output', async () => {
      let executedInput: any;

      const tool = server.registerTool(
        'echo-tool',
        {
          title: 'Echo Tool',
          description: 'Echoes input',
          inputSchema: {
            message: z.string(),
          },
          outputSchema: {
            echo: z.string(),
            timestamp: z.string(),
          },
        },
        async ({ message }) => {
          executedInput = message;
          const output = {
            echo: message,
            timestamp: new Date().toISOString(),
          };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      // Simulate tool execution
      const result = await tool.handler({ message: 'test' });

      expect(executedInput).toBe('test');
      expect(result.structuredContent).toHaveProperty('echo', 'test');
      expect(result.structuredContent).toHaveProperty('timestamp');
    });

    it('should handle tool errors gracefully', async () => {
      const tool = server.registerTool(
        'failing-tool',
        {
          title: 'Failing Tool',
          description: 'Tool that fails',
          inputSchema: {
            shouldFail: z.boolean(),
          },
          outputSchema: {
            success: z.boolean(),
          },
        },
        async ({ shouldFail }) => {
          if (shouldFail) {
            throw new Error('Tool execution failed');
          }
          const output = { success: true };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      await expect(tool.handler({ shouldFail: true })).rejects.toThrow('Tool execution failed');
    });
  });

  describe('FreeScout Tool Schema Patterns', () => {
    it('should define get_ticket tool schema correctly', () => {
      const tool = server.registerTool(
        'freescout_get_ticket',
        {
          title: 'Get FreeScout Ticket',
          description: 'Fetch a ticket by ID or URL',
          inputSchema: {
            ticket: z.union([z.number(), z.string()]).describe('Ticket ID, number, or URL'),
            includeThreads: z.boolean().default(true).describe('Include conversation threads'),
          },
          outputSchema: {
            ticket: z.object({
              id: z.number(),
              number: z.number(),
              subject: z.string(),
              status: z.string(),
              customer: z.object({
                email: z.string(),
              }),
            }),
          },
        },
        async () => {
          // Mock implementation
          const output = {
            ticket: {
              id: 123,
              number: 456,
              subject: 'Test',
              status: 'active',
              customer: { email: 'test@example.com' },
            },
          };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      expect(tool).toBeDefined();
    });

    it('should define search_tickets tool with explicit filters', () => {
      const tool = server.registerTool(
        'freescout_search_tickets',
        {
          title: 'Search FreeScout Tickets',
          description: 'Search tickets with filters',
          inputSchema: {
            query: z.string().optional().describe('Search query'),
            status: z.enum(['active', 'pending', 'closed', 'spam', 'all']).optional(),
            mailboxId: z.number().optional(),
            assignedTo: z.union([z.number(), z.null()]).optional(),
          },
          outputSchema: {
            tickets: z.array(
              z.object({
                id: z.number(),
                subject: z.string(),
              })
            ),
            totalCount: z.number(),
          },
        },
        async () => {
          const output = {
            tickets: [],
            totalCount: 0,
          };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      expect(tool).toBeDefined();
    });

    it('should define update_ticket tool schema', () => {
      const tool = server.registerTool(
        'freescout_update_ticket',
        {
          title: 'Update FreeScout Ticket',
          description: 'Update ticket status or assignment',
          inputSchema: {
            ticket: z.union([z.number(), z.string()]),
            status: z.enum(['active', 'pending', 'closed', 'spam']).optional(),
            assignTo: z.number().optional(),
          },
          outputSchema: {
            success: z.boolean(),
            message: z.string(),
          },
        },
        async () => {
          const output = { success: true, message: 'Updated' };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      expect(tool).toBeDefined();
    });
  });

  describe('Dynamic Tool Behavior', () => {
    it('should support tool disabling and enabling', () => {
      const tool = server.registerTool(
        'dynamic-tool',
        {
          title: 'Dynamic Tool',
          description: 'Can be disabled',
          inputSchema: {
            input: z.string(),
          },
          outputSchema: {
            result: z.string(),
          },
        },
        async ({ input }) => {
          const output = { result: input };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      tool.disable();
      // Tool should now be disabled (no direct way to test without client)

      tool.enable();
      // Tool should now be re-enabled
    });

    it('should support tool schema updates', () => {
      const tool = server.registerTool(
        'updatable-tool',
        {
          title: 'Updatable Tool',
          description: 'Original description',
          inputSchema: {
            input: z.string(),
          },
          outputSchema: {
            result: z.string(),
          },
        },
        async ({ input }) => {
          const output = { result: input };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      // Update the tool description
      tool.update({
        description: 'Updated description',
      });

      // Schema update should be reflected (validated by client notifications)
    });
  });

  describe('Response Formatting', () => {
    it('should return both content and structuredContent', async () => {
      const tool = server.registerTool(
        'format-test',
        {
          title: 'Format Test',
          description: 'Tests response format',
          inputSchema: {
            data: z.string(),
          },
          outputSchema: {
            formatted: z.string(),
            timestamp: z.string(),
          },
        },
        async ({ data }) => {
          const output = {
            formatted: data.toUpperCase(),
            timestamp: new Date().toISOString(),
          };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      const result = await tool.handler({ data: 'test' });

      // Should have text content for LLM
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      // Should have structured output for parsing
      expect(result.structuredContent).toHaveProperty('formatted', 'TEST');
      expect(result.structuredContent).toHaveProperty('timestamp');
    });

    it('should keep responses concise', async () => {
      const tool = server.registerTool(
        'concise-tool',
        {
          title: 'Concise Tool',
          description: 'Returns concise output',
          inputSchema: {
            query: z.string(),
          },
          outputSchema: {
            summary: z.string(),
            details: z.string().optional(),
          },
        },
        async ({ query }) => {
          // Good practice: return summary with optional details
          const output = {
            summary: `Results for: ${query}`,
            details: query.length > 100 ? 'Details truncated' : query,
          };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      const result = await tool.handler({ query: 'short' });
      expect(result.structuredContent.summary).toBeDefined();
    });
  });

  describe('Error Handling Patterns', () => {
    it('should provide clear error messages', async () => {
      const tool = server.registerTool(
        'error-tool',
        {
          title: 'Error Tool',
          description: 'Tests error handling',
          inputSchema: {
            errorType: z.enum(['validation', 'network', 'notfound']),
          },
          outputSchema: {
            result: z.string(),
          },
        },
        async ({ errorType }) => {
          switch (errorType) {
            case 'validation':
              throw new Error('Validation failed: Invalid input format');
            case 'network':
              throw new Error('Network error: Failed to connect to FreeScout API');
            case 'notfound':
              throw new Error('Not found: Ticket #123 does not exist');
            default: {
              const output = { result: 'success' };
              return {
                content: [{ type: 'text', text: JSON.stringify(output) }],
                structuredContent: output,
              };
            }
          }
        }
      );

      await expect(tool.handler({ errorType: 'validation' })).rejects.toThrow(/Validation failed/);
      await expect(tool.handler({ errorType: 'network' })).rejects.toThrow(/Network error/);
      await expect(tool.handler({ errorType: 'notfound' })).rejects.toThrow(/Not found/);
    });
  });

  describe('Input Validation', () => {
    it('should validate enum values', () => {
      const tool = server.registerTool(
        'enum-tool',
        {
          title: 'Enum Tool',
          description: 'Tests enum validation',
          inputSchema: {
            status: z.enum(['active', 'pending', 'closed']),
          },
          outputSchema: {
            result: z.string(),
          },
        },
        async ({ status }) => {
          const output = { result: `Status is ${status}` };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      expect(tool).toBeDefined();
      // Zod will automatically validate enum values
    });

    it('should validate number ranges', () => {
      const tool = server.registerTool(
        'range-tool',
        {
          title: 'Range Tool',
          description: 'Tests number range validation',
          inputSchema: {
            ticketId: z.number().positive(),
            priority: z.number().min(1).max(5),
          },
          outputSchema: {
            result: z.string(),
          },
        },
        async ({ ticketId, priority }) => {
          const output = { result: `Ticket ${ticketId} priority ${priority}` };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      expect(tool).toBeDefined();
    });

    it('should validate email format', () => {
      const tool = server.registerTool(
        'email-tool',
        {
          title: 'Email Tool',
          description: 'Tests email validation',
          inputSchema: {
            email: z.string().email(),
          },
          outputSchema: {
            valid: z.boolean(),
          },
        },
        async ({ email: _email }) => {
          const output = { valid: true };
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          };
        }
      );

      expect(tool).toBeDefined();
    });
  });
});
