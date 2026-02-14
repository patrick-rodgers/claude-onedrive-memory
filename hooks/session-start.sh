#!/bin/bash
# SessionStart hook - Auto-recall project context
#
# This hook runs when a new Claude Code session starts.
# It instructs Claude to automatically fetch relevant project context.

echo "🧠 Session started - loading project memory context..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 INSTRUCTION FOR CLAUDE:"
echo ""
echo "Please proactively call the 'get_context' MCP tool now to load"
echo "relevant memories for this project. Use limit: 5 and verbose: false."
echo ""
echo "After loading context, briefly summarize what you recalled."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Available memory commands:"
echo "  • /remember - Store new information"
echo "  • /recall - Search memories"
echo "  • /memory-status - Check system status"
