# /memory-status

Check OneDrive detection, system status, and storage information.

## Usage

```
/memory-status
```

## What It Shows

- OneDrive folder location (or custom path)
- Current project context (git repository)
- Number of memories stored
- Storage path being used
- Multiple OneDrive folder detection (if applicable)

## Implementation

Calls the MCP tool `status` to display system information and storage configuration.

## Notes

If multiple OneDrive folders are detected with no preference set, the command will show all options and prompt to use `configure_storage` tool to select one.
