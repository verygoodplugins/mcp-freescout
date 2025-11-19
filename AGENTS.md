# Repository Guidelines

## Project Structure & Modules
- **Source**: TypeScript sources live in `src/` (`index.ts`, `freescout-api.ts`, `ticket-analyzer.ts`, `types.ts`).
- **Build output**: Compiled JavaScript and type declarations are in `dist/` (do not edit directly).
- **Entry point**: The MCP server CLI entry is `src/index.ts`, built to `dist/index.js` and exposed as `mcp-freescout`.

## Build, Test & Development
- **Install**: `npm install` – install dependencies.
- **Dev server**: `npm run dev` – run `src/index.ts` with live reload.
- **Build**: `npm run build` – compile TypeScript to `dist/`.
- **Test**: `npm test` – run Jest test suite.
- **Lint**: `npm run lint` – run ESLint over `src/**/*.ts`.
- **Format**: `npm run format` – apply Prettier formatting to `src/**/*.ts`.

## Coding Style & Naming
- **Language**: TypeScript with ES modules (`type: module`).
- **Formatting**: Use Prettier via `npm run format`; 2‑space indentation and single quotes where possible.
- **Linting**: ESLint with `@typescript-eslint` rules; fix warnings before opening a PR.
- **Naming**: Use `camelCase` for variables/functions, `PascalCase` for classes/types, and descriptive file names (e.g., `freescout-api.ts`).

## Testing Guidelines
- **Framework**: Jest (`npm test`).
- **Location**: Place tests alongside code as `*.test.ts` or in a dedicated test folder if introduced consistently.
- **Scope**: Cover new behavior, especially FreeScout API calls and ticket analysis logic.
- **CI readiness**: Ensure `npm test` and `npm run lint` pass locally before pushing.

## Commit & Pull Requests
- **Commits**: Write clear, imperative messages (e.g., `Add ticket analyzer tests`, `Fix FreeScout auth error`).
- **Branches**: Use short, descriptive names (e.g., `feat/ticket-tags`, `fix/rate-limits`).
- **PRs**: Include a concise summary, motivation, testing notes (`npm test`, `npm run lint`), and link related issues. Add screenshots or logs when changing error handling or CLI behavior.

## Memory MCP Usage
- **Start of work**: Use the memory MCP to recall project-specific context for the area you are modifying (recent bugs, decisions, or related files).
- **During/after work**: When you fix an issue or learn something important (API behavior, edge case, configuration nuance), store or update a memory via the MCP.
- **Associations**: When relevant, associate new memories with existing ones (e.g., linking a bugfix to a specific module or decision) to keep context navigable for future tasks.
