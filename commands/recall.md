# /recall

Search and retrieve memories with intelligent ranking.

## Usage

```
/recall [query]
```

## Examples

```
/recall                    # Get recent project memories
/recall authentication     # Search for auth-related memories
/recall database           # Find database-related context
```

## Implementation

Calls the MCP tool `recall` with optional query. Returns memories ranked by relevance, priority, and recency. Automatically filters to current project unless specified otherwise.

## Notes

- Uses TF-IDF scoring for text relevance
- Boosts high-priority memories
- Prefers current project memories
- Searches title, content, and tags
