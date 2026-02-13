# OneDrive Memory Skill for Claude Code

Persistent memory for Claude Code using your local OneDrive folder. Memories sync automatically via the OneDrive client - no API authentication required.

## How It Works

This skill writes memory files directly to your local OneDrive folder. The OneDrive sync client handles uploading to the cloud automatically. This means:

- **No authentication required** - Uses your existing OneDrive sync
- **Works offline** - Memories are stored locally first, synced when online
- **Cross-device sync** - Access memories from any device with OneDrive
- **Human-readable** - Memories are markdown files you can view/edit directly

## Quick Start

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- OneDrive client installed and syncing (Windows, macOS, or Linux)

### One-Command Installation

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.ps1 | iex
```

**macOS/Linux (Bash):**
```bash
curl -fsSL https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.sh | bash
```

> 💡 **Always up-to-date:** The installer automatically downloads the latest release from GitHub. No version numbers to remember!

That's it! The installer will:
1. ✅ Download the **latest release** automatically
2. ✅ Install the `odsp-memory` command globally
3. ✅ Configure Claude Code for auto-recall
4. ✅ Set up permissions for seamless operation

### Verify Installation

```bash
odsp-memory status
```

### Start Using in Claude Code

Claude will now automatically:
- **Auto-recall** relevant memories when you start sessions
- **Proactively remember** important context about your projects
- **Sync memories** across all devices via OneDrive

You can also use the commands directly:

```bash
# Store a memory
odsp-memory remember project "This codebase uses React 18 with TypeScript"

# List memories
odsp-memory list

# Search memories
odsp-memory recall "React"
```

### Manual Installation (Alternative)

If you prefer to install manually or contribute to development:

```bash
git clone https://github.com/patrick-rodgers/claude-onedrive-memory.git
cd claude-onedrive-memory
npm install
npm run build
npm install -g .
odsp-memory setup
```

## OneDrive Detection

The skill automatically detects your OneDrive folder using:

1. **Environment variables** (set by OneDrive client):
   - `OneDriveCommercial` - Work/School account
   - `OneDriveConsumer` - Personal account
   - `OneDrive` - Generic fallback

2. **Folder scanning** - Looks for `OneDrive - *` or `OneDrive` folders in your home directory

### Multiple OneDrive Accounts

If you have multiple OneDrive accounts (e.g., work and personal), the skill will prompt you to select one on first use:

```bash
# List available OneDrive folders
node dist/index.js config list

# Select which one to use
node dist/index.js config set 2

# Reset to auto-detection
node dist/index.js config reset
```

Your selection is saved to `~/.claude/odsp-memory/config.json`.

## Usage

### Basic Operations

#### Store a Memory

```bash
# Basic
node dist/index.js remember project "This codebase uses React 18 with TypeScript"

# With tags
node dist/index.js remember decision "Using Zustand for state" --tags=architecture,frontend

# With priority and expiration
node dist/index.js remember task "Fix bug #123" --priority=high --ttl=7d
```

#### Recall Memories

```bash
# Recent memories
node dist/index.js recall

# By category
node dist/index.js recall --category=project

# Search
node dist/index.js recall "database schema"

# Combined
node dist/index.js recall authentication --category=decision --limit=5
```

#### Update a Memory

```bash
# Update content
node dist/index.js update abc123 "Updated content"

# Update tags
node dist/index.js update abc123 --tags=new-tag,updated
```

#### List All Memories

```bash
node dist/index.js list
node dist/index.js list decision
node dist/index.js list --project  # Current project only
```

#### Forget a Memory

```bash
# Use full or partial ID
node dist/index.js forget abc12345
```

### Analytics & Reporting

#### Statistics

```bash
# Show comprehensive memory statistics
node dist/index.js stats
```

Output includes:
- Total memories and age distribution
- Breakdown by category, project, priority
- Top tags
- Health status (expired/stale memories)
- Relationship statistics

#### Relationship Graph

```bash
# Visualize all memory relationships
node dist/index.js graph

# Show subgraph from specific memory
node dist/index.js graph abc123

# Control depth
node dist/index.js graph abc123 --depth=2
```

Generates mermaid diagrams showing how memories are connected via links.

#### Export Memories

```bash
# Export all memories as JSON
node dist/index.js export --format=json > backup.json

# Export as markdown
node dist/index.js export --format=markdown > memories.md

# Export specific category
node dist/index.js export --format=json --category=project > project-memories.json
```

### Batch Operations

#### Batch Tagging

```bash
# Tag all memories matching a query
node dist/index.js tag refactor --query="code cleanup"

# Tag all in a category
node dist/index.js tag deprecated --category=task

# Always preview first with dry-run
node dist/index.js tag important --category=decision --dry-run
```

#### Batch Untagging

```bash
# Remove tag from all memories
node dist/index.js untag old-tag

# Remove tag from search results
node dist/index.js untag deprecated --query="updated"

# Preview with dry-run
node dist/index.js untag temp --dry-run
```

#### Bulk Delete

```bash
# Delete all expired memories
node dist/index.js bulk-delete --expired

# Delete stale memories (>90 days old)
node dist/index.js bulk-delete --stale

# Delete by category
node dist/index.js bulk-delete --category=task --expired

# ALWAYS preview first!
node dist/index.js bulk-delete --stale --dry-run
```

### Relationships

```bash
# Link two memories
node dist/index.js link abc123 def456

# See related memories
node dist/index.js related abc123

# Unlink memories
node dist/index.js link abc123 def456 --unlink

# Merge multiple memories
node dist/index.js merge abc123 def456 ghi789 --title="Combined Notes"
```

### Maintenance

```bash
# Clean up expired memories
node dist/index.js cleanup --dry-run
node dist/index.js cleanup

# Check status
node dist/index.js status

# Configure OneDrive folder
node dist/index.js config list
node dist/index.js config set 2
```

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

## Claude Code Integration

**Automatic Setup:** The installation script automatically configures Claude Code to:
- Load memory instructions via the `skill.md` file
- Auto-recall relevant memories when starting new sessions
- Allow memory commands to run without permission prompts

The integration teaches Claude:
- When to proactively remember information (projects, decisions, preferences)
- How to search and recall memories intelligently
- Best practices for memory management across sessions

No manual configuration needed! Just install and start chatting with Claude.

## Troubleshooting

### "Could not find OneDrive folder"

- Make sure OneDrive is installed and signed in
- Check that sync is enabled (look for OneDrive icon in system tray)
- Run `node dist/index.js status` to see detection details
- On Windows, check if `%OneDriveCommercial%` or `%OneDrive%` environment variables are set

### Memories not syncing

- Check OneDrive sync status in system tray
- Ensure you have internet connectivity
- Look for sync errors in OneDrive settings

### Multiple OneDrive accounts

The skill prioritizes work/school accounts over personal accounts. If you need to use a specific account, you can set the `OneDrive` environment variable to your preferred path.

## License

MIT
