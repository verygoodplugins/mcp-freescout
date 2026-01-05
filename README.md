# FreeScout MCP Server

An MCP (Model Context Protocol) server for FreeScout helpdesk ticket management. This server provides tools to interact with FreeScout tickets, analyze issues, and manage customer responses.

## Features

- 🎫 **Ticket Management**: Fetch, analyze, and update FreeScout tickets
- 🔍 **Intelligent Analysis**: Automatically analyze tickets to determine issue type, root cause, and solutions
- 💬 **Draft Responses**: Generate customer replies based on ticket analysis
- 📊 **Advanced Search**: First-class filter parameters with relative time support ("7d", "24h")
- 🔒 **Type Safety**: Full Zod schema validation with structured outputs
- 🔁 **Reliability**: Automatic retry logic with exponential backoff for transient failures
- ⚡ **Modern SDK**: Built on MCP SDK 1.25+ with `McpServer` and `registerTool()` patterns

## What's New in v2.0

**Breaking Changes:**

- Search API redesigned with explicit filter parameters instead of query-string syntax
- Migrated to modern `McpServer` class with structured outputs
- Removed Git/GitHub tools (use dedicated Git MCP servers for workflow automation)

**New Features:**

- Explicit search filters: `assignee`, `updatedSince`, `createdSince`, `page`, `pageSize`
- Relative time support: Use "7d", "24h", "30m" in date filters
- Exponential backoff retry logic for network errors and rate limits
- Structured content responses for better type safety
- Full Zod schema validation throughout

See [CHANGELOG.md](CHANGELOG.md) for migration guide.

## Installation

### Prerequisites

- Node.js 18 or higher
- FreeScout instance with API access enabled

## Quick Start (Recommended)

The easiest way to use this MCP server is with `npx`:

### With Claude Desktop

