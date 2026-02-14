---
description: Persistent memory storage using OneDrive local sync. Use when you need to remember or recall information across sessions.
---

# OneDrive Memory Skill

This skill provides persistent memory storage using the local OneDrive folder. Memories sync automatically to the cloud.

## When to Use This Skill

**PROACTIVELY remember things** when you discover:
- Project structure, architecture, or key files
- Important decisions and their rationale
- User preferences for coding style, naming, formatting
- Gotchas, bugs, or things that "just work this way"
- Ongoing tasks, blockers, or next steps

**PROACTIVELY recall context** at the start of sessions or when:
- Starting work on a project (recall project context)
- Making decisions (recall previous decisions)
- Writing code (recall preferences)
- Encountering issues (recall learnings)

## Available Tools

### memory_remember - Store a Memory
Store a new memory, automatically scoped to the current git project.

Parameters:
- `category` (required) - project, decision, preference, learning, task, or custom
- `content` (required) - The memory content
- `tags` - Array of tags
- `global` - If true, not scoped to any project
- `priority` - high, normal, or low
- `ttl` - Auto-expire duration (e.g., 7d, 2w, 1m, 1y)

### memory_recall - Retrieve Memories
Search and retrieve stored memories.

Parameters:
- `query` - Search text
- `category` - Filter by category
- `limit` - Max results (default: 10)
- `all` - Show all memories regardless of project
- `global` - Show only global memories

### memory_context - Smart Context Recall
Recall relevant memories based on current project and detected file patterns. Best used at session start.

Parameters:
- `limit` - Max memories (default: 5)
- `verbose` - Show detected file patterns

### memory_list - List Memories
List all stored memories, optionally filtered.

### memory_forget - Delete a Memory
Delete a memory by full or partial ID.

### memory_update - Update a Memory
Update content or tags of an existing memory.

### memory_link / memory_related - Relationships
Create bidirectional links between memories and explore relationships.

### memory_merge - Consolidate
Merge multiple related memories into one.

### memory_stats / memory_graph - Analytics
View statistics and visualize relationship graphs.

### memory_export - Export
Export memories to JSON or markdown.

### memory_tag / memory_untag - Batch Tagging
Add or remove tags across multiple memories.

### memory_bulk_delete / memory_cleanup - Maintenance
Clean up expired or stale memories.

### memory_status / memory_config - Configuration
Check OneDrive status and manage folder selection.

## Categories

- `project` - Codebase structure, architecture, key files
- `decision` - Choices made and rationale
- `preference` - Coding style, conventions, formatting preferences
- `learning` - Gotchas, discoveries, important notes
- `task` - Ongoing work, next steps, blockers

## Best Practices for Memory Content

1. **Be specific and actionable** - "API uses JWT tokens in Authorization header" not "uses tokens"
2. **Include the why** - "Chose PostgreSQL for ACID compliance in financial data"
3. **Reference file paths** - "Main entry point is /src/index.ts, routes defined in /src/routes/"
4. **Note gotchas explicitly** - "GOTCHA: Must run npm install in /packages/shared first"
5. **Update outdated memories** - If something changes, forget the old memory and create a new one

## Session Start Routine

At the beginning of a session with a returning user, use `memory_context` to recall up to 5 relevant memories. This gives you project context, user preferences, and any ongoing tasks.

## Storage Location

Memories are stored in the user's OneDrive folder at:
```
OneDrive/Apps/ClaudeMemory/
```

Files are human-readable markdown and sync automatically across devices.
