# OneDrive Memory Plugin for Claude Code

[![npm version](https://img.shields.io/npm/v/odsp-memory-skill)](https://www.npmjs.com/package/odsp-memory-skill)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/patrick-rodgers/claude-onedrive-memory)](https://github.com/patrick-rodgers/claude-onedrive-memory/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Persistent memory for Claude Code using your local OneDrive folder. Memories sync automatically via the OneDrive client - no API authentication required.

## How It Works

This plugin stores memory files directly in your local OneDrive folder. The OneDrive sync client handles uploading to the cloud automatically. This means:

- **No authentication required** - Uses your existing OneDrive sync
- **Works offline** - Memories are stored locally first, synced when online
- **Cross-device sync** - Access memories from any device with OneDrive
- **Human-readable** - Memories are markdown files you can view/edit directly

## Installation

### As a Claude Code Plugin (Recommended)

Install directly as a Claude Code plugin — no manual setup required:

```bash
claude plugin add odsp-memory-skill
```

This automatically:
- Installs the MCP server providing 18 memory tools
- Adds `/remember`, `/recall`, and `/memory-status` slash commands
- Sets up auto-context recall on session start via a SessionStart hook
- Provides the memory skill documentation to Claude

Once installed, Claude will proactively remember and recall context across sessions.

**Prerequisites:** OneDrive client installed and syncing (Windows, macOS, or Linux).

### Verify Installation

After installing the plugin, start a new Claude Code session. Claude will automatically attempt to recall relevant memories via the `memory_context` tool. You can also test directly:

- `/remember project "This codebase uses React 18 with TypeScript"` - Store a memory
- `/recall React` - Search memories
- `/memory-status` - Check OneDrive detection and stats

### As a CLI Tool (Legacy)

The CLI tool is still available for direct terminal usage or environments where plugins are not supported.

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.ps1 | iex
```

**macOS/Linux (Bash):**
```bash
curl -fsSL https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.sh | bash
```

Or install from npm:
```bash
npm install -g odsp-memory-skill
odsp-memory setup
```

## Plugin Features

### Slash Commands

| Command | Description |
|---------|-------------|
| `/remember <category> <content>` | Store a memory (category: project, decision, preference, learning, task) |
| `/recall [query]` | Search memories, or recall context if no query |
| `/memory-status` | Show OneDrive status and memory statistics |

### MCP Tools

The plugin provides 18 MCP tools that Claude can use autonomously:

| Tool | Description |
|------|-------------|
| `memory_remember` | Store a new memory (auto-scoped to current project) |
| `memory_recall` | Search and retrieve memories |
| `memory_context` | Smart recall based on project context and file patterns |
| `memory_list` | List all memories, optionally filtered |
| `memory_forget` | Delete a memory by ID |
| `memory_update` | Update content or tags |
| `memory_link` | Create/remove bidirectional links between memories |
| `memory_related` | Show related memories |
| `memory_merge` | Consolidate multiple memories into one |
| `memory_cleanup` | Remove expired memories |
| `memory_stats` | Memory statistics and analytics |
| `memory_graph` | Visualize relationships as mermaid diagrams |
| `memory_export` | Export to JSON or markdown |
| `memory_tag` | Batch add tags |
| `memory_untag` | Batch remove tags |
| `memory_bulk_delete` | Bulk delete with filters |
| `memory_status` | OneDrive detection and project context |
| `memory_config` | Manage OneDrive folder selection |

### SessionStart Hook

On every new session, the plugin prompts Claude to use `memory_context` to recall up to 5 relevant memories for the current project. This gives Claude automatic awareness of project structure, past decisions, user preferences, and ongoing tasks.

## OneDrive Detection

The plugin automatically detects your OneDrive folder using:

1. **Environment variables** (set by OneDrive client):
   - `OneDriveCommercial` - Work/School account
   - `OneDriveConsumer` - Personal account
   - `OneDrive` - Generic fallback

2. **Folder scanning** - Looks for `OneDrive - *` or `OneDrive` folders in your home directory

### Multiple OneDrive Accounts

If you have multiple OneDrive accounts, Claude will use the `memory_config` tool to let you select one. Or via the CLI:

```bash
odsp-memory config list      # List available folders
odsp-memory config set 2     # Select folder #2
odsp-memory config reset     # Reset to auto-detection
```

Your selection is saved to `~/.claude/odsp-memory/config.json`.

## Categories

| Category | Use For |
|----------|---------|
| `project` | Codebase structure, architecture, key files |
| `decision` | Choices made and their rationale |
| `preference` | Coding style, naming conventions |
| `learning` | Gotchas, discoveries, important notes |
| `task` | Ongoing work, blockers, next steps |

You can also use any custom category name.

## Storage Structure

Memories are stored in your OneDrive folder:

```
OneDrive/
  Apps/
    ClaudeMemory/
      index.json                   # Quick lookup index
      memories/
        project/
          2024-02-05-codebase-structure.md
        decision/
          2024-02-05-database-choice.md
```

Each memory is a markdown file with YAML frontmatter:

```markdown
---
id: abc123
category: project
tags: [react, typescript]
created: 2024-02-05T10:30:00Z
updated: 2024-02-05T10:30:00Z
---

This codebase uses React 18 with TypeScript...
```

## CLI Usage (Legacy)

If using the CLI tool directly, all commands are available via `odsp-memory`:

```bash
odsp-memory remember project "The API uses Express with TypeScript"
odsp-memory recall "database"
odsp-memory list decision
odsp-memory forget abc123
odsp-memory stats
odsp-memory context --verbose
odsp-memory export --format=markdown
odsp-memory help    # Full command reference
```

## Development

```bash
git clone https://github.com/patrick-rodgers/claude-onedrive-memory.git
cd claude-onedrive-memory
npm install
npm run build        # Compile TypeScript
npm run dev          # Watch mode

# Test the plugin locally
claude --plugin-dir .
```

## Troubleshooting

### "Could not find OneDrive folder"

- Make sure OneDrive is installed and signed in
- Check that sync is enabled (look for OneDrive icon in system tray)
- Use `/memory-status` or `odsp-memory status` to see detection details
- On Windows, check if `%OneDriveCommercial%` or `%OneDrive%` environment variables are set

### Memories not syncing

- Check OneDrive sync status in system tray
- Ensure you have internet connectivity
- Look for sync errors in OneDrive settings

### Multiple OneDrive accounts

The plugin prioritizes work/school accounts over personal accounts. If you need to use a specific account, you can set the `OneDrive` environment variable to your preferred path, or use the `memory_config` tool to select a folder.

## License

MIT

## Warranty Disclaimer

This software is provided "AS IS", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.
