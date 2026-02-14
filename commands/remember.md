# /remember

Store a new memory with automatic project scoping.

## Usage

```
/remember <category> <content>
```

## Categories

- `project` - Codebase structure, architecture, key files
- `decision` - Architectural choices with rationale
- `preference` - Coding style, naming conventions
- `learning` - Gotchas, discoveries, special handling
- `task` - Current work, next steps, blockers

## Examples

```
/remember project "This is a React TypeScript app with Vite"
/remember decision "Using Zustand for state - simpler than Redux"
/remember preference "User prefers functional components with hooks"
```

## Implementation

Calls the MCP tool `remember` with the provided category and content. Automatically scopes to current git project.
