# AGENTS.md

This file provides guidance to coding agents (Claude Code, Cursor, Codex, etc.) when working with this repository. It is the single source of truth; `CLAUDE.md` imports it via `@AGENTS.md`.

## Project Overview

**MCP FreeScout** is an MCP (Model Context Protocol) server for FreeScout helpdesk integration. It lets AI assistants fetch and analyze support tickets, add notes, update status/assignment, create draft replies, search conversations, and list mailboxes — translating MCP tool calls into FreeScout REST API requests.

**Core purpose:**
- Translate MCP tool calls into FreeScout API requests over stdio
- Provide AI-powered ticket analysis (issue type, root cause, suggested solution)
- Help draft personalized, review-before-send replies

## Build & Development

```bash
# Install dependencies
npm install

# Development with hot-reload (tsx watch on src/index.ts)
npm run dev

# Build TypeScript to dist/
npm run build

# Start the built server (stdio mode)
npm start

# Unit tests (integration tests excluded)
npm test

# Integration tests only (need real FREESCOUT_URL / FREESCOUT_API_KEY)
npm run test:integration

# Full suite (unit + integration)
npm run test:all

# Lint and format
npm run lint
npm run format
```

`npm test` runs Jest with `--testPathIgnorePatterns=integration`, so it covers unit tests only; integration tests are opt-in via `test:integration` and require a reachable FreeScout instance. See `TESTING.md` for details.

## Commit Standards

This repo uses **Conventional Commits** so Release Please can generate releases and npm/MCP-registry publishes reliably.

- PR titles **must** be Conventional Commit format. The repo squash-merges, so the PR title becomes the merge commit and feeds Release Please. This is enforced in CI by `.github/workflows/pr-title.yml` (there is no local Husky/Commitlint hook).
- Allowed prefixes: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`, `ci`, `revert`.
- Use `!` (e.g. `feat!:` or `feat(scope)!:`) for breaking changes → major bump. `feat:` → minor, `fix:` → patch, `chore`/`docs` → no bump.
- Subjects are imperative mood (e.g. `fix: harden FreeScout auth flow`, `feat(search): add relative time filters`).
- Releases: `release-please.yml` (release-type `node`) opens/updates a Release PR; merging it bumps `package.json`, updates `CHANGELOG.md`, tags a GitHub Release, and publishes to npm and the MCP registry via OIDC trusted publishing (no tokens).

Accepted examples:
```text
fix: prevent double-unescaping in stripHtml
feat: add freescout_get_mailboxes tool
docs: clarify draft recipient inheritance
chore: bump @modelcontextprotocol/sdk
```

## Commit & PR Guidelines

- **Branches**: short, descriptive names (e.g., `feat/ticket-tags`, `fix/rate-limits`).
- **PRs**: include a concise summary, motivation, testing notes (`npm test`, `npm run lint`), and link related issues. Add logs when changing error handling or CLI behavior.
- **CI readiness**: ensure `npm run lint`, `npm run build`, and `npm test` pass locally before pushing (CI runs all three on PRs to `main`).

## Coding Style & Naming

- **Language**: TypeScript with ES modules (`"type": "module"`); Node >= 18.
- **Formatting**: Prettier via `npm run format` — semicolons, single quotes, 2-space indentation, `printWidth` 80, `arrowParens: avoid` (see `.prettierrc`).
- **Linting**: ESLint with `typescript-eslint` (flat config in `eslint.config.mjs`); fix warnings before opening a PR.
- **Naming**: `camelCase` for variables/functions, `PascalCase` for classes/types, descriptive kebab-case file names (e.g., `freescout-api.ts`, `draft-recipients.ts`).

## Architecture

```
┌──────────────────────────────────────────┐
│  MCP Client (Claude Code / Cursor / etc.) │
│  - Calls MCP tools over stdio             │
└─────────────┬────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────┐
│  MCP FreeScout Server (this TypeScript app)│
│  - Translates MCP tool calls → HTTP API   │
└─────────────┬────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────┐
│  FreeScout instance (REST API)            │
│  - /conversations, /mailboxes, etc.       │
│  - Auth via X-FreeScout-API-Key header    │
└──────────────────────────────────────────┘
```

### Code Organization

```
src/
├── index.ts             # MCP server entry point (McpServer); registers tools via registerTool
├── freescout-api.ts     # FreeScout REST client (X-FreeScout-API-Key auth, retry, pagination)
├── ticket-analyzer.ts   # Heuristic ticket analysis + regex-based stripHtml
├── types.ts             # Zod schemas + inferred TypeScript types
├── draft-recipients.ts  # Draft reply To/Cc/Bcc inheritance resolution
├── env.ts               # dotenv loader (loadEnv)
└── __tests__/           # Jest unit + integration tests
```

Build output lands in `dist/` (do not edit directly); `dist/index.js` is the CLI entry exposed as the `mcp-freescout` bin.

## MCP Tools

The server registers **8 tools**, all prefixed `freescout_`. (There are no Git/GitHub or "implement ticket" tools — the server only talks to the FreeScout API.)

1. **freescout_get_ticket** — Fetch a ticket by ID, number, or URL, optionally with all conversation threads (`includeThreads`, default true).
2. **freescout_analyze_ticket** — Analyze a ticket to determine issue type, root cause, and suggested solution (returns structured `TicketAnalysis`).
3. **freescout_add_note** — Add an internal note to a ticket (`userId` defaults to env).
4. **freescout_update_ticket** — Update ticket `status` (`active`/`pending`/`closed`/`spam`) and/or `assignTo` (user ID).
5. **freescout_create_draft_reply** — Create a review-before-send draft reply. Optional `to`/`cc`/`bcc`: omit to inherit existing recipients, pass `[]` to clear.
6. **freescout_get_ticket_context** — Get condensed ticket + customer context to help draft personalized replies.
7. **freescout_search_tickets** — Search with explicit filters (`textSearch`, `assignee` `"unassigned"`/`"any"`/number, `updatedSince`/`createdSince` ISO or relative like `7d`/`24h`, `mailboxId`, `status`, `state`, `page`/`pageSize`, `includeLastMessage`).
8. **freescout_get_mailboxes** — List available mailboxes.

## Environment Variables

```env
# Required: FreeScout instance URL (e.g., https://support.example.com)
FREESCOUT_URL=https://your-freescout.example.com

