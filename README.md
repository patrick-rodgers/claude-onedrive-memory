# OneDrive Memory Skill for Claude Code

Persistent memory for Claude Code using your local OneDrive folder. Memories sync automatically via the OneDrive client - no API authentication required.

## How It Works

This skill writes memory files directly to your local OneDrive folder. The OneDrive sync client handles uploading to the cloud automatically. This means:

- **No authentication required** - Uses your existing OneDrive sync
- **Works offline** - Memories are stored locally first, synced when online
- **Cross-device sync** - Access memories from any device with OneDrive
- **Human-readable** - Memories are markdown files you can view/edit directly

## Quick Start

### 1. Prerequisites

- Node.js 18+
- OneDrive client installed and syncing (Windows, macOS, or Linux)

### 2. Install

```bash
npm install
npm run build
```

### 3. Verify Setup

```bash
node dist/index.js status
```

This should show your detected OneDrive folder location.

### 4. Start Using

```bash
# Store a memory
node dist/index.js remember project "This codebase uses React 18 with TypeScript"

# List memories
node dist/index.js list

# Search memories
node dist/index.js recall "React"
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

### Store a Memory

```bash
# Basic
node dist/index.js remember project "This codebase uses React 18 with TypeScript"

# With tags
node dist/index.js remember decision "Using Zustand for state" --tags=architecture,frontend
```

### Recall Memories

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

### List All Memories

```bash
node dist/index.js list
node dist/index.js list decision
```

### Forget a Memory

```bash
# Use full or partial ID
node dist/index.js forget abc12345
```

### Check Status

```bash
node dist/index.js status
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

The `skill.md` file contains instructions for Claude on when and how to use memory proactively. Add this skill to your Claude Code configuration to enable automatic memory management.

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
