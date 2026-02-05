# Package OneDrive Memory Skill for Teams distribution
# Run from project root: .\scripts\package-for-teams.ps1

Write-Host "Building and packaging odsp-memory-skill..." -ForegroundColor Cyan

# Clean and build
Write-Host "  - Cleaning dist folder..."
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }

Write-Host "  - Installing dependencies..."
npm install 2>&1 | Out-Null

Write-Host "  - Building TypeScript..."
npm run build 2>&1 | Out-Null

# Create distribution folder
$distFolder = "teams-distribution"
Write-Host "  - Creating distribution folder..."
if (Test-Path $distFolder) { Remove-Item -Recurse -Force $distFolder }
New-Item -ItemType Directory -Path $distFolder | Out-Null

# Create package
Write-Host "  - Creating npm package..."
npm pack --pack-destination "$distFolder" 2>&1 | Out-Null

# Create install instructions
$installInstructions = @"
# OneDrive Memory Skill - Quick Install

## Prerequisites
- Node.js 18 or higher
- OneDrive client installed and syncing

## Installation

1. Open PowerShell or Command Prompt in this folder
2. Run:
   ``````
   npm install -g ./odsp-memory-skill-1.0.0.tgz
   ``````

## Setup

1. Verify OneDrive detection:
   ``````
   odsp-memory status
   ``````

2. If you have multiple OneDrive accounts, select the right one:
   ``````
   odsp-memory config list
   odsp-memory config set <number>
   ``````

3. Test it works:
   ``````
   odsp-memory remember project "Test memory"
   odsp-memory list
   ``````

## Add to Claude Code

Add this to your Claude Code project's CLAUDE.md file or settings:

``````markdown
## Memory Skill

I have access to persistent memory via OneDrive. Use these commands:

- ``odsp-memory remember <category> <content>`` - Store a memory
- ``odsp-memory recall [query]`` - Search memories
- ``odsp-memory list [category]`` - List all memories
- ``odsp-memory forget <id>`` - Delete a memory

Categories: project, decision, preference, learning, task

Proactively remember important context about projects, decisions, and user preferences.
At the start of sessions, recall relevant context with: ``odsp-memory recall --category=project``
``````

## Commands Reference

| Command | Description |
|---------|-------------|
| ``odsp-memory remember <category> <content>`` | Store a memory |
| ``odsp-memory recall [query]`` | Search/retrieve memories |
| ``odsp-memory list [category]`` | List all memories |
| ``odsp-memory forget <id>`` | Delete a memory |
| ``odsp-memory status`` | Show OneDrive location |
| ``odsp-memory config list`` | List OneDrive folders |
| ``odsp-memory config set <n>`` | Select OneDrive folder |
| ``odsp-memory help`` | Show all commands |

## Troubleshooting

**"OneDrive folder not found"**
- Make sure OneDrive is installed and signed in
- Check the OneDrive icon in your system tray

**Multiple OneDrive accounts**
- Run ``odsp-memory config list`` to see all folders
- Run ``odsp-memory config set <number>`` to select one

**Memories not syncing**
- Check OneDrive sync status in system tray
- Files are stored in: OneDrive/Apps/ClaudeMemory/
"@

$installInstructions | Out-File -FilePath "$distFolder/INSTALL.md" -Encoding UTF8

Write-Host ""
Write-Host "Done! Distribution package created in: $distFolder/" -ForegroundColor Green
Write-Host ""
Write-Host "Share these files via Teams:" -ForegroundColor Yellow
Get-ChildItem $distFolder | ForEach-Object { Write-Host "  - $($_.Name)" }
Write-Host ""
Write-Host "Teammates should:" -ForegroundColor Yellow
Write-Host "  1. Download both files to the same folder"
Write-Host "  2. Open PowerShell in that folder"
Write-Host "  3. Run: npm install -g ./odsp-memory-skill-1.0.0.tgz"
Write-Host ""