# Required: FreeScout API key with read/write permissions
FREESCOUT_API_KEY=your_api_key

# Optional: default user ID used for notes, drafts, and update "byUser" (default: 1)
FREESCOUT_DEFAULT_USER_ID=1
```

`FREESCOUT_URL` and `FREESCOUT_API_KEY` are required — the server exits at startup if either is missing. Variables are loaded from the environment or a local `.env` file via `dotenv`.

## Common Tasks

**Add a new tool:**

1. Call `server.registerTool(name, { title, description, inputSchema }, handler)` in `src/index.ts`. `inputSchema` is a Zod shape; add `outputSchema` only if the response is reliably structured (some tools omit it because raw API responses have optional/undefined fields).
2. Implement the underlying API call as a method on `FreeScoutAPI` in `freescout-api.ts`.
3. Add or extend Zod schemas / types in `types.ts`.
4. Add tests under `src/__tests__/`.

**Test a specific tool over stdio:**

```bash
npm run build
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"freescout_get_ticket","arguments":{"ticket":"12345"}},"id":1}' | npm start
```

## API Patterns

The FreeScout API client (`freescout-api.ts`):

- Authenticates with the `X-FreeScout-API-Key` header (not Basic auth).
- Uses JSON request/response with retry handling.
- Paginates list endpoints (`page`/`page_size`, `_embedded` + `page` envelopes).
- Recognizes ticket status values `active`, `pending`, `closed`, `spam` (search also accepts `all`).

## Important Notes

- Ticket inputs can be a numeric ID, ticket number, or full FreeScout URL — `parseTicketInput` normalizes them.
- Thread bodies are HTML; they are stripped to plain text by a regex-based `stripHtml` in `ticket-analyzer.ts` (no DOMPurify dependency).
- Draft replies are saved for review/edit/send from the FreeScout UI; they are not sent automatically.
- Draft recipients are inherited from the existing conversation unless explicitly provided (`draft-recipients.ts`).

## Memory MCP Usage

- **Start of work**: recall project-specific context for the area you are modifying (recent bugs, decisions, related files).
- **During/after work**: when you fix an issue or learn something important (API behavior, edge case, configuration nuance), store or update a memory.
- **Associations**: link new memories to existing ones (e.g., a bugfix to a module or decision) to keep context navigable for future tasks.
