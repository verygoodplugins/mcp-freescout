# MCP FreeScout Server

An MCP (Model Context Protocol) server for FreeScout helpdesk ticket management and workflow automation. This server provides tools to interact with FreeScout tickets, analyze issues, manage responses, and integrate with Git workflows.

## Features

- 🎫 **Ticket Management**: Fetch, analyze, and update FreeScout tickets
- 🔍 **Intelligent Analysis**: Automatically analyze tickets to determine issue type, root cause, and solutions
- 💬 **Draft Responses**: Generate customer replies based on ticket analysis
- 🌳 **Git Integration**: Create and manage Git worktrees for ticket implementations
- 🔄 **Full Workflow Support**: Complete ticket-to-PR workflow automation
- 📊 **Search Capabilities**: Search and filter tickets across your FreeScout instance

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- FreeScout instance with API access enabled
- Git (for worktree management features)

### Setup

1. Clone this repository:
```bash
git clone https://github.com/verygoodplugins/mcp-freescout.git
cd mcp-freescout
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment template and configure:
```bash
cp .env.example .env
```

4. Edit `.env` with your FreeScout credentials:
```env
FREESCOUT_URL=https://your-freescout-domain.com
FREESCOUT_API_KEY=your-api-key-here
FREESCOUT_DEFAULT_USER_ID=1
WORKING_DIRECTORY=/path/to/your/project
```

5. Build the TypeScript code:
```bash
npm run build
```

## Usage

### With Claude Desktop

Add this configuration to your Claude Desktop settings (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "freescout": {
      "command": "node",
      "args": ["/path/to/mcp-freescout/dist/index.js"],
      "env": {
        "FREESCOUT_URL": "https://your-freescout-domain.com",
        "FREESCOUT_API_KEY": "your-api-key-here",
        "FREESCOUT_DEFAULT_USER_ID": "1"
        // WORKING_DIRECTORY is optional - defaults to current workspace
      }
    }
  }
}
```

### With Cursor IDE

Cursor has built-in MCP support. Add this configuration to your Cursor settings:

1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Search for "MCP" or go to Extensions → Model Context Protocol
3. Click "Edit in settings.json"
4. Add the following configuration:

```json
{
  "mcp.servers": {
    "freescout": {
      "command": "node",
      "args": ["/path/to/mcp-freescout/dist/index.js"],
      "env": {
        "FREESCOUT_URL": "https://your-freescout-domain.com",
        "FREESCOUT_API_KEY": "your-api-key-here",
        "FREESCOUT_DEFAULT_USER_ID": "1"
        // WORKING_DIRECTORY automatically uses current workspace
      }
    }
  }
}
```

**Note**: In Cursor, the server automatically uses the current workspace directory for Git operations, so you don't need to specify `WORKING_DIRECTORY` unless you want to override it.

### With Other MCP Clients

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

**Example:**
```javascript
{
  "ticket": "12345",
  "includeThreads": true
}
```

#### `freescout_analyze_ticket`
Analyze a ticket to determine issue type, root cause, and suggested solutions.

**Parameters:**
- `ticket` (required): Ticket ID, number, or FreeScout URL

**Returns:**
- Customer information
- Issue description and classification
- Code snippets and error messages
- Reproducibility status
- Root cause analysis
- Bug vs feature request vs third-party issue determination

#### `freescout_add_note`
Add an internal note to a ticket for team communication.

**Parameters:**
- `ticket` (required): Ticket ID, number, or FreeScout URL
- `note` (required): The note content
- `userId` (optional): User ID for the note (defaults to env setting)

#### `freescout_update_ticket`
Update ticket status and/or assignment.

**Parameters:**
- `ticket` (required): Ticket ID, number, or FreeScout URL
- `status` (optional): New status ('active', 'pending', 'closed', 'spam')
- `assignTo` (optional): User ID to assign the ticket to

#### `freescout_draft_reply`
Generate a customer reply based on ticket analysis and fix description.

**Parameters:**
- `ticket` (required): Ticket ID, number, or FreeScout URL
- `fixDescription` (optional): Description of the implemented fix
- `isExplanatory` (optional): Whether this is an explanatory reply (no code changes)

#### `freescout_search_tickets`
Search for tickets across your FreeScout instance.

**Parameters:**
- `query` (required): Search query
- `status` (optional): Filter by status ('active', 'pending', 'closed', 'spam', 'all')

### Git Workflow Tools

#### `git_create_worktree`
Create a Git worktree for isolated ticket implementation.

**Parameters:**
- `ticketId` (required): Ticket ID for the worktree
- `branchName` (optional): Custom branch name (default: fix/freescout-{ticketId})
- `baseBranch` (optional): Base branch to create from (default: master)

#### `git_remove_worktree`
Remove a Git worktree after work is complete.

**Parameters:**
- `ticketId` (required): Ticket ID of the worktree to remove

### Workflow Automation

#### `freescout_implement_ticket`
Complete workflow automation: analyze ticket, create worktree, and prepare implementation plan.

**Parameters:**
- `ticket` (required): Ticket ID, number, or FreeScout URL
- `additionalContext` (optional): Additional context or implementation suggestions
- `autoCreateWorktree` (optional): Automatically create Git worktree (default: true)

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

// 2. After implementing the fix, draft a customer reply
const reply = await mcp.callTool('freescout_draft_reply', {
  ticket: '12345',
  fixDescription: 'Fixed the validation error in the checkout process'
});

// 3. Add the draft as an internal note for review
await mcp.callTool('freescout_add_note', {
  ticket: '12345',
  note: `Draft reply for customer:\n\n${reply}`
});

// 4. Update ticket status and assignment
await mcp.callTool('freescout_update_ticket', {
  ticket: '12345',
  status: 'active',
  assignTo: 1
});

// 5. Clean up the worktree after PR is created
await mcp.callTool('git_remove_worktree', {
  ticketId: '12345'
});
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

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `FREESCOUT_URL` | Your FreeScout instance URL | Yes | - |
| `FREESCOUT_API_KEY` | FreeScout API key | Yes | - |
| `FREESCOUT_DEFAULT_USER_ID` | Default user ID for assignments | No | 1 |
| `WORKING_DIRECTORY` | Base directory for Git operations | No | Current working directory¹ |
| `GITHUB_TOKEN` | GitHub token for PR creation | No | - |
| `GITHUB_REPO` | GitHub repository (owner/repo) | No | - |

¹ **Note on WORKING_DIRECTORY**: This defaults to the current working directory (`process.cwd()`). In Cursor and Claude Desktop, this typically means the currently open project/workspace. You only need to set this if you want to work on a different directory than where the MCP client is running.

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

MIT License - see LICENSE file for details

## Support

For issues, questions, or suggestions:
- [Open an issue on GitHub](https://github.com/verygoodplugins/mcp-freescout/issues)
- [Contact the maintainers](https://verygoodplugins.com/contact)
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