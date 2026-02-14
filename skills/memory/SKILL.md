# Memory Skill

Persistent memory storage using OneDrive or custom storage. This skill provides 17 MCP tools and browsable resources for managing project context, decisions, preferences, and learnings across sessions.

## Trigger

**Always active.** Use proactively when discovering important information:
- Project structure, architecture, key files
- Important decisions and their rationale
- User preferences for coding style, naming, formatting
- Gotchas, bugs, or things that "just work this way"
- Ongoing tasks, blockers, or next steps

## When to Use

**Proactively REMEMBER** when you discover:
- Project details: "This is a React TypeScript app with Vite bundler"
- Decisions: "Using Zustand for state - simpler than Redux, team knows it"
- Preferences: "User prefers functional components with hooks over classes"
- Learnings: "GOTCHA: Must run npm install in /packages/shared first"
- Tasks: "Next: Implement authentication, blocked on API keys"

**Proactively RECALL** at session start or when:
- Starting work on a project → Use `get_context` tool
- Making decisions → Recall previous `decision` memories
- Writing code → Recall `preference` memories
- Encountering issues → Recall `learning` memories

## Available Tools (17 total)

### Core Operations (9 tools)

**`remember`** - Store a new memory
- `category`: project | decision | preference | learning | task
- `content`: Memory content (markdown supported)
- `tags`: Optional tags array
- `global`: True for cross-project memories
- `priority`: high | normal | low (affects search ranking)
- `ttl`: Auto-expire (e.g., "7d", "30d", "1y")

**`recall`** - Search and retrieve memories
- `query`: Search text (optional)
- `category`: Filter by category
- `limit`: Max results (default: 10)
- Uses intelligent ranking: relevance + priority + recency

**`get_context`** - Smart project context
- `limit`: Max results (default: 5)
- `verbose`: Show detected file patterns
- Auto-analyzes current project and returns relevant memories

**`list`** - List all memories
- `category`: Filter by category
- `project`: Filter by project ID
- `projectOnly`: Show only current project

**`forget`** - Delete a memory
- `id`: Memory ID (supports partial matching)

**`update`** - Update memory content or tags
- `id`: Memory ID
- `content`: New content (optional)
- `tags`: New tags array (optional)

**`cleanup`** - Remove expired memories
- `dryRun`: Preview without deleting (default: false)

**`status`** - System status
- Shows OneDrive folder, current project, storage info
- Warns if multiple OneDrive folders detected

**`configure_storage`** - Configure storage location
- `action`: list | select | custom | reset
- `index`: Folder index for select (1-based)
- `path`: Custom storage path

### Memory Relationships (3 tools)

**`link_memories`** - Link or unlink memories
- `id1`, `id2`: Memory IDs
- `operation`: link | unlink (default: link)

**`get_related`** - Get related memories
- `id`: Memory ID

**`merge_memories`** - Merge multiple memories
- `ids`: Array of memory IDs (minimum 2)
- `title`: Optional custom title

### Batch Operations (2 tools)

**`batch_tag`** - Add/remove tags in bulk
- `tag`: Tag name
- `operation`: add | remove
- `query`: Optional search filter
- `category`: Optional category filter
- `dryRun`: Preview changes (default: false)

**`batch_delete`** - Delete multiple memories
- `category`: Delete all in category
- `expired`: Delete expired memories
- `stale`: Delete memories >90 days old
- `query`: Delete matching search
- `dryRun`: Preview (default: true for safety)

### Analytics & Export (3 tools)

**`get_statistics`** - Memory statistics
- Returns counts by category, project, priority, tags
- Shows age distribution, health status

**`visualize_graph`** - Relationship diagram
- `fromId`: Optional starting memory
- `depth`: Max depth (default: 3)
- Generates mermaid diagram

**`export_memories`** - Export to JSON/Markdown
- `format`: json | markdown (default: json)
- `category`: Optional category filter

## MCP Resources

Browse memories via URI:
- `memory://list` - All memories (JSON)
- `memory://{id}` - Specific memory (Markdown)
- `memory://project/{project-id}` - Project memories (JSON)
- `memory://category/{category}` - Category memories (JSON)

## Memory Categories

- **project** - Codebase structure, architecture, key files, tech stack
- **decision** - Architectural choices, library selections, rationale
- **preference** - Coding style, naming conventions, formatting
- **learning** - Gotchas, bug fixes, discoveries, special handling
- **task** - Current work, next steps, blockers, TODOs

## Best Practices

### What to Remember

✅ **DO remember:**
- Specific, actionable information
- Decisions with rationale (the "why")
- File paths and locations
- Gotchas and special handling requirements
- User's explicit preferences

❌ **DON'T remember:**
- Generic information available in docs
- Implementation details that change frequently
- Temporary/transient information
- Duplicate information

### How to Write Good Memories

```
✅ GOOD: "API uses JWT tokens in Authorization header. Format: Bearer {token}.
         Tokens expire after 1 hour. Refresh endpoint: POST /auth/refresh"

❌ BAD:  "Uses tokens for auth"
```

```
✅ GOOD: "Chose PostgreSQL over MongoDB because we need ACID compliance
         for financial transactions. Team has PostgreSQL experience."

❌ BAD:  "Using PostgreSQL"
```

```
✅ GOOD: "GOTCHA: Must run npm install in /packages/shared before building
         the main app. Otherwise you get 'module not found' errors."

❌ BAD:  "Install dependencies first"
```

## Session Start Routine

At the beginning of each session, I should:

1. **Call `get_context`** to load project-relevant memories
2. **Call `recall` with `category: "preference"`** to get user preferences
3. **Call `recall` with `category: "task"`** to check ongoing work

This ensures continuity across sessions and awareness of project context.

## Storage

Memories stored in:
- **OneDrive**: `{OneDrive}/Apps/ClaudeMemory/`
- **Custom**: User-specified path (used directly)

Files are human-readable markdown with YAML frontmatter. Syncs automatically via OneDrive client.

## Project Scoping

Memories are automatically scoped to the current git repository:
- Detects git remote URL
- Normalizes to canonical form (e.g., `github.com/user/repo`)
- Stores as `projectId` in memory
- Search prioritizes current project
- Use `global: true` for cross-project memories

## Priority System

- **high** - Critical information, boosted in search
- **normal** - Default priority
- **low** - Less important, deprioritized in search

Priority affects search ranking and recall order.

## Examples

### Store Project Information
```
Tool: remember
  category: "project"
  content: "React TypeScript app with Vite. Components in /src/components, API calls in /src/api. Uses React Query for data fetching."
  tags: ["react", "typescript", "vite"]
```

### Store a Decision
```
Tool: remember
  category: "decision"
  content: "Using Zustand for state management instead of Redux. It's simpler, has less boilerplate, and the team is already familiar with it from the mobile app."
  tags: ["architecture", "state-management"]
  priority: "high"
```

### Store User Preference
```
Tool: remember
  category: "preference"
  content: "User prefers functional components with hooks. Avoid class components. Use named exports over default exports. 2-space indentation."
  global: true
```

### Get Smart Context
```
Tool: get_context
  limit: 5
  verbose: true
```

### Search for Specific Topic
```
Tool: recall
  query: "authentication"
  category: "decision"
  limit: 5
```

### Link Related Memories
```
Tool: link_memories
  id1: "abc123"
  id2: "def456"
  operation: "link"
```
