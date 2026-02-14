# OneDrive Memory - MCP Server

This MCP server provides persistent memory storage using your local OneDrive folder. Memories sync automatically to the cloud.

## How It Works

The server exposes **15 MCP tools** and **MCP resources** for browsing memories. When installed as an MCP server, I can automatically use these tools without needing bash commands.

## When to Use Memory

**PROACTIVELY remember things** when you discover:
- Project structure, architecture, or key files
- Important decisions and their rationale
- User preferences for coding style, naming, formatting
- Gotchas, bugs, or things that "just work this way"
- Ongoing tasks, blockers, or next steps

**PROACTIVELY recall context** at the start of sessions or when:
- Starting work on a project (use `get_context`)
- Making decisions (recall previous decisions)
- Writing code (recall preferences)
- Encountering issues (recall learnings)

## Available MCP Tools

### Core Memory Operations

#### `remember` - Store a Memory
Store new information with automatic project scoping.

**Parameters:**
- `category` (required): `project`, `decision`, `preference`, `learning`, or `task`
- `content` (required): The memory content (markdown supported)
- `tags` (optional): Array of tags for categorization
- `global` (optional): If true, memory is not project-scoped
- `priority` (optional): `high`, `normal`, or `low`
- `ttl` (optional): Auto-expire after duration (e.g., "7d", "30d", "1y")

**Examples:**
```
Remember project details:
  category: "project"
  content: "This is a React TypeScript app. Main components in /src/components"

Remember a decision:
  category: "decision"
  content: "Using Zustand for state management - simpler than Redux"
  tags: ["architecture", "state"]
```

#### `recall` - Search and Retrieve Memories
Search memories with intelligent ranking.

**Parameters:**
- `query` (optional): Search text
- `category` (optional): Filter by category
- `limit` (optional): Max results (default: 10)
- `global` (optional): Search only global memories
- `all` (optional): Search all memories regardless of project

#### `list` - List All Memories
List memories with optional filtering.

**Parameters:**
- `category` (optional): Filter by category
- `project` (optional): Filter by project ID
- `projectOnly` (optional): Show only current project memories

#### `forget` - Delete a Memory
Delete by ID (supports partial ID matching).

**Parameters:**
- `id` (required): Memory ID (full or partial)

#### `update` - Update a Memory
Update content or tags of existing memory.

**Parameters:**
- `id` (required): Memory ID
- `content` (optional): New content
- `tags` (optional): New tags array

#### `get_context` - Smart Project Context
Analyzes current project and returns relevant memories automatically.

**Parameters:**
- `limit` (optional): Max results (default: 5)
- `verbose` (optional): Show detected file patterns

#### `cleanup` - Remove Expired Memories
Delete memories past their TTL.

**Parameters:**
- `dryRun` (optional): Preview without deleting (default: false)

#### `status` - System Status
Check OneDrive detection and current project context. Shows warning if multiple OneDrive folders are detected.

#### `configure_storage` - Configure Storage Location
Select OneDrive folder or set custom storage path. Required when multiple OneDrive folders are detected.

**Parameters:**
- `action` (required): `list`, `select`, `custom`, or `reset`
- `index` (optional): Folder index for `select` action (1-based)
- `path` (optional): Custom path for `custom` action

**Examples:**
```
List available OneDrive folders:
  action: "list"

Select OneDrive folder:
  action: "select"
  index: 1

Set custom storage location:
  action: "custom"
  path: "/Users/you/Documents/ClaudeMemory"

Reset to auto-detection:
  action: "reset"
```

**Storage Behavior:**
- OneDrive folders: Memories stored in `{folder}/Apps/ClaudeMemory/`
- Custom paths: Memories stored directly in specified path
- Preference saved to `~/.claude/odsp-memory/config.json`

### Memory Relationships

#### `link_memories` - Link Two Memories
Create or remove bidirectional links.

**Parameters:**
- `id1` (required): First memory ID
- `id2` (required): Second memory ID
- `operation` (optional): `link` or `unlink` (default: `link`)

#### `get_related` - Get Related Memories
Show all memories linked to a specific memory.

**Parameters:**
- `id` (required): Memory ID

#### `merge_memories` - Merge Multiple Memories
Combine memories into one (originals are deleted).

**Parameters:**
- `ids` (required): Array of memory IDs (minimum 2)
- `title` (optional): Custom title for merged memory

### Batch Operations

#### `batch_tag` - Add/Remove Tags in Bulk
Tag or untag multiple memories at once.

**Parameters:**
- `tag` (required): Tag name
- `operation` (required): `add` or `remove`
- `query` (optional): Filter by search
- `category` (optional): Filter by category
- `dryRun` (optional): Preview changes (default: false)

#### `batch_delete` - Delete Multiple Memories
Delete memories matching filters. **Always use dryRun first!**

**Parameters:**
- `category` (optional): Delete all in category
- `expired` (optional): Delete expired memories
- `stale` (optional): Delete memories >90 days old
- `query` (optional): Delete matching search
- `dryRun` (optional): Preview only (default: true for safety)

### Analytics & Export

#### `get_statistics` - Memory Statistics
Get comprehensive stats about your memories.

#### `visualize_graph` - Relationship Graph
Generate mermaid diagram of memory relationships.

**Parameters:**
- `fromId` (optional): Start from specific memory
- `depth` (optional): Max depth to traverse (default: 3)

#### `export_memories` - Export to JSON/Markdown
Export memories for backup or analysis.

**Parameters:**
- `format` (optional): `json` or `markdown` (default: `json`)
- `category` (optional): Export specific category only

## MCP Resources

Browse memories as resources:
- `memory://list` - All memories as JSON
- `memory://{id}` - Specific memory as markdown
- `memory://project/{project-id}` - Project memories
- `memory://category/{category}` - Category memories

## Best Practices for Memory Content

1. **Be specific and actionable** - "API uses JWT tokens in Authorization header" not "uses tokens"
2. **Include the why** - "Chose PostgreSQL for ACID compliance in financial data"
3. **Reference file paths** - "Main entry point is /src/index.ts, routes defined in /src/routes/"
4. **Note gotchas explicitly** - "GOTCHA: Must run npm install in /packages/shared first"
5. **Update outdated memories** - Use `forget` and `remember` to replace outdated info

## Session Start Routine

At the beginning of a session with a returning user, I should:
1. Call `get_context` to get smart project-relevant memories
2. Call `recall` with `category: "preference"` to get user preferences
3. Call `recall` with `category: "task"` to check for ongoing work

## Storage Location

Memories are stored in:
```
OneDrive/Apps/ClaudeMemory/
```

Files are human-readable markdown and sync automatically across devices.

## Categories Explained

- **project**: Codebase structure, architecture, key files, tech stack
- **decision**: Architectural choices, library selections, approach decisions with rationale
- **preference**: User's coding style, naming conventions, formatting preferences
- **learning**: Gotchas, bug fixes, discoveries, things that need special handling
- **task**: Current work, next steps, blockers, TODOs
