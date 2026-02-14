# MCP Interface Reference

**Server Name:** `claude-onedrive-memory`
**Version:** `0.2.0`
**Protocol:** Model Context Protocol (MCP)

## Overview

Persistent memory server for Claude using OneDrive or custom storage. Provides 17 tools for memory operations and exposes memories as browsable resources.

## MCP Resources

All resources use the `memory://` URI scheme.

### Resource Types

| URI Pattern | Description | Format |
|------------|-------------|--------|
| `memory://list` | Complete list of all memories | JSON array |
| `memory://{id}` | Individual memory by UUID | Markdown with YAML frontmatter |
| `memory://project/{project-id}` | All memories for a specific project | JSON array |
| `memory://category/{category}` | All memories in a category | JSON array |

### Resource Details

**`memory://list`**
- Returns array of memory metadata objects
- Each object includes: id, title, category, tags, created, updated, projectId, projectName
- Use for: Browsing all memories, getting overview

**`memory://{id}`**
```markdown
# Memory Title

**Category:** project
**Tags:** react, typescript
**Created:** 2024-02-14
**Updated:** 2024-02-14
**Project:** myproject

---

Memory content here...
```

**`memory://project/{project-id}`**
- Project ID format: `github.com/user/repo` (URL-encoded)
- Returns memories scoped to that git repository
- Auto-detects current project context

**`memory://category/{category}`**
- Valid categories: `project`, `decision`, `preference`, `learning`, `task`
- Returns all memories in that category
- Useful for focused browsing

## MCP Tools

### Core Operations (9 tools)

#### 1. `remember`
Store a new memory with automatic project scoping.

```json
{
  "category": "project|decision|preference|learning|task",
  "content": "Memory content (markdown supported)",
  "tags": ["tag1", "tag2"],
  "global": false,
  "priority": "high|normal|low",
  "ttl": "7d|30d|1y"
}
```

#### 2. `recall`
Search memories with intelligent ranking.

```json
{
  "query": "search text",
  "category": "project|decision|preference|learning|task",
  "limit": 10,
  "global": false,
  "all": false
}
```

#### 3. `list`
List memories with optional filters.

```json
{
  "category": "project|decision|preference|learning|task",
  "project": "project-id",
  "projectOnly": false
}
```

#### 4. `forget`
Delete a memory (supports partial ID).

```json
{
  "id": "full-or-partial-uuid"
}
```

#### 5. `update`
Update memory content or tags.

```json
{
  "id": "memory-id",
  "content": "new content",
  "tags": ["new", "tags"]
}
```

#### 6. `get_context`
Smart context based on current project.

```json
{
  "limit": 5,
  "verbose": false
}
```

#### 7. `cleanup`
Remove expired memories.

```json
{
  "dryRun": false
}
```

#### 8. `status`
Check OneDrive detection and system status.

```json
{}
```

#### 9. `configure_storage`
Select OneDrive folder or set custom storage path.

```json
{
  "action": "list|select|custom|reset",
  "index": 1,
  "path": "/custom/path"
}
```

### Memory Relationships (3 tools)

#### 10. `link_memories`
Link or unlink two memories.

```json
{
  "id1": "first-memory-id",
  "id2": "second-memory-id",
  "operation": "link|unlink"
}
```

#### 11. `get_related`
Get all memories linked to a specific memory.

```json
{
  "id": "memory-id"
}
```

#### 12. `merge_memories`
Merge multiple memories into one.

```json
{
  "ids": ["id1", "id2", "id3"],
  "title": "optional custom title"
}
```

### Batch Operations (2 tools)

#### 13. `batch_tag`
Add or remove tags from multiple memories.

```json
{
  "tag": "tag-name",
  "operation": "add|remove",
  "query": "optional search",
  "category": "optional category",
  "dryRun": false
}
```

#### 14. `batch_delete`
Delete multiple memories with filters.

```json
{
  "category": "optional category",
  "expired": false,
  "stale": false,
  "query": "optional search",
  "dryRun": true
}
```

### Analytics & Export (3 tools)

#### 15. `get_statistics`
Get comprehensive memory statistics.

```json
{}
```

