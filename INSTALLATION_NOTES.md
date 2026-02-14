# Installation & Release Notes

## Repository Configuration

Repository: `patrick-rodgers/claude-onedrive-memory`
npm package: `odsp-memory-skill`

## Distribution Methods

### 1. Claude Code Plugin (Primary)

Users install as a plugin from npm:

```bash
claude plugin add odsp-memory-skill
```

This installs the published npm package and auto-configures:
- MCP server (`odsp-memory-mcp` binary) via `.mcp.json`
- Slash commands (`/remember`, `/recall`, `/memory-status`) via `commands/`
- SessionStart hook for auto-context recall via `hooks/`
- Skill documentation via `skills/memory/SKILL.md`

### 2. CLI Tool (Legacy)

Users install the CLI globally via npm or install scripts:

```bash
npm install -g odsp-memory-skill
odsp-memory setup
```

Or via the one-line install scripts (download from GitHub releases):

**Windows:**
```powershell
iwr -useb https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.ps1 | iex
```

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.sh | bash
```

## Testing

### Test Plugin Locally

```bash
# Build and test plugin loading
npm run build
claude --plugin-dir .

# In the Claude session, test:
#   /remember project "Test memory"
#   /recall
#   /memory-status
```

### Test MCP Server Directly

```bash
# Send JSON-RPC initialize request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | node dist/mcp-server.js

# Should return JSON with protocolVersion and capabilities.tools
```

### Test CLI

```bash
node dist/index.js help
node dist/index.js status
```

### Test Release (Dry Run)

```bash
npm run release patch -- --dry-run
```

## Release Workflow

1. **Create a release:**
   ```bash
   npm run release patch  # or minor, or major
   ```

   This automatically:
   - Bumps version in package.json
   - Builds TypeScript (both `index.ts` and `mcp-server.ts`)
   - Packages the distribution
   - Commits the version bump
   - Creates and pushes a git tag
   - Creates a GitHub release with attached tgz
   - Publishes to npm (`npm publish`)

2. **Verify npm publish:**
   - Visit: https://www.npmjs.com/package/odsp-memory-skill
   - Check the version is updated
   - Verify `claude plugin add odsp-memory-skill` works

3. **Verify GitHub release:**
   - Visit: https://github.com/patrick-rodgers/claude-onedrive-memory/releases
   - Check the tgz is attached

4. **Test plugin installation:**
   ```bash
   # In a clean environment
   claude plugin add odsp-memory-skill
   # Start a new session and verify auto-context recall works
   ```

## What Users Get

### Plugin Installation

When users run `claude plugin add odsp-memory-skill`:
1. npm package is downloaded
2. MCP server is configured via `.mcp.json` (uses `npx` to run `odsp-memory-mcp`)
3. Slash commands are registered from `commands/`
4. SessionStart hook is activated from `hooks/`
5. Skill documentation is loaded from `skills/memory/SKILL.md`

No manual configuration of `~/.claude/settings.json` or `~/.claude/CLAUDE.md` is needed.

### CLI Installation (Legacy)

When users run the one-line install command:
1. Latest version downloaded automatically from GitHub releases API
2. `odsp-memory` command installed globally
3. Claude Code configured via `odsp-memory setup` (patches `~/.claude/CLAUDE.md` and `~/.claude/settings.json`)
4. Memory commands work without permission prompts
5. Auto-recall enabled for new Claude sessions

## Package Contents

The npm package (`npm pack --dry-run`) includes:

```
dist/                          # Compiled TypeScript
  index.js                     # CLI entry point (odsp-memory binary)
  mcp-server.js                # MCP server entry point (odsp-memory-mcp binary)
  memory.js, search.js, ...    # Core modules
.claude-plugin/plugin.json     # Plugin manifest
.mcp.json                      # MCP server configuration
skills/memory/SKILL.md         # Skill documentation
commands/                      # Slash commands (remember, recall, memory-status)
hooks/                         # SessionStart hook
skill.md                       # Legacy skill file
README.md
```

Excluded from package (via `.npmignore`):
- `src/` (TypeScript source)
- `scripts/` (release tooling)
- `install.sh`, `install.ps1` (legacy install scripts)
- Development docs (`DISTRIBUTION.md`, `INSTALLATION_NOTES.md`, etc.)

## Troubleshooting

### Plugin not loading

- Verify npm package is published: `npm view odsp-memory-skill`
- Check Claude Code supports plugins: `claude --version`
- Try reinstalling: `claude plugin remove odsp-memory-skill && claude plugin add odsp-memory-skill`

### MCP server not starting

- Test manually: `npx -y -p odsp-memory-skill odsp-memory-mcp`
- Check for port conflicts or Node.js version issues (requires 18+)

### "OneDrive not detected"

- Informational only - will prompt user to select folder on first use
- User can configure via `memory_config` tool or `odsp-memory config list`

### Legacy install script issues

- "Failed to fetch release": Ensure at least one GitHub release exists
- "npm install failed": Check Node.js version (`node --version`, requires 18+)
- "Setup encountered issues": Run `odsp-memory setup` manually
