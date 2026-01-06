# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1](https://github.com/verygoodplugins/mcp-freescout/compare/v2.0.0...v2.0.1) (2026-01-06)


### Bug Fixes

* Add env loader and improve schema flexibility ([29e8837](https://github.com/verygoodplugins/mcp-freescout/commit/29e8837714433e3b60b878b9e7a7a106a751f44d))
* Add env loader and improve schema flexibility ([31bc42d](https://github.com/verygoodplugins/mcp-freescout/commit/31bc42dbf9fe37003cea5c82e4a054b69b84ff14))
* remove outputSchema from freescout_get_ticket to fix validation errors ([#17](https://github.com/verygoodplugins/mcp-freescout/issues/17)) ([571b987](https://github.com/verygoodplugins/mcp-freescout/commit/571b987899dfb2816ff3eeaffc2ac0d852224433))
* validation errors + feat: includeLastMessage for search ([#18](https://github.com/verygoodplugins/mcp-freescout/issues/18)) ([dd884fa](https://github.com/verygoodplugins/mcp-freescout/commit/dd884fadf9d5ad24f28037e3eeff9613dfbccd4e))

## [2.0.0] - 2026-01-05

### Breaking Changes

- **Search API redesign**: Replaced fragile query-string syntax (`assignee:null`) with explicit filter parameters
  - Old: `query: "assignee:null"`
  - New: `assignee: "unassigned"` as a dedicated parameter
- Migrated from legacy `Server` class to modern `McpServer` with `registerTool()` API
- All tool responses now include structured output schemas for better type safety
- **Removed Git/GitHub tools**: The following tools have been removed to focus on core FreeScout functionality:
  - `git_create_worktree`
  - `git_remove_worktree`
  - `github_create_pr`
  - `freescout_implement_ticket`
  - Use dedicated Git/GitHub MCP servers for these workflows

### Added

- **Markdown-to-HTML conversion**: Draft replies now automatically convert Markdown formatting (bold, italic, code, lists) to proper HTML for FreeScout display
- **Zod schema validation** for all FreeScout API types with runtime validation
- **Explicit search filters**:
  - `assignee`: 'unassigned' | 'any' | number
  - `updatedSince`: ISO date or relative time (e.g., "7d", "24h")
  - `createdSince`: ISO date or relative time
  - `page` and `pageSize`: Proper pagination support
  - `mailboxId`, `status`, `state`: First-class filter parameters
- **Exponential backoff retry logic** with jitter for transient API failures
- **Rate limiting awareness**: Automatic detection and backoff for 429 responses
- **Timeout handling**: Configurable request timeouts (default: 30s)
- **Structured content responses**: All tools now return typed `structuredContent` alongside text
- **Relative time parsing**: Support for "7d", "24h", "30m" in date filters

### Changed

- Updated to MCP SDK best practices (January 2026)
- Improved error messages with specific status codes and retry information
- Enhanced type safety with Zod schemas throughout the codebase
- Better input normalization and validation

### Fixed

- Eliminated client-side filtering workarounds for search state parameter
- Removed fragile string matching for special query syntax
- Improved reliability with automatic retries for network errors
- Windows compatibility: README config examples now use args array format to prevent path separator issues

### Infrastructure

- Added GitHub Actions CI/CD with automated testing and npm publishing
- Added MCP Registry publishing for discoverability
- ESLint 9 flat config with typescript-eslint 8
- Security scanning with CodeQL and Dependabot

### Migration Guide

If you were using `freescout_search_tickets` with query strings like `"assignee:null"`:

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

For text search, use the `textSearch` parameter:

```json
{
  "textSearch": "authentication error",
  "assignee": "unassigned",
  "updatedSince": "7d"
}
```

## [1.4.2] - 2025-11-20

### Added

- MCP Registry support with `mcpName` configuration
- GitHub Actions CI/CD workflows
- Dependabot configuration for dependency updates
- Security scanning with CodeQL

### Changed

- Updated package.json with `engines` and `publishConfig`

## [1.4.1] - 2025-11-15

### Fixed

- Improved error handling in ticket operations

## [1.4.0] - 2025-11-10

### Added

- Git worktree integration for ticket-based development
- GitHub PR creation support

## [1.3.0] - 2025-10-15

### Added

- Ticket context retrieval for personalized replies
- Draft reply creation functionality

## [1.2.0] - 2025-09-20

### Added

- Ticket search functionality
- Note addition to tickets

## [1.1.0] - 2025-08-15

### Added

- Ticket status updates
- Ticket assignment

## [1.0.0] - 2025-07-01

### Added

- Initial release
- FreeScout ticket fetching
- Ticket analysis with AI
- Basic ticket operations