#### 16. `visualize_graph`
Generate mermaid relationship diagram.

```json
{
  "fromId": "optional starting memory",
  "depth": 3
}
```

#### 17. `export_memories`
Export memories to JSON or Markdown.

```json
{
  "format": "json|markdown",
  "category": "optional category filter"
}
```

## Storage Configuration

### Auto-Detection
- Checks `OneDriveCommercial`, `OneDriveConsumer`, `OneDrive` environment variables
- Scans home directory for `OneDrive - *` or `OneDrive` folders
- Saves preference to `~/.claude/odsp-memory/config.json`

### Storage Paths
- **OneDrive**: `{folder}/Apps/ClaudeMemory/`
- **Custom**: Uses specified path directly

### Multiple OneDrive Accounts
1. `status` tool shows all detected folders
2. `configure_storage` with `action: "list"` shows options
3. `configure_storage` with `action: "select"` and `index: N` to choose
4. Preference persists across sessions

## Memory Format

Memories are stored as markdown files with YAML frontmatter:

```markdown
---
id: uuid-v4
category: project|decision|preference|learning|task
tags: [tag1, tag2]
created: 2024-02-14T10:30:00Z
updated: 2024-02-14T10:30:00Z
projectId: github.com/user/repo (optional)
projectName: Project Name (optional)
priority: high|normal|low (optional)
expiresAt: 2024-03-14T10:30:00Z (optional)
relatedTo: [id1, id2] (optional)
---

# Memory Title

Memory content in markdown format...
```

## Categories

| Category | Purpose |
|----------|---------|
| `project` | Codebase structure, architecture, key files, tech stack |
| `decision` | Architectural choices, library selections, rationale |
| `preference` | User's coding style, conventions, formatting |
| `learning` | Gotchas, bug fixes, discoveries, special handling |
| `task` | Current work, next steps, blockers, TODOs |

## Project Scoping

- Memories automatically detect current git repository
- Stored with normalized project ID (git remote URL)
- Search/recall filters to current project by default
- Use `global: true` flag to create cross-project memories

## Priority System

- **high**: Important memories, boosted in search results
- **normal**: Default priority (most memories)
- **low**: Less important, deprioritized in search

## TTL (Time-To-Live)

Format: `{number}{unit}` where unit is:
- `d` - days
- `w` - weeks
- `m` - months
- `y` - years

Examples: `7d`, `2w`, `3m`, `1y`

Expired memories can be removed with `cleanup` tool.

## Search Ranking

Intelligent scoring considers:
1. **Content relevance** - TF-IDF scoring on query terms
2. **Tag matches** - Exact tag matches get boost
3. **Category matches** - Requested category gets boost
4. **Priority** - High priority memories ranked higher
5. **Recency** - Recent memories slightly preferred
6. **Project match** - Current project memories prioritized

## Error Handling

All tools return structured responses:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Success or error message"
    }
  ],
  "isError": false
}
```

## Client Integration

### Configuration

**Claude Desktop:**
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

**Claude Code CLI:**
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

### Transport
- **Protocol**: JSON-RPC 2.0 over stdio
- **Input**: stdin
- **Output**: stdout (protocol messages)
- **Logs**: stderr (server status, errors)

## Startup Output

```
═══════════════════════════════════════════════════════════════
  claude-onedrive-memory MCP Server v0.2.0
  Persistent memory for Claude using OneDrive or custom storage
═══════════════════════════════════════════════════════════════

📦 MCP Resources (memory:// URI scheme):
   • memory://list              - All memories (JSON)
   • memory://{id}              - Specific memory (Markdown)
   • memory://project/{id}      - Project memories (JSON)
   • memory://category/{name}   - Category memories (JSON)

🛠️  MCP Tools: 17 operations available
   Core: remember, recall, list, forget, update, get_context,
         cleanup, status, configure_storage
   Advanced: link_memories, get_related, merge_memories,
             batch_tag, batch_delete, get_statistics,
             visualize_graph, export_memories

📁 Storage: Auto-detects OneDrive or use custom path
   Use "status" tool to check, "configure_storage" to set
═══════════════════════════════════════════════════════════════
```
