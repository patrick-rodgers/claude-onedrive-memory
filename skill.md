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

## Commands

### Remember - Store a Memory
```bash
node dist/index.js remember <category> <content> [--tags=tag1,tag2]
```

Categories:
- `project` - Codebase structure, architecture, key files
- `decision` - Choices made and rationale
- `preference` - Coding style, conventions, formatting preferences
- `learning` - Gotchas, discoveries, important notes
- `task` - Ongoing work, next steps, blockers

Examples:
```bash
node dist/index.js remember project "This is a React TypeScript app. Main components in /src/components, API routes in /src/api"
node dist/index.js remember decision "Using Zustand for state management - simpler than Redux, team already familiar" --tags=architecture,state
node dist/index.js remember preference "User prefers functional components with hooks, no class components"
node dist/index.js remember learning "The auth middleware requires the token in x-auth-token header, not Authorization"
```

### Recall - Retrieve Memories
```bash
node dist/index.js recall [query] [--category=<category>] [--limit=<number>]
```

Examples:
```bash
node dist/index.js recall                           # Recent memories
node dist/index.js recall --category=project        # All project context
node dist/index.js recall authentication            # Search for auth-related
node dist/index.js recall database --category=decision  # Database decisions
```

### List - See All Memories
```bash
node dist/index.js list [category]
```

Examples:
```bash
node dist/index.js list                  # All memories grouped by category
node dist/index.js list decision         # Just decisions
```

### Forget - Remove a Memory
```bash
node dist/index.js forget <id>
```

The ID can be partial (first 8 characters is usually enough).

### Status - Check OneDrive Detection
```bash
node dist/index.js status
```

### Config - Multiple OneDrive Accounts
If the user has multiple OneDrive accounts:
```bash
node dist/index.js config list      # List available folders
node dist/index.js config set 2     # Select folder #2
node dist/index.js config reset     # Reset to auto-detection
```

## Best Practices for Memory Content

1. **Be specific and actionable** - "API uses JWT tokens in Authorization header" not "uses tokens"
2. **Include the why** - "Chose PostgreSQL for ACID compliance in financial data"
3. **Reference file paths** - "Main entry point is /src/index.ts, routes defined in /src/routes/"
4. **Note gotchas explicitly** - "GOTCHA: Must run npm install in /packages/shared first"
5. **Update outdated memories** - If something changes, forget the old memory and create a new one

## Session Start Routine

At the beginning of a session with a returning user, consider:
```bash
node dist/index.js recall --category=project --limit=5
node dist/index.js recall --category=preference
node dist/index.js recall --category=task --limit=3
```

This gives you project context, user preferences, and any ongoing tasks.

## Storage Location

Memories are stored in the user's OneDrive folder at:
```
OneDrive/Apps/ClaudeMemory/
```

Files are human-readable markdown and sync automatically across devices.
