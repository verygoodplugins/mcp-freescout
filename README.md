# FreeScout MCP Server

An MCP (Model Context Protocol) server for FreeScout helpdesk ticket management and workflow automation. This server provides tools to interact with FreeScout tickets, analyze issues, manage responses, and integrate with Git workflows.

## Features

- 🎫 **Ticket Management**: Fetch, analyze, and update FreeScout tickets
- 🔍 **Intelligent Analysis**: Automatically analyze tickets to determine issue type, root cause, and solutions
- 💬 **Draft Responses**: Generate customer replies based on ticket analysis
- 🌳 **Git Integration**: Create and manage Git worktrees for ticket implementations
- 🔄 **Full Workflow Support**: Complete ticket-to-PR workflow automation
- 📊 **Search Capabilities**: Search and filter tickets across your FreeScout instance with mailbox filtering support

## Installation

### Prerequisites

- Node.js 18 or higher
- FreeScout instance with API access enabled
- Git (for worktree management features)
- GitHub CLI (`gh`) for GitHub integration (install from https://cli.github.com/)

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
          "FREESCOUT_API_KEY": "your-api-key-here",
          "WORKING_DIRECTORY": "${workspaceFolder}"
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
        "FREESCOUT_API_KEY": "your-api-key-here",
        "WORKING_DIRECTORY": "/path/to/your/project"
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
- *Italic text*: `*text*` or `_text_` → *text*
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

**Search Tips for AI Agents:**
- For **unassigned tickets**: Use query `"assignee:null"` with status `"active"`
- For **assigned tickets to a user**: Search by content and filter by assignee in results
- **Status "active"** = open/active tickets (NOT "open" - that's invalid)
- **Empty queries** may return inconsistent results - always use specific search terms
- Use **freescout_get_mailboxes** first if filtering by mailbox

#### `freescout_get_mailboxes`
Get a list of all available mailboxes in your FreeScout instance.

**Parameters:**
None

**Natural Language Examples:**
- "Show me all available mailboxes"
- "List the mailboxes in FreeScout"
- "What mailboxes are configured?"
- "Get mailbox information"

### Git Workflow Tools

#### `git_create_worktree`
Create a Git worktree for isolated ticket implementation.

**Parameters:**
- `ticketId` (required): Ticket ID for the worktree
- `branchName` (optional): Custom branch name (default: fix/freescout-{ticketId})
- `baseBranch` (optional): Base branch to create from (default: master)

**Natural Language Examples:**
- "Create a worktree for ticket #12345"
- "Set up a Git worktree to work on this ticket"
- "Create a new branch and worktree for ticket 34811"
- "Make a worktree for fixing this issue"
- "Set up isolated workspace for this ticket"

#### `git_remove_worktree`
Remove a Git worktree after work is complete.

**Parameters:**
- `ticketId` (required): Ticket ID of the worktree to remove

**Natural Language Examples:**
- "Remove the worktree for ticket #12345"
- "Clean up the worktree for this ticket"
- "Delete worktree for ticket 34811"
- "Remove the Git worktree after finishing the implementation"
- "Clean up workspace for this ticket"

#### `github_create_pr`
Create a GitHub pull request for the current branch. Automatically detects the repository from git remote.

**Parameters:**
- `title` (required): PR title
- `body` (required): PR description/body
- `ticketId` (optional): FreeScout ticket ID for reference (adds link to PR body)
- `branch` (optional): Branch name (defaults to current branch)
- `baseBranch` (optional): Base branch (default: master)
- `draft` (optional): Create as draft PR (default: false)

**Natural Language Examples:**
- "Create a PR for this fix"
- "Make a pull request with title 'Fix OAuth validation error'"
- "Create a GitHub PR for ticket #12345"
- "Submit a pull request for this feature"
- "Create a draft PR for the current branch"

**Features:**
- Auto-detects GitHub repository using GitHub CLI (no configuration needed!)
- Adds FreeScout ticket link to PR body when ticketId is provided
- Supports draft PRs for work in progress
- Uses GitHub CLI (`gh`) for authentication - no tokens required!
- Requires: `gh` installed and authenticated (`gh auth login`)

### Workflow Automation

#### `freescout_implement_ticket`
workflow automation: analyze ticket, create worktree, and prepare implementation plan.

**Parameters:**
- `ticket` (required): Ticket ID, number, or FreeScout URL
- `additionalContext` (optional): Additional context or implementation suggestions
- `autoCreateWorktree` (optional): Automatically create Git worktree (default: true)

**Natural Language Examples:**
- "Start the full implementation workflow for ticket #12345"
- "Please implement a solution to this ticket"
- "Analyze and prepare implementation for this ticket"
- "Run the complete implementation workflow"
- "Prepare this ticket for development with analysis and worktree setup"

**Returns:**
- Complete ticket analysis
- Customer information
- Issue classification (bug/feature/third-party)
- Implementation plan
- Git worktree details
- Next steps guidance

## Workflow Examples

### Basic Ticket Analysis
```javascript
// Analyze a ticket to understand the issue
await mcp.callTool('freescout_analyze_ticket', {
  ticket: '12345'
});
```

### Complete Implementation Workflow
```javascript
// 1. Start the implementation workflow
const plan = await mcp.callTool('freescout_implement_ticket', {
  ticket: 'https://support.example.com/conversation/12345',
  additionalContext: 'Consider backward compatibility'
});

// 2. After implementing the fix, create a GitHub PR
await mcp.callTool('github_create_pr', {
  title: 'Fix: Validation error in checkout (FreeScout #12345)',
  body: `## Summary
Fixes the validation error reported in the checkout process.

## Changes
- Fixed validation logic in checkout.js
- Added error handling for edge cases

## Testing
- Tested with various input combinations
- All existing tests pass`,
  ticketId: '12345'  // Automatically adds FreeScout link to PR
});

// 3. Get ticket context to craft a personalized reply
const context = await mcp.callTool('freescout_get_ticket_context', {
  ticket: '12345'
});

// 4. Create a draft reply directly in FreeScout (LLM generates the content with Markdown)
await mcp.callTool('freescout_create_draft_reply', {
  ticket: '12345',
  replyText: `Hi ${context.customer.name},

Thank you for working through that validation issue with us! Your detailed report was really helpful.

I've just implemented a fix that addresses the checkout validation error you experienced. The fix includes:

1. **Improved validation logic** in the checkout process
2. **Better error handling** for edge cases  
3. **Additional safeguards** to prevent similar issues

The fix has been submitted for review and will be included in the next plugin update. You'll receive the update through WordPress's automatic update system.

Thanks again for your patience and for helping us improve the plugin!

Best regards,
[Your name]`
});

// 5. Update ticket status and assignment  
await mcp.callTool('freescout_update_ticket', {
  ticket: '12345',
  status: 'active',
  assignTo: 1
});

// 6. Clean up the worktree after PR is created
await mcp.callTool('git_remove_worktree', {
  ticketId: '12345'
});
```
![Complete implementation workflow](https://github.com/user-attachments/assets/dd003100-acfe-420b-b9a8-4253d07545d4)


### Draft Reply Workflow
```javascript
// 1. Get ticket context for personalized reply
const context = await mcp.callTool('freescout_get_ticket_context', {
  ticket: '34811'
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
Jack`
});

// The draft is now saved in FreeScout and can be reviewed/edited before sending
```

### Handling Non-Bug Issues
```javascript
// For third-party issues or feature requests
const reply = await mcp.callTool('freescout_draft_reply', {
  ticket: '12345',
  fixDescription: 'This is a limitation of the Elementor plugin that we cannot override.',
  isExplanatory: true
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

| Variable | Description | Example |
|----------|-------------|---------|
| `FREESCOUT_URL` | Your FreeScout instance URL | `https://support.example.com` |
| `FREESCOUT_API_KEY` | FreeScout API key | `your-api-key-here` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FREESCOUT_DEFAULT_USER_ID` | Default user ID for assignments | `1` |
| `WORKING_DIRECTORY` | Base directory for Git operations | Current working directory¹ |
| `GITHUB_REPO` | GitHub repository (owner/repo) | Auto-detected using `gh`² |

¹ **Note**: Automatically uses the current project/workspace directory. Only set this if you need to work on a different directory.

² **Note**: The server automatically detects the GitHub repository using GitHub CLI (`gh`). Requires `gh` to be installed and authenticated (`gh auth login`). Only set `GITHUB_REPO` if you need to override the auto-detection.

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
        "FREESCOUT_DEFAULT_USER_ID": "2",
        "WORKING_DIRECTORY": "/path/to/specific/project",
        "GITHUB_REPO": "owner/repo"
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

### Git Workflow
- Use worktrees for parallel development
- Clean up worktrees after PR creation
- Keep branch names descriptive

### Customer Communication
- Generate draft replies for review
- Include fix descriptions in customer communications
- Use explanatory replies for non-bug issues

## Troubleshooting

### Common Issues

#### API Connection Errors
- Verify your FreeScout URL includes the protocol (https://)
- Check API key permissions in FreeScout
- Ensure your FreeScout instance has API access enabled

#### Git Worktree Errors
- Ensure Git is installed and accessible
- Verify the working directory is a Git repository (defaults to current directory)
- Check that the base branch exists
- If needed, explicitly set WORKING_DIRECTORY to your Git repository path

#### Ticket Parsing Issues
- The server accepts ticket IDs, numbers, and full URLs
- URLs are automatically parsed to extract ticket IDs
- Numeric inputs are treated as ticket IDs

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
