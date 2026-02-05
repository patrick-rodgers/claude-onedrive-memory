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
# OneDrive Memory Skill for Claude Code

Gives Claude persistent memory across sessions using your OneDrive.

## Prerequisites
- Node.js 18 or higher (check with ``node --version``)
- OneDrive client installed and syncing

## One-Line Install

Open PowerShell in this folder and run:

``````powershell
powershell -ExecutionPolicy Bypass -File install.ps1
``````

That's it! The script:
1. Installs the ``odsp-memory`` command globally
2. Configures Claude Code to auto-recall memories at session start
3. Adds permissions so memory commands run without prompts

## What Happens After Install

- **Auto-recall**: Claude automatically retrieves recent memories when you start a session
- **No prompts**: Memory commands run without asking for permission
- **Proactive memory**: Claude will remember important context about projects and decisions

## Manual Installation (if needed)

``````powershell
npm install -g ./odsp-memory-skill-1.0.0.tgz
odsp-memory setup
``````

## Multiple OneDrive Accounts

If you have multiple OneDrive accounts, select the right one after install:

``````powershell
odsp-memory config list
odsp-memory config set <number>
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

# Create one-liner install script
$installScript = @'
# OneDrive Memory Skill - One-Line Installer
# Run this script in PowerShell from the folder containing the .tgz file

$ErrorActionPreference = "Stop"

Write-Host "Installing OneDrive Memory Skill..." -ForegroundColor Cyan

# Find the package file
$packageFile = Get-ChildItem -Filter "odsp-memory-skill-*.tgz" | Select-Object -First 1
if (-not $packageFile) {
    Write-Host "Error: Package file (odsp-memory-skill-*.tgz) not found in current directory." -ForegroundColor Red
    Write-Host "Make sure you're running this from the folder containing the .tgz file." -ForegroundColor Yellow
    exit 1
}

Write-Host "  - Installing $($packageFile.Name)..."
npm install -g "./$($packageFile.Name)"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: npm install failed." -ForegroundColor Red
    exit 1
}

Write-Host "  - Configuring Claude Code..."
odsp-memory setup

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now use memory commands in Claude Code." -ForegroundColor Cyan
Write-Host "Claude will automatically remember and recall context across sessions."
Write-Host ""
'@

$installScript | Out-File -FilePath "$distFolder/install.ps1" -Encoding UTF8

Write-Host ""
Write-Host "Done! Distribution package created in: $distFolder/" -ForegroundColor Green
Write-Host ""
Write-Host "Share these files via Teams:" -ForegroundColor Yellow
Get-ChildItem $distFolder | ForEach-Object { Write-Host "  - $($_.Name)" }
Write-Host ""
Write-Host "Teammates run ONE command:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File install.ps1" -ForegroundColor White
Write-Host ""
