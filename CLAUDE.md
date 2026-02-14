# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OneDrive Memory Skill for Claude Code — a CLI tool (`odsp-memory`) that provides persistent memory storage using the local OneDrive folder. Memories are markdown files with YAML frontmatter that sync automatically via the OneDrive client. No API authentication required.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript (tsc) to dist/
npm run dev          # Watch mode (tsc --watch)
npm run test         # Runs `node dist/index.js help` (no test framework)
npm run release patch|minor|major  # Full release: bump version, build, package, tag, push, GitHub release
npm run release patch --dry-run    # Test release locally without pushing
```

The CLI entry point is `dist/index.js`, registered as the `odsp-memory` binary via package.json `bin` field.

## Architecture

TypeScript ESM project (NodeNext module resolution, ES2022 target). Source in `src/`, compiles to `dist/`.

### Source Module Responsibilities

- **`index.ts`** — CLI entry point. Parses args, routes to command handlers, contains all command handler functions and the `setup` command that configures `~/.claude/CLAUDE.md` and `~/.claude/settings.json`.
- **`types.ts`** — All shared types: `Memory`, `MemoryMetadata`, `MemoryIndexEntry`, `MemoryIndex`, `Config`, `CommandResult`. `MemoryCategory` is a union of known strings (`project`, `decision`, `preference`, `learning`, `task`) plus `string` for custom categories.
- **`storage.ts`** — OneDrive folder detection (env vars + home dir scanning), file I/O abstraction (`readStorageFile`/`writeStorageFile`/`deleteStorageFile`), index read/write. Config stored at `~/.claude/odsp-memory/config.json`. Memories stored under `<OneDrive>/Apps/ClaudeMemory/`.
- **`memory.ts`** — CRUD operations on memories. Uses `gray-matter` for markdown frontmatter parsing/serialization. Memories stored as `memories/<category>/<date>-<slug>.md` with a centralized `index.json` for fast lookups. Supports linking, unlinking, merging, and TTL/expiration.
- **`search.ts`** — Text-based search scoring, project-scoped filtering, staleness/expiration checks, and display formatting. Priority field boosts/penalizes search scores.
- **`project.ts`** — Git-based project context detection. Normalizes SSH and HTTPS remote URLs to a canonical form for consistent project identification.
- **`triggers.ts`** — File pattern detection (scans cwd for known files like `*.prisma`, `Dockerfile`, `tsconfig.json`) to auto-tag context. Tracks last-known project for change detection. Custom patterns loadable from `~/.claude/odsp-memory/patterns.json`.
- **`analytics.ts`** — Statistics, mermaid relationship graph generation, JSON/markdown export.
- **`batch.ts`** — Batch tag/untag/bulk-delete operations with dry-run support.

### Key Data Flow

1. All memory files live under `<OneDrive>/Apps/ClaudeMemory/memories/<category>/`
2. A centralized `index.json` at the storage root holds `MemoryIndexEntry[]` for fast search without reading every file
3. Both the index and individual `.md` files are updated together on every write operation
4. Project scoping uses normalized git remote URLs as `projectId`; memories without a `projectId` are global

### Dependencies

- `gray-matter` — YAML frontmatter parsing for memory markdown files
- `uuid` — Memory ID generation
- `tsx` (dev) — Running TypeScript release script directly

### Dual-Mode Architecture (CLI + MCP Server)

The project supports two entry points:

- **CLI** (`src/index.ts` → `dist/index.js`) — Original command-line interface, registered as `odsp-memory` binary. Parses args, routes to handlers, outputs to stdout.
- **MCP Server** (`src/mcp-server.ts` → `dist/mcp-server.js`) — Model Context Protocol server for Claude Code plugin integration, registered as `odsp-memory-mcp` binary. Uses `@modelcontextprotocol/sdk` with stdio transport.

Both entry points call the same core module functions (memory, search, storage, etc.) — no logic is duplicated.

### Plugin Structure

The project is also a Claude Code plugin (installed via `claude plugin add`):

- `.claude-plugin/plugin.json` — Plugin manifest
- `.mcp.json` — MCP server configuration (uses `npx` to run the published package)
- `skills/memory/SKILL.md` — Skill documentation with trigger description
- `commands/` — Slash commands: `/remember`, `/recall`, `/memory-status`
- `hooks/hooks.json` + `hooks/session-start.sh` — SessionStart hook for auto-context recall

## Conventions

- All imports use `.js` extensions (ESM requirement with NodeNext resolution)
- No test framework — `npm test` just runs `help` as a smoke test
- Command handlers return `CommandResult` objects with `{success, message, data?}`
- Partial memory ID matching is supported throughout (e.g., first 8 chars)
- MCP server uses `console.error()` only — never `console.log()` (stdio protocol constraint)