Add this to your Claude Desktop settings (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "freescout": {
      "command": "npx @verygoodplugins/mcp-freescout@latest",
      "env": {
        "FREESCOUT_URL": "https://your-freescout-domain.com",
        "FREESCOUT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### With Cursor IDE

Add this to your Cursor MCP settings:

**Method 1: Via Cursor Settings UI**

1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Search for "MCP"
3. Click "Edit in settings.json"
4. Add the MCP server configuration

**Method 2: Manual Configuration**
Add this to your Cursor settings.json or create `~/.cursor/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "freescout": {
        "command": "npx",
        "args": ["@verygoodplugins/mcp-freescout@latest"],
        "env": {
          "FREESCOUT_URL": "https://your-freescout-domain.com",
          "FREESCOUT_API_KEY": "your-api-key-here"
        }
      }
    }
  }
}
```

That's it! The server will automatically use your current workspace directory for Git operations.

## Manual Installation (Alternative)

If you prefer to install and run the server locally:

1. Clone this repository:

```bash
git clone https://github.com/verygoodplugins/mcp-freescout.git
cd mcp-freescout
```

2. Install dependencies:

```bash
npm install
```

3. Build the TypeScript code:

```bash
npm run build
```

4. Configure your MCP client to use the local installation:

```json
{
  "mcpServers": {
    "freescout": {
      "command": "node",
      "args": ["/path/to/mcp-freescout/dist/index.js"],
      "env": {
        "FREESCOUT_URL": "https://your-freescout-domain.com",
        "FREESCOUT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Usage with Other MCP Clients

Run the server directly:

```bash
npm start
```

Or in development mode with auto-reload:

```bash
npm run dev
```

## Available Tools

### Core Ticket Operations

#### `freescout_get_ticket`

Fetch a FreeScout ticket with all its details and conversation threads.

**Parameters:**

- `ticket` (required): Ticket ID, number, or FreeScout URL
- `includeThreads` (optional): Include conversation threads (default: true)

**Natural Language Examples:**

- "Show me ticket #12345"
- "Get the details for FreeScout ticket 34811"
- "Fetch ticket https://support.example.com/conversation/12345"
- "What's in ticket 12345?"
- "Pull up the conversation for ticket #34811"

**Example:**

```javascript
{
  "ticket": "12345",
  "includeThreads": true
}
```

**Example: Fetching a FreeScout ticket with conversation threads**

![FreeScout ticket details and conversation threads displayed in Cursor chat interface](https://github.com/user-attachments/assets/0144056d-f6d6-4275-9f55-dade0be3ba8c)

#### `freescout_analyze_ticket`

Analyze a ticket to determine issue type, root cause, and suggested solutions.

**Parameters:**

- `ticket` (required): Ticket ID, number, or FreeScout URL

**Natural Language Examples:**

- "Analyze ticket #12345"
- "What kind of issue is ticket 34811?"
- "Can you analyze this ticket and tell me if it's a bug?"
- "Examine ticket #12345 and determine the root cause"
- "Is this ticket a bug or feature request?"

**Returns:**

- Customer information
- Issue description and classification
- Code snippets and error messages
- Reproducibility status
- Root cause analysis
- Bug vs feature request vs third-party issue determination

**Example: Intelligent ticket analysis with issue classification**

![Ticket analysis showing issue type, root cause, and implementation recommendations](https://github.com/user-attachments/assets/19080021-1f29-45a4-8601-556b55d379c3)

#### `freescout_add_note`

Add an internal note to a ticket for team communication.

**Parameters:**

- `ticket` (required): Ticket ID, number, or FreeScout URL
- `note` (required): The note content
- `userId` (optional): User ID for the note (defaults to env setting)

**Natural Language Examples:**

- "Add a note to ticket #12345 saying 'Reproduced on staging'"
- "Leave an internal note on this ticket"
- "Add a team note: 'Customer confirmed fix works'"
- "Note on ticket 34811: 'Escalating to development team'"
- "Add internal documentation to this ticket"

#### `freescout_update_ticket`

Update ticket status and/or assignment.

**Parameters:**

- `ticket` (required): Ticket ID, number, or FreeScout URL
- `status` (optional): New status ('active', 'pending', 'closed', 'spam')
- `assignTo` (optional): User ID to assign the ticket to

**Natural Language Examples:**

- "Close ticket #12345"
- "Mark ticket 34811 as pending"
- "Assign this ticket to user ID 2"
- "Set ticket status to active"
- "Update ticket #12345 status to closed and assign to user 1"

#### `freescout_create_draft_reply`

Create a draft reply in FreeScout that can be edited before sending. This tool lets the LLM generate the reply content and saves it directly to FreeScout as a draft. **Automatically converts Markdown formatting to HTML** for proper display in FreeScout.

**Parameters:**

- `ticket` (required): Ticket ID, number, or FreeScout URL
- `replyText` (required): The draft reply content (generated by the LLM, supports Markdown formatting)
- `userId` (optional): User ID creating the draft (defaults to env setting)

**Natural Language Examples:**

- "Create a draft reply for ticket #12345"
- "Draft a customer response for this ticket"
- "Generate and save a draft reply explaining the fix"
- "Write a draft response to the customer for ticket 34811"
- "Create a draft reply thanking the customer and explaining the solution"

**Markdown Support:**

- **Bold text**: `**text**` or `__text__` → **text**
- _Italic text_: `*text*` or `_text_` → _text_
- `Code`: `` `code` `` → `code`
- Numbered lists: `1. item` → proper ordered lists
- Bullet lists: `- item` or `* item` → proper unordered lists
- Line breaks: Double newlines create paragraphs, single newlines create line breaks

**Workflow:**

1. Use `freescout_get_ticket_context` to get customer info and ticket details
2. Let the LLM craft a personalized reply using Markdown formatting
3. Use `freescout_create_draft_reply` to save the draft in FreeScout (Markdown automatically converted to HTML)
4. Review and edit the draft in FreeScout before sending

**Example: Draft reply workflow with personalized customer response**

![Draft reply generation showing personalized customer message with ticket context](https://github.com/user-attachments/assets/a4f9eb6c-3204-4744-8aed-8d16d7c7641c)

![Draft reply automatically saved to FreeScout](https://github.com/user-attachments/assets/689bd675-cb34-414e-b18f-d50d4424ace6)

#### `freescout_get_ticket_context`

Get ticket context and customer information to help craft personalized replies.

**Parameters:**

- `ticket` (required): Ticket ID, number, or FreeScout URL

**Natural Language Examples:**

- "Get context for ticket #12345 to write a reply"
- "I need customer info and ticket details for drafting a response"
- "Gather context for this ticket so I can write a personalized reply"
- "Pull customer information and issue details for ticket 34811"
- "Get ticket context to help craft a customer response"

**Returns:**

- Customer name and email
- Ticket subject and status
- Issue description and analysis
- Recent customer and team messages
- Analysis results (bug vs feature vs third-party issue)

#### `freescout_search_tickets`

Search for tickets across your FreeScout instance.

**Parameters:**

- `query` (required): Search query
- `status` (optional): Filter by status ('active', 'pending', 'closed', 'spam', 'all')
- `mailboxId` (optional): Filter by specific mailbox ID (searches all mailboxes if not specified)

**Natural Language Examples:**

- "Search for tickets containing 'OAuth error'"
- "Find all pending tickets with 'HighLevel' in them"
- "Search for closed tickets about 'plugin conflicts'"
- "Look for tickets from customer 'victor@example.com'"
- "Find all active tickets related to 'authentication'"
- "Search for tickets in mailbox 1 containing 'bug report'"
- "Find tickets in mailbox 2 with status pending"

**Search Parameters (v2.0+):**

- `textSearch` (optional): Plain text search in ticket content/subject
- `assignee` (optional): 'unassigned' | 'any' | user_id (number)
- `status` (optional): 'active' | 'pending' | 'closed' | 'spam' | 'all'
- `state` (optional): 'published' | 'deleted'
- `mailboxId` (optional): Filter by specific mailbox ID
- `updatedSince` (optional): ISO date or relative time like "7d", "24h", "30m"
- `createdSince` (optional): ISO date or relative time
- `page` (optional): Page number for pagination (min: 1)
- `pageSize` (optional): Results per page (min: 1, max: 100)

**Search Tips for AI Agents:**

- For **unassigned tickets**: Use `assignee: "unassigned"` with `status: "active"`
- For **recent tickets**: Use `updatedSince: "7d"` for last 7 days
- For **specific user**: Use `assignee: 123` (user ID number)
- **Status "active"** = open/active tickets (NOT "open" - that's invalid)
- Use **freescout_get_mailboxes** first if filtering by mailbox
- Combine filters: `{ textSearch: "error", assignee: "unassigned", updatedSince: "24h" }`

#### `freescout_get_mailboxes`

Get a list of all available mailboxes in your FreeScout instance.

**Parameters:**
None

**Natural Language Examples:**

- "Show me all available mailboxes"
- "List the mailboxes in FreeScout"
- "What mailboxes are configured?"
- "Get mailbox information"

## Workflow Examples

### Basic Ticket Analysis

```javascript
// Analyze a ticket to understand the issue
await mcp.callTool('freescout_analyze_ticket', {
  ticket: '12345',
});
```

### Complete Ticket Response Workflow

```javascript
// 1. Analyze the ticket to understand the issue
const analysis = await mcp.callTool('freescout_analyze_ticket', {
  ticket: '12345',
});

// 2. Get ticket context for personalized reply
const context = await mcp.callTool('freescout_get_ticket_context', {
  ticket: '12345',
});

// 3. Create a draft reply directly in FreeScout
await mcp.callTool('freescout_create_draft_reply', {
  ticket: '12345',
  replyText: `Hi ${context.customer.name},

Thank you for reaching out! Based on my analysis, I can see that ${analysis.issueDescription}.

Here's what I found:

1. **Issue Type**: ${analysis.isBug ? 'Bug' : 'Configuration/Feature Request'}
2. **Root Cause**: ${analysis.rootCause || 'Under investigation'}

I'll look into this and get back to you shortly with a solution.

Best regards,
[Your name]`,
});

// 4. Update ticket status and assignment
await mcp.callTool('freescout_update_ticket', {
  ticket: '12345',
  status: 'active',
  assignTo: 1,
});

// 5. Add an internal note with findings
await mcp.callTool('freescout_add_note', {
  ticket: '12345',
  note: `Analysis complete:
- Is Bug: ${analysis.isBug}
- Third-party Issue: ${analysis.isThirdPartyIssue}
- Root Cause: ${analysis.rootCause}`,
});
```

### Draft Reply Workflow

```javascript
// 1. Get ticket context for personalized reply
const context = await mcp.callTool('freescout_get_ticket_context', {
  ticket: '34811',
});

// 2. Create draft reply in FreeScout (LLM crafts the content)
await mcp.callTool('freescout_create_draft_reply', {
  ticket: '34811',
  replyText: `Hi ${context.customer.name},

Thank you for reporting the HighLevel OAuth authorization issue! Your experience with the EngageBay LiveChat plugin conflict has been really valuable.

Based on what we learned from your case, I've added a new plugin conflict detection system to WP Fusion. In the next update (v3.46.7), users will see:

🔍 **Plugin Conflict Detection**
- Automatic detection of known conflicting plugins  
- Warning messages before HighLevel authorization
- Clear guidance when conflicts are detected

This should prevent the confusion you experienced and help other users avoid similar issues.

The update should be available within the next few weeks. Thanks for your patience and for helping us improve the plugin!

Best regards,
Jack`,
});

// The draft is now saved in FreeScout and can be reviewed/edited before sending
```

### Handling Non-Bug Issues

```javascript
// For third-party issues or feature requests
const reply = await mcp.callTool('freescout_draft_reply', {
  ticket: '12345',
  fixDescription: 'This is a limitation of the Elementor plugin that we cannot override.',
  isExplanatory: true,
});
```

## Architecture

### Components

1. **FreeScout API Client** (`freescout-api.ts`)
   - Handles all API communication with FreeScout
   - Manages authentication and request formatting
   - Provides ticket parsing utilities

2. **Ticket Analyzer** (`ticket-analyzer.ts`)
   - Intelligent ticket content analysis
   - Issue classification (bug vs feature vs configuration)
   - Code snippet and error extraction
   - Root cause determination

3. **MCP Server** (`index.ts`)
   - Tool registration and request handling
   - Integration with Git for worktree management
   - Response formatting and error handling

### Data Flow

```
User Request → MCP Server → FreeScout API → Ticket Analyzer
                    ↓                             ↓
              Git Operations              Analysis Results
                    ↓                             ↓
              Worktree Management         Customer Reply
                    ↓                             ↓
                Response → User
```

## Development

### Running in Development Mode

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
```

## Configuration

### Required Environment Variables

| Variable            | Description                 | Example                       |
| ------------------- | --------------------------- | ----------------------------- |
| `FREESCOUT_URL`     | Your FreeScout instance URL | `https://support.example.com` |
| `FREESCOUT_API_KEY` | FreeScout API key           | `your-api-key-here`           |

### Optional Environment Variables

| Variable                    | Description                     | Default |
| --------------------------- | ------------------------------- | ------- |
| `FREESCOUT_DEFAULT_USER_ID` | Default user ID for assignments | `1`     |

### Advanced Configuration Example

For more control, you can specify additional environment variables:

```json
{
  "mcpServers": {
    "freescout": {
      "command": "npx @verygoodplugins/mcp-freescout@latest",
      "env": {
        "FREESCOUT_URL": "https://support.example.com",
        "FREESCOUT_API_KEY": "your-api-key",
        "FREESCOUT_DEFAULT_USER_ID": "2"
      }
    }
  }
}
```

### FreeScout API Setup

1. Log into your FreeScout instance as an administrator
2. Navigate to Manage → API Keys
3. Create a new API key with appropriate permissions:
   - View conversations
   - Update conversations
   - Create threads (for notes)

## Best Practices

### Ticket Analysis

- Always analyze tickets before implementing fixes
- Check for third-party limitations before attempting fixes
- Verify reproducibility with team notes

### Customer Communication

- Generate draft replies for review
- Include fix descriptions in customer communications
- Use explanatory replies for non-bug issues

## Migration from v1.x to v2.0

### Breaking Changes

The `freescout_search_tickets` tool has been redesigned with explicit filter parameters. The old query-string syntax is no longer supported.

**Before (v1.x):**

```json
{
  "query": "assignee:null",
  "status": "active"
}
```

**After (v2.0):**

```json
{
  "assignee": "unassigned",
  "status": "active"
}
```

**For text search:**

```json
{
  "textSearch": "authentication error",
  "assignee": "unassigned",
  "updatedSince": "7d"
}
```

### New Features to Adopt

1. **Relative time filters**: Use `"7d"`, `"24h"`, `"30m"` instead of calculating ISO dates
2. **Pagination**: Add `page` and `pageSize` parameters for large result sets
3. **Structured outputs**: All tools now return typed `structuredContent` for better integration

### Automatic Retries

The server now automatically retries failed requests with exponential backoff. No configuration needed - it just works more reliably.

## Troubleshooting

### Common Issues

#### API Connection Errors

- Verify your FreeScout URL includes the protocol (https://)
- Check API key permissions in FreeScout
- Ensure your FreeScout instance has API access enabled
- **New in v2.0**: The server will automatically retry transient connection errors

#### Ticket Parsing Issues

- The server accepts ticket IDs, numbers, and full URLs
- URLs are automatically parsed to extract ticket IDs
- Numeric inputs are treated as ticket IDs

#### Rate Limiting (429 Errors)

- **New in v2.0**: The server automatically detects rate limits and backs off
- Retry logic includes exponential backoff with jitter
- No manual intervention needed

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

GPL-3.0 License - see LICENSE file for details

## Support

For issues, questions, or suggestions:

- [Open an issue on GitHub](https://github.com/verygoodplugins/mcp-freescout/issues)
- [Contact the maintainers](https://verygoodplugins.com/contact?utm_source=github)
- Check the documentation

## Roadmap

- [ ] Batch ticket operations
- [ ] Webhook support for real-time updates
- [ ] Template system for common replies
- [ ] Integration with CI/CD pipelines
- [ ] Advanced search filters
- [ ] Ticket metrics and analytics
- [ ] Multi-language support for customer replies
- [ ] Attachment handling
- [ ] Custom field support
- [ ] Automated testing integration
