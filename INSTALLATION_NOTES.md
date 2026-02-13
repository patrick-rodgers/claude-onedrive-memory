# Installation Setup Notes

## Repository Configuration

Repository: `patrick-rodgers/claude-onedrive-memory`

All installation scripts are configured with this repository name.

## Testing the Installation

### Test Locally (Dry Run)
```bash
# Test the release process
npm run release patch -- --dry-run

# Verify distribution files are created
ls -lh teams-distribution/
```

### Test Installation Scripts

**Windows (PowerShell):**
```powershell
# Test locally
powershell -ExecutionPolicy Bypass -File install.ps1

# Test from GitHub (after pushing)
iwr -useb https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.ps1 | iex
```

**macOS/Linux (Bash):**
```bash
# Test locally
bash install.sh

# Test from GitHub (after pushing)
curl -fsSL https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.sh | bash
```

## Release Workflow

1. **Create a release:**
   ```bash
   npm run release patch  # or minor, or major
   ```

   This automatically:
   - Bumps version in package.json
   - Builds and packages the distribution
   - Commits the version bump
   - Creates and pushes a git tag
   - Creates a GitHub release with attached files

2. **Verify GitHub release:**
   - Visit: https://github.com/patrick-rodgers/claude-onedrive-memory/releases
   - Check that all files are attached:
     - `odsp-memory-skill-{version}.tgz`
     - `install.ps1`
     - `INSTALL.md`

3. **Test installation:**
   - Run the one-line install command on a test machine
   - Verify `odsp-memory` command works: `odsp-memory status`

## What Users Get

When users run the one-line install command:
1. ✅ Latest version downloaded automatically from GitHub releases
2. ✅ `odsp-memory` command installed globally
3. ✅ Claude Code configured automatically (skill.md + hooks)
4. ✅ Memory commands work without permission prompts
5. ✅ Auto-recall enabled for new Claude sessions

## User Installation

Users can install with a single command:

**Windows:**
```powershell
iwr -useb https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.ps1 | iex
```

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/patrick-rodgers/claude-onedrive-memory/main/install.sh | bash
```

No need to download files or clone the repository!

## Troubleshooting Installation

### "Failed to fetch release"
- Ensure at least one GitHub release exists
- Check repository is public (or user has access)
- Verify internet connection

### "npm install failed"
- User may need admin/sudo: `sudo bash install.sh` or run PowerShell as Administrator
- Check Node.js version: `node --version` (requires 18+)

### "Setup encountered issues"
- User can run setup manually: `odsp-memory setup`
- Verify Claude Code is installed
- Check `~/.claude` directory exists

### "OneDrive not detected"
- Informational only - will prompt user to select folder on first use
- User can configure later: `odsp-memory config list`
