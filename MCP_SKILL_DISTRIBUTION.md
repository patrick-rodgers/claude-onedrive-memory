# MCP Server Setup Skill - Distribution Guide

## Quick Install

1. Download `mcp-setup-skill.md`
2. Copy to your project: `.claude/skills/mcp-setup.md`
3. Invoke in Claude Code: `/mcp-setup`

## What It Does

Interactive guidance for creating MCP servers at Microsoft following the official paved path. Helps you go from zero to working MCP server in under an hour.

## Phases Covered

1. **Planning**: API selection, Entra setup, admin consent
2. **Scaffolding**: Template installation, project creation
3. **Implementation**: Tool design, auth, security validation
4. **Testing**: Local and integration testing
5. **Documentation**: README generation, packaging

## Usage

```bash
# In Claude Code
/mcp-setup
```

Claude will guide you through each phase interactively, asking questions, generating code, and validating security.

## Distribution Options

### Option 1: Via SharePoint/Wiki
Upload `mcp-setup-skill.md` to a shared location with instructions:
- Download the file
- Save to `.claude/skills/mcp-setup.md` in your project
- Restart Claude Code if needed
- Run `/mcp-setup`

### Option 2: Via Git Repository
```bash
# Clone or download
git clone <repo-url>

# Copy skill
cp mcp-setup-skill.md ~/.claude/skills/mcp-setup.md  # Global
# OR
cp mcp-setup-skill.md .claude/skills/mcp-setup.md    # Project-specific
```

### Option 3: Via npm Package (future)
Could be bundled with other Microsoft Claude Code utilities.

## Sample Session

```
User: /mcp-setup

Claude: Let's set up an MCP server for Microsoft! First, I need to understand
your use case:

1. Which remote API do you want your MCP tools to call?
   (e.g., Microsoft Graph, Azure DevOps, internal service API)

2. What specific endpoints or actions do you want to expose?

...
[Guides through entire process]
```

## Authors

Patrick Rodgers, Olga Podolyako, David Parks, Joao Paiva

## Support

For issues or questions, contact the ODSP API Platform team.
