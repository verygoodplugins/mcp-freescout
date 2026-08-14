# Testing Strategy for mcp-freescout

## Test suites

Based on research and the MCP community standards:

1. **Unit tests** (`npm test`): API behavior, schemas, server factory, lifecycle, and protocol compatibility with mocked FreeScout responses.
2. **Coverage** (`npm run test:coverage`): runs the unit suite with enforced thresholds over all production source files.
3. **Integration tests** (`npm run test:integration`): separately run against a configured FreeScout instance; they are skipped when credentials are absent.

## Test Suite Structure

### Implemented

- **MCP server factory and lifecycle** (`src/__tests__/mcp-server.test.ts`, `src/__tests__/stdio-lifecycle.test.ts`)
  - Eight registered tools with Zod 4 input schemas
  - 2025 legacy and 2026 stdio factory coverage
  - Parent-process watchdog and SIGINT/SIGTERM shutdown behavior

- **FreeScout API Tests** (`src/__tests__/freescout-api.test.ts`)
  - API client initialization
  - Conversation fetching with retry logic
  - Search with explicit filters
  - Update operations
  - Schema validation (Conversation, Thread, Customer)
  - URL parsing
  - Error recovery (malformed JSON, network timeouts)
  - Markdown to HTML conversion

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
- [x] Unit tests pass (`npm test`)
- [x] Unit coverage passes (`npm run test:coverage`)
- [ ] Integration tests pass against a configured FreeScout instance
- [ ] Manual testing with MCP Inspector
- [ ] Test with actual FreeScout instance
- [ ] Verify all tools work as expected in Claude Desktop

## CI/CD Testing

The GitHub Actions workflow runs:

- `npm run build`
- `npm test`
- `npm run test:coverage`
- `npm run lint`

## Future Improvements

1. **E2E test suite**: Dedicated integration tests with a FreeScout sandbox
2. **Performance tests**: Validate retry logic and rate limiting behavior
3. **Snapshot tests**: Ensure input schemas remain stable across versions

## Testing Philosophy

Following MCP best practices from 2026:

- **Test in isolation first**: Validate server logic without LLM involvement
- **Schema-driven**: Use Zod for both runtime validation and test assertions
- **Error-first**: Ensure clear error messages for debugging
- **Concise responses**: Keep tool outputs focused and token-efficient
- **Real-world scenarios**: Test with actual ticket data patterns
