#!/usr/bin/env bash
cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "OneDrive Memory plugin is active. Use the memory_context tool to recall up to 5 relevant memories for the current project. If no memories exist or OneDrive is not configured, proceed normally."
  }
}
EOF
exit 0
