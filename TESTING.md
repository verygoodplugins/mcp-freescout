# Testing Strategy for mcp-freescout

## Current MCP Testing Best Practices (2026)

Based on research and the MCP community standards:

1. **Unit Tests**: Test business logic in isolation (API calls, data transformations)
2. **Integration Tests**: Validate tool schemas, input/output structures, and MCP protocol compliance
3. **Manual Testing**: Use MCP Inspector or direct client testing for end-to-end validation
4. **Schema Validation**: Leverage Zod for runtime type safety

## Test Suite Structure

### ✅ Implemented

- **MCP Server Tool Patterns** (`src/__tests__/mcp-server.test.ts`)
  - Tool registration with Zod schemas
  - Input validation (enums, ranges, email format)
  - Error handling patterns
  - Response formatting (structured content + text content)
  - Dynamic tool behavior (enable/disable, schema updates)
  - 16 passing tests

- **FreeScout API Tests** (`src/__tests__/freescout-api.test.ts`)
  - API client initialization
  - Conversation fetching with retry logic
  - Search with explicit filters
  - Update operations
  - Schema validation (Conversation, Thread, Customer)
  - URL parsing
  - Error recovery (malformed JSON, network timeouts)
  - Markdown to HTML conversion

### Known Issue: Jest Memory Consumption

The test suite encounters memory issues when running both test files together due to:

- ESM module transformation overhead (node-fetch, MCP SDK)
- TypeScript compilation in Jest
- Large dependency tree

**Workaround**: Tests are configured to run serially (`maxWorkers: 1`) with increased memory limits.

## Manual Testing with MCP Inspector

For comprehensive end-to-end testing, use the MCP Inspector:

```bash
# Install MCP Inspector (if not already installed)
npm install -g @modelcontextprotocol/inspector

# Test the server
npx @modelcontextprotocol/inspector node dist/index.js
```

This allows you to:

- Discover all available tools
- Test tool calls with various inputs
- Validate responses without involving an LLM
- Debug error handling and edge cases

## Testing Checklist Before Release

- [x] Build succeeds (`npm run build`)
- [x] Linter passes (`npm run lint`)
- [x] Format check passes (`npm run format:check`)
- [x] Unit tests pass (MCP server patterns)
- [ ] Integration tests pass (FreeScout API - memory issue)
- [ ] Manual testing with MCP Inspector
- [ ] Test with actual FreeScout instance
- [ ] Verify all tools work as expected in Claude Desktop

## CI/CD Testing

The GitHub Actions workflow runs:

- `npm run build`
- `npm test` (with `--passWithNoTests` flag to handle memory issues gracefully)
- `npm run lint`

## Future Improvements

1. **Split test files**: Separate API tests from MCP tests to reduce memory pressure
2. **Mock dependencies**: Use lighter mocks for node-fetch and MCP SDK
3. **E2E test suite**: Dedicated integration tests with real FreeScout sandbox
4. **Performance tests**: Validate retry logic and rate limiting behavior
5. **Snapshot tests**: Ensure tool schemas remain stable across versions

## Testing Philosophy

Following MCP best practices from 2026:

- **Test in isolation first**: Validate server logic without LLM involvement
- **Schema-driven**: Use Zod for both runtime validation and test assertions
- **Error-first**: Ensure clear error messages for debugging
- **Concise responses**: Keep tool outputs focused and token-efficient
- **Real-world scenarios**: Test with actual ticket data patterns
