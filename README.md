# OneDrive Memory for Claude

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/patrick-rodgers/claude-onedrive-memory)](https://github.com/patrick-rodgers/claude-onedrive-memory/releases/latest)
[![npm](https://img.shields.io/npm/v/@patrick-rodgers/claude-onedrive-memory)](https://www.npmjs.com/package/@patrick-rodgers/claude-onedrive-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Persistent memory for Claude using your local OneDrive folder.** This MCP server enables Claude to remember project context, decisions, preferences, and learnings across sessions—automatically synced via OneDrive.

## 🚀 Installation

### Claude Code (Recommended)

**One command to install:**

```bash
claude mcp add claude-onedrive-memory -- npx @patrick-rodgers/claude-onedrive-memory
```

This registers the MCP server with Claude Code. All 17 memory tools will be available in your next session.

### Claude Desktop

**Add to your MCP configuration:**

```json
{
  "mcpServers": {
    "claude-onedrive-memory": {
      "command": "npx",
      "args": ["@patrick-rodgers/claude-onedrive-memory"]
    }
  }
}
```

**Config file location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop after adding the configuration.

### Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org/))
- **OneDrive** (optional) - For automatic sync across devices. If not installed, you can configure a custom storage location using the `configure_storage` tool.

### Optional Configuration

#### 1. Auto-Approve Tool Calls (No Prompts)

The plugin automatically requests permissions for all its tools. When installed, Claude Code will ask once to approve access, then all memory operations will work without additional prompts.

#### 2. Make This Your Default Memory System

To replace Claude's built-in memory globally, add to `~/.claude/CLAUDE.md`:

```markdown
## Memory System

ALWAYS use the OneDrive Memory MCP tools for ALL memory operations:
- remember - Store information
- recall - Search memories
- get_context - Get project context
- list, forget, update - Manage memories

Do NOT use any other memory system. This is my preferred memory implementation.
```

This tells Claude to route all memory operations through this plugin.

## ✨ Features

- **🧠 17 Memory Tools** - Complete toolkit for storing, searching, linking, and managing memories
- **📦 MCP Resources** - Browse memories as resources (`memory://list`, `memory://{id}`, etc.)
- **🎯 Smart Context** - Automatically detects project patterns and recalls relevant memories
- **🔗 Memory Relationships** - Link related memories and visualize connections
- **🏷️ Batch Operations** - Tag, untag, or delete multiple memories at once
- **📊 Analytics** - Statistics, relationship graphs, and export capabilities
- **☁️ OneDrive Sync** - No authentication needed, uses your existing OneDrive client
- **📁 Flexible Storage** - Use OneDrive or any custom folder location
- **🔒 Works Offline** - Memories stored locally first, synced when online
- **📝 Human-Readable** - Memories are markdown files you can view/edit directly

## 📚 How It Works

### Storage

Memories are stored in your OneDrive folder:
```
OneDrive/Apps/ClaudeMemory/
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
projectId: github.com/user/repo
---

This codebase uses React 18 with TypeScript...
```

### Automatic Project Scoping

Memories are automatically scoped to your current git repository. When you store a memory, it's tagged with the project context. When you search, you get project-relevant results first.

## 🛠️ Available Tools

### Core Operations (9 tools)

| Tool | Description |
|------|-------------|
| `remember` | Store a new memory with category, tags, priority, and TTL |
| `recall` | Search and retrieve memories with intelligent ranking |
| `list` | List all memories with optional category/project filters |
| `forget` | Delete a memory by ID (supports partial matching) |
| `update` | Update memory content or tags |
| `get_context` | Smart context based on current project and file patterns |
| `cleanup` | Remove expired memories (with dry-run preview) |
| `status` | Check OneDrive detection and system status |
| `configure_storage` | Select OneDrive folder or set custom storage location |

### Advanced Operations (7 tools)

| Tool | Description |
|------|-------------|
| `link_memories` | Create or remove bidirectional links between memories |
| `get_related` | Get all memories linked to a specific memory |
| `merge_memories` | Merge multiple memories into one |
| `batch_tag` | Add or remove tags from multiple memories |
| `batch_delete` | Delete multiple memories with filters (always use dry-run first!) |
| `get_statistics` | Comprehensive memory statistics and health metrics |
| `visualize_graph` | Generate mermaid diagram of memory relationships |
| `export_memories` | Export to JSON or Markdown for backup/analysis |

## 📦 MCP Resources

Browse memories as resources:

- `memory://list` - All memories as JSON
- `memory://{id}` - Specific memory as Markdown
- `memory://project/{project-id}` - Memories for a specific project
- `memory://category/{category}` - Memories by category

## 🎨 Claude Code Plugin Features

When used with Claude Code, this plugin includes additional features:

### 🪝 Automatic Session Hooks
- **Session Start** - Automatically recalls project context when you start a new session
- No need to manually ask Claude to remember—it happens automatically

### ⌨️ Slash Commands
- `/remember` - Quick memory creation
- `/recall` - Search memories
- `/memory-status` - Check system status

### 📖 Skills
- Rich documentation and guidance available via skills system
- Type `/memory` to access memory skill documentation

## 💡 Usage Examples

### Basic Memory Operations

**Store project information:**
```
Tool: remember
  category: "project"
  content: "This is a React TypeScript app. Main entry point is /src/index.tsx. Components in /src/components, API calls in /src/api"
  tags: ["react", "typescript", "architecture"]
```

**Store a decision:**
```
Tool: remember
  category: "decision"
  content: "Using Zustand for state management instead of Redux. It's simpler, has less boilerplate, and the team is already familiar with it."
  tags: ["architecture", "state-management"]
```

**Store user preferences:**
```
Tool: remember
  category: "preference"
  content: "User prefers functional components with hooks. Avoid class components. Use named exports over default exports."
  global: true
```

**Search memories:**
```
Tool: recall
  query: "authentication"
  category: "decision"
  limit: 5
```

**Get smart project context:**
```
Tool: get_context
  limit: 5
  verbose: true
```

### Advanced Operations

**Link related memories:**
```
Tool: link_memories
  id1: "abc123"
  id2: "def456"
  operation: "link"
```

**Merge duplicate memories:**
```
Tool: merge_memories
  ids: ["abc123", "def456", "ghi789"]
  title: "Combined React Component Guidelines"
```

**Batch tag memories:**
```
Tool: batch_tag
  tag: "refactoring"
  operation: "add"
  category: "task"
  dryRun: true
```

**Get statistics:**
```
Tool: get_statistics
```

**Export memories:**
```
Tool: export_memories
  format: "json"
  category: "project"
```

## 📋 Memory Categories

| Category | Use For |
|----------|---------|
| `project` | Codebase structure, architecture, key files, tech stack |
| `decision` | Architectural choices, library selections, approach decisions with rationale |
| `preference` | User's coding style, naming conventions, formatting preferences |
| `learning` | Gotchas, bug fixes, discoveries, things that need special handling |
| `task` | Current work, next steps, blockers, TODOs |

You can also use custom category names.

## 🎯 Best Practices

### When to Remember

Claude should **proactively remember** when discovering:
- Project structure, architecture, or key files
- Important decisions and their rationale
- User preferences for coding style, naming, formatting
- Gotchas, bugs, or things that "just work this way"
- Ongoing tasks, blockers, or next steps

### Memory Content Tips

1. **Be specific and actionable** - "API uses JWT tokens in Authorization header" not "uses tokens"
2. **Include the why** - "Chose PostgreSQL for ACID compliance in financial data"
3. **Reference file paths** - "Main entry point is /src/index.ts, routes defined in /src/routes/"
4. **Note gotchas explicitly** - "GOTCHA: Must run npm install in /packages/shared first"
5. **Update outdated memories** - Use `forget` and `remember` to replace outdated information

### Session Start Routine

**With Claude Code (automatic):**
The plugin's session hook automatically recalls project context when you start a new session. No manual action needed!

**With Claude Desktop (manual):**
At the beginning of a session, you can ask Claude to:
1. Call `get_context` to get smart project-relevant memories
2. Call `recall` with `category: "preference"` to get user preferences
3. Call `recall` with `category: "task"` to check for ongoing work

## 🔧 Development

### Build

```bash
npm install
npm run build
```

### Test with MCP Inspector

```bash
npm test
```

This launches the MCP Inspector where you can manually invoke tools and see responses.

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/patrick-rodgers/claude-onedrive-memory.git
cd claude-onedrive-memory
```

2. Install and build:
```bash
npm install
npm run build
```

3. Configure Claude to use local build (see Installation section above)

## ⚙️ Storage Configuration

### Automatic Detection

By default, the MCP server automatically detects your OneDrive folder using:
1. Environment variables (`OneDriveCommercial`, `OneDriveConsumer`, `OneDrive`)
2. Home directory scan for `OneDrive - *` or `OneDrive` folders

Memories are stored in: `OneDrive/Apps/ClaudeMemory/`

### Multiple OneDrive Accounts

If you have multiple OneDrive accounts, the `status` tool will show all detected folders and prompt you to select one:

```
Tool: status
```

Then select your preferred folder:

```
Tool: configure_storage
  action: "list"          # Show available OneDrive folders
```

```
Tool: configure_storage
  action: "select"
  index: 1                # Select first folder (1-based index)
```

### Custom Storage Location

You can use any folder location instead of OneDrive:

```
Tool: configure_storage
  action: "custom"
  path: "/Users/you/Documents/ClaudeMemory"
```

**Note:**
- OneDrive folders get `/Apps/ClaudeMemory` appended automatically
- Custom paths are used directly without any subfolder

Your preference is saved to `~/.claude/odsp-memory/config.json`

### Reset to Auto-Detection

```
Tool: configure_storage
  action: "reset"
```

## 🐛 Troubleshooting

### "Could not find OneDrive folder"

- Make sure OneDrive is installed and signed in
- Check that sync is enabled (look for OneDrive icon in system tray)
- On Windows, check if `%OneDriveCommercial%` or `%OneDrive%` environment variables are set
- Use the `status` tool to see detection details
- Or use `configure_storage` to set a custom location

### Multiple OneDrive Accounts

If you have multiple OneDrive accounts (e.g., work and personal):
1. Use `status` tool to see all detected folders
2. Use `configure_storage` with `action: "select"` to choose one
3. The server prioritizes work/school accounts by default

### Memories Not Syncing

- Check OneDrive sync status in system tray
- Ensure you have internet connectivity
- Look for sync errors in OneDrive settings
- The memories are stored locally first and will sync when OneDrive is ready

## 📄 License

MIT

## Warranty Disclaimer

This software is provided "AS IS", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

## 🙏 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📦 Related

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/download)
- [Claude Code CLI](https://github.com/anthropics/claude-code)
