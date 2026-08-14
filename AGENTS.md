# AGENTS.md

## Repository purpose

`mcp-freescout` is an MCP (Model Context Protocol) server for FreeScout ticket management and workflow automation.

## Common commands

```bash
npm run dev            # Start the TypeScript server with hot reload
npm run build          # Compile to dist/
npm start              # Run the compiled stdio server
npm test               # Run unit tests
npm run test:coverage  # Run tests with coverage
npm run lint           # Run ESLint
npm run format         # Format source files with Prettier
```

## Project conventions

- Target Node.js 24 or newer and strict TypeScript.
- Register tools with `McpServer.registerTool` and Zod 4 input schemas.
- Keep `buildServer()` side-effect free for tests; the `serveStdio(() => buildServer())`
  entry supports both 2025 legacy and 2026 MCP stdio clients.
- Do not declare tool output schemas; return `structuredContent` only for stable
  object results.
- Keep protocol traffic on stdout only. Send diagnostics to stderr; do not use
  `console.log`, `console.info`, or `console.debug` in server code.
- Validate required configuration at startup, but never log credential values.
- Keep API access behind a focused client module and test it with mocked
  responses.
- Before opening a change, run `npm run lint`, `npm run build`, and `npm test`.

## Layout

```text
src/index.ts       MCP server factory and stdio entry point
tests/             Unit and integration tests
dist/              Compiled package output (generated)
server.json        MCP Registry metadata
```

## Releases

Use Conventional Commits. `feat:` creates a minor release, `fix:` a patch
release, and breaking changes use `!` or a `BREAKING CHANGE:` footer.
Release Please derives releases from squash-merge PR titles, so PR titles must
also follow that format.
