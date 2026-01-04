# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**MCP FreeScout** is an MCP server for FreeScout helpdesk integration. It enables AI assistants to manage support tickets, analyze issues, create responses, and integrate with Git workflows.

## Build & Development

```bash
# Build TypeScript to dist/
npm run build

# Development with hot-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Architecture

```
src/
├── index.ts              # MCP server entry point, tool registration
├── freescout-api.ts      # FreeScout API client
├── ticket-analyzer.ts    # AI-powered ticket analysis
├── git-integration.ts    # Git worktree and GitHub PR support
└── types.ts              # TypeScript interfaces
```

## MCP Tools

The server exposes these tools:

### Ticket Management

- **freescout_get_ticket** - Fetch ticket by ID or URL with threads
- **freescout_analyze_ticket** - Analyze ticket to determine issue type and solution
- **freescout_add_note** - Add internal note to ticket
- **freescout_update_ticket** - Update ticket status and assignment
- **freescout_create_draft_reply** - Create draft reply for review
- **freescout_get_ticket_context** - Get ticket context for personalized replies
- **freescout_search_tickets** - Search tickets by query and filters

### Git Integration

- **git_create_worktree** - Create Git worktree for ticket work
- **git_remove_worktree** - Remove worktree after completion
- **github_create_pr** - Create GitHub PR for ticket branch

### Workflow

- **freescout_implement_ticket** - Full workflow: analyze, worktree, plan

## Environment Variables

```env
# Required: FreeScout instance URL
FREESCOUT_URL=https://your-freescout.example.com

# Required: FreeScout API key
FREESCOUT_API_KEY=your_api_key

# Optional: Default user ID for notes/drafts
FREESCOUT_USER_ID=1

# Optional: Git worktree base path
WORKTREE_BASE_PATH=/path/to/worktrees

# Optional: GitHub token for PR creation
GITHUB_TOKEN=ghp_xxxx
```

## Common Tasks

**Add a new tool:**

1. Define tool schema in `src/index.ts` tools array
2. Add handler in `CallToolRequestSchema` switch
3. Implement API method in `freescout-api.ts`
4. Add types in `types.ts`

**Test a specific tool:**

```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"freescout_get_ticket","arguments":{"ticket":"12345"}},"id":1}' | npm start
```

## API Patterns

The FreeScout API client uses:

- Basic authentication with API key
- JSON request/response format
- Pagination for list endpoints
- Status codes: active, pending, closed, spam

## Important Notes

- Ticket IDs can be provided as number, string, or full URL
- Thread content is HTML, cleaned with DOMPurify before display
- Draft replies require user review before sending
- Worktrees are created in `./worktrees/` by default
