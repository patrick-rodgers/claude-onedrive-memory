#!/bin/bash
# Package OneDrive Memory Skill for Teams distribution
# Run from project root: ./scripts/package-for-teams.sh

set -e

echo -e "\033[36mBuilding and packaging odsp-memory-skill...\033[0m"

# Clean and build
echo "  - Cleaning dist folder..."
rm -rf dist

echo "  - Installing dependencies..."
npm install --silent

echo "  - Building TypeScript..."
npm run build

# Create distribution folder
DIST_FOLDER="teams-distribution"
echo "  - Creating distribution folder..."
rm -rf "$DIST_FOLDER"
mkdir -p "$DIST_FOLDER"

# Create package directly in distribution folder
echo "  - Creating npm package..."
npm pack --pack-destination "$DIST_FOLDER" > /dev/null 2>&1

# Create install instructions
cat > "$DIST_FOLDER/INSTALL.md" << 'EOF'
# OneDrive Memory Skill - Quick Install

## Prerequisites
- Node.js 18 or higher
- OneDrive client installed and syncing

## Installation

1. Open PowerShell or Command Prompt
2. Run:
   ```
   npm install -g ./odsp-memory-skill-1.0.0.tgz
   ```

## Setup

1. Verify OneDrive detection:
   ```
   odsp-memory status
   ```

2. If you have multiple OneDrive accounts, select the right one:
   ```
   odsp-memory config list
   odsp-memory config set <number>
   ```

3. Test it works:
   ```
   odsp-memory remember project "Test memory"
   odsp-memory list
   ```

## Add to Claude Code

Add this to your Claude Code settings or CLAUDE.md file:

```
## Memory Skill

I have access to persistent memory via OneDrive. Use these commands:

- `odsp-memory remember <category> <content>` - Store a memory
- `odsp-memory recall [query]` - Search memories
- `odsp-memory list [category]` - List all memories
- `odsp-memory forget <id>` - Delete a memory

Categories: project, decision, preference, learning, task

Proactively remember important context about projects, decisions, and user preferences.
At the start of sessions, recall relevant context with: `odsp-memory recall --category=project`
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `odsp-memory remember <category> <content>` | Store a memory |
| `odsp-memory recall [query]` | Search/retrieve memories |
| `odsp-memory list [category]` | List all memories |
| `odsp-memory forget <id>` | Delete a memory |
| `odsp-memory status` | Show OneDrive location |
| `odsp-memory config list` | List OneDrive folders |
| `odsp-memory config set <n>` | Select OneDrive folder |
| `odsp-memory help` | Show all commands |

## Troubleshooting

**"OneDrive folder not found"**
- Make sure OneDrive is installed and signed in
- Check the OneDrive icon in your system tray

**Multiple OneDrive accounts**
- Run `odsp-memory config list` to see all folders
- Run `odsp-memory config set <number>` to select one

**Memories not syncing**
- Check OneDrive sync status in system tray
- Files are stored in: OneDrive/Apps/ClaudeMemory/
EOF

echo ""
echo -e "\033[32mDone! Distribution package created in: $DIST_FOLDER/\033[0m"
echo ""
echo -e "\033[33mShare these files via Teams:\033[0m"
ls -1 "$DIST_FOLDER" | sed 's/^/  - /'
echo ""
echo -e "\033[33mTeammates should:\033[0m"
echo "  1. Download both files to the same folder"
echo "  2. Open terminal in that folder"
echo "  3. Run: npm install -g ./odsp-memory-skill-1.0.0.tgz"
echo ""
