#!/usr/bin/env node

import { createMemory, deleteMemory, listMemories, updateMemory, getMemory, linkMemories, unlinkMemories, getRelatedMemories, mergeMemories } from './memory.js';
import {
  searchMemories,
  recallByCategory,
  recallRecent,
  formatMemoriesForDisplay,
  formatIndexForDisplay,
  isExpired,
} from './search.js';
import {
  findOneDriveFolder,
  findAllOneDriveFolders,
  getStorageFolder,
  setOneDriveFolder,
  clearOneDrivePreference,
  needsOneDriveSelection,
} from './storage.js';
import { detectProjectContext } from './project.js';
import {
  detectFilePatterns,
  getTagsFromPatterns,
  detectProjectChange,
} from './triggers.js';
import type { Config, MemoryCategory, MemoryPriority, CommandResult } from './types.js';
import type { ProjectFilterOptions } from './search.js';

// Load configuration (minimal - just need an empty config object for now)
function loadConfig(): Config {
  return {};
}

// Parse command line arguments
function parseArgs(args: string[]): {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
} {
  const command = args[0] || 'help';
  const restArgs: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value ?? true;
    } else if (arg.startsWith('-')) {
      flags[arg.slice(1)] = true;
    } else {
      restArgs.push(arg);
    }
  }

  return { command, args: restArgs, flags };
}

// Command handlers
async function handleRemember(
  config: Config,
  args: string[],
  flags: Record<string, string | boolean>
): Promise<CommandResult> {
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: remember <category> <content>\nExample: remember project "This codebase uses React with TypeScript"',
    };
  }

  const category = args[0] as MemoryCategory;
  const content = args.slice(1).join(' ');
  const tags = typeof flags.tags === 'string' ? flags.tags.split(',').map((t) => t.trim()) : [];
  const isGlobal = flags.global === true;
  const priority = typeof flags.priority === 'string'
    ? (flags.priority as MemoryPriority)
    : undefined;
  const ttl = typeof flags.ttl === 'string' ? flags.ttl : undefined;

  // Validate priority if provided
  if (priority && !['high', 'normal', 'low'].includes(priority)) {
    return {
      success: false,
      message: 'Invalid priority. Use: high, normal, or low',
    };
  }

  // Validate TTL format if provided
  if (ttl && !/^\d+[dDwWmMyY]$/.test(ttl)) {
    return {
      success: false,
      message: 'Invalid TTL format. Use: <number><unit> (e.g., 7d, 2w, 1m, 1y)',
    };
  }

  try {
    const memory = await createMemory(config, category, content, tags, { global: isGlobal, priority, ttl });
    const scopeInfo = memory.projectName
      ? `Project: ${memory.projectName}`
      : 'Scope: global';
    const priorityInfo = memory.priority && memory.priority !== 'normal'
      ? `\nPriority: ${memory.priority}`
      : '';
    const expiresInfo = memory.expiresAt
      ? `\nExpires: ${new Date(memory.expiresAt).toLocaleDateString()}`
      : '';
    return {
      success: true,
      message: `Memory stored successfully!\nID: ${memory.id}\nCategory: ${memory.category}\nTitle: ${memory.title}\n${scopeInfo}${priorityInfo}${expiresInfo}`,
      data: memory,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to store memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function handleUpdate(
  config: Config,
  args: string[],
  flags: Record<string, string | boolean>
): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: 'Usage: update <id> <new-content>\n       update <id> --tags=tag1,tag2\n\nExample: update abc123 "Updated content here"',
    };
  }

  const id = args[0];
  const contentArgs = args.slice(1).join(' ');
  const newContent = contentArgs.length > 0 ? contentArgs : undefined;
  const tags = typeof flags.tags === 'string' ? flags.tags.split(',').map((t) => t.trim()) : undefined;

  // Must provide either content or tags
  if (!newContent && !tags) {
    return {
      success: false,
      message: 'Please provide new content or --tags to update.',
    };
  }

  try {
    // First find the memory (support partial ID)
    const entries = await listMemories(config);
    const match = entries.find((e) => e.id === id || e.id.startsWith(id));

    if (!match) {
      return {
        success: false,
        message: `No memory found with ID starting with "${id}"`,
      };
    }

    const updates: { content?: string; tags?: string[] } = {};
    if (newContent) updates.content = newContent;
    if (tags) updates.tags = tags;

    const memory = await updateMemory(config, match.id, updates);

    if (!memory) {
      return {
        success: false,
        message: `Failed to update memory with ID "${match.id}"`,
      };
    }

    return {
      success: true,
      message: `Memory updated successfully!\nID: ${memory.id}\nTitle: ${memory.title}\nTags: ${memory.tags.join(', ') || '(none)'}`,
      data: memory,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function handleRecall(
  config: Config,
  args: string[],
  flags: Record<string, string | boolean>
): Promise<CommandResult> {
  const query = args.join(' ');
  const category = typeof flags.category === 'string' ? flags.category : undefined;
  const limit = typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : 10;

  // Project filtering options
  const projectOptions: ProjectFilterOptions = {
    allProjects: flags.all === true,           // --all: show all memories
    includeGlobal: flags.global !== false,     // --global=false: exclude global
  };

  // If --global flag is set without =false, show only global memories
  if (flags.global === true) {
    projectOptions.allProjects = true;
    projectOptions.includeGlobal = true;
    // We'll filter to global-only below
  }

  try {
    let memories;

    if (!query && !category) {
      // No query, return recent memories
      memories = await recallRecent(config, limit, projectOptions);
    } else if (category && !query) {
      // Category only, return all in category
      memories = await recallByCategory(config, category as MemoryCategory, limit, projectOptions);
    } else {
      // Search with query
      const results = await searchMemories(config, query, {
        category: category as MemoryCategory,
        limit,
        includeFullContent: true,
        ...projectOptions,
      });
      memories = results.map((r) => r.memory).filter((m): m is NonNullable<typeof m> => m != null);
    }

    // If --global flag is set (not --global=false), filter to only global memories
    if (flags.global === true) {
      memories = memories.filter(m => !m.projectId);
    }

    if (memories.length === 0) {
      const context = await detectProjectContext();
      const scopeHint = projectOptions.allProjects
        ? ''
        : context.projectName
          ? `\nSearched in project: ${context.projectName} (use --all for all projects)`
          : '\nNo project context detected (showing global memories only)';
      return {
        success: true,
        message: `No memories found matching your query.${scopeHint}`,
        data: [],
      };
    }

    return {
      success: true,
      message: formatMemoriesForDisplay(memories),
      data: memories,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to recall memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function handleForget(config: Config, args: string[]): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: 'Usage: forget <memory-id>',
    };
  }

  const id = args[0];

  try {
    // First try to find the memory (support partial ID)
    const entries = await listMemories(config);
    const match = entries.find((e) => e.id === id || e.id.startsWith(id));

    if (!match) {
      return {
        success: false,
        message: `No memory found with ID starting with "${id}"`,
      };
    }

    const deleted = await deleteMemory(config, match.id);

    if (deleted) {
      return {
        success: true,
        message: `Memory "${match.title}" has been forgotten.`,
      };
    } else {
      return {
        success: false,
        message: `Failed to delete memory with ID "${match.id}"`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to forget memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function handleList(
  config: Config,
  args: string[],
  flags: Record<string, string | boolean>
): Promise<CommandResult> {
  const category = args[0] as MemoryCategory | undefined;
  const projectOnly = flags.project === true;

  try {
    let entries = await listMemories(config, category);

    // Filter by current project if --project flag is set
    if (projectOnly) {
      const context = await detectProjectContext();
      if (context.projectId) {
        entries = entries.filter(e => e.projectId === context.projectId);
      } else {
        // No project context - show only global
        entries = entries.filter(e => !e.projectId);
      }
    }

    return {
      success: true,
      message: formatIndexForDisplay(entries),
      data: entries,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function handleCleanup(
  config: Config,
  flags: Record<string, string | boolean>
): Promise<CommandResult> {
  const dryRun = flags['dry-run'] === true || flags.n === true;

  try {
    const entries = await listMemories(config);
    const expiredEntries = entries.filter(isExpired);

    if (expiredEntries.length === 0) {
      return {
        success: true,
        message: 'No expired memories found.',
      };
    }

    if (dryRun) {
      const lines = ['Expired memories that would be deleted:', ''];
      for (const entry of expiredEntries) {
        lines.push(`- ${entry.title} (expired: ${entry.expiresAt})`);
      }
      lines.push('', `Total: ${expiredEntries.length} memories`);
      lines.push('', 'Run without --dry-run to delete these memories.');
      return {
        success: true,
        message: lines.join('\n'),
      };
    }

    // Delete expired memories
    let deleted = 0;
    for (const entry of expiredEntries) {
      const success = await deleteMemory(config, entry.id);
      if (success) deleted++;
    }

    return {
      success: true,
      message: `Cleaned up ${deleted} expired memories.`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function handleLink(
  config: Config,
  args: string[],
  flags: Record<string, string | boolean>
): Promise<CommandResult> {
  const unlink = flags.unlink === true;

  if (args.length < 2) {
    return {
      success: false,
      message: unlink
        ? 'Usage: link --unlink <id1> <id2>\nRemove link between two memories'
        : 'Usage: link <id1> <id2>\nCreate bidirectional link between two memories',
    };
  }

  const id1 = args[0];
  const id2 = args[1];

  try {
    // Find memories (support partial IDs)
    const entries = await listMemories(config);
    const match1 = entries.find((e) => e.id === id1 || e.id.startsWith(id1));
    const match2 = entries.find((e) => e.id === id2 || e.id.startsWith(id2));

    if (!match1) {
      return {
        success: false,
        message: `No memory found with ID starting with "${id1}"`,
      };
    }
    if (!match2) {
      return {
        success: false,
        message: `No memory found with ID starting with "${id2}"`,
      };
    }

    if (unlink) {
      const success = await unlinkMemories(config, match1.id, match2.id);
      if (success) {
        return {
          success: true,
          message: `Unlinked:\n  "${match1.title}"\n  "${match2.title}"`,
        };
      } else {
        return {
          success: false,
          message: 'Failed to unlink memories',
        };
      }
    }

    const { memory1, memory2 } = await linkMemories(config, match1.id, match2.id);
    if (memory1 && memory2) {
      return {
        success: true,
        message: `Linked:\n  "${memory1.title}"\n  "${memory2.title}"\n\nThese memories will now reference each other.`,
      };
    } else {
      return {
        success: false,
        message: 'Failed to link memories',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to ${unlink ? 'unlink' : 'link'} memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function handleRelated(
  config: Config,
  args: string[]
): Promise<CommandResult> {
  if (args.length < 1) {
    return {
      success: false,
      message: 'Usage: related <id>\nShow memories related to a given memory',
    };
  }

  const id = args[0];

  try {
    // Find memory (support partial ID)
    const entries = await listMemories(config);
    const match = entries.find((e) => e.id === id || e.id.startsWith(id));

    if (!match) {
      return {
        success: false,
        message: `No memory found with ID starting with "${id}"`,
      };
    }

    const related = await getRelatedMemories(config, match.id);
    const sourceMemory = await getMemory(config, match.id);

    if (!sourceMemory) {
      return {
        success: false,
        message: 'Failed to load memory',
      };
    }

    let message = `## ${sourceMemory.title}\n\n`;

    if (related.length === 0) {
      message += 'No related memories found.\n\nUse `link <id1> <id2>` to create relationships.';
    } else {
      message += `**Related memories (${related.length}):**\n\n`;
      message += formatMemoriesForDisplay(related);
    }

    return {
      success: true,
      message,
      data: related,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get related memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function handleMerge(
  config: Config,
  args: string[],
  flags: Record<string, string | boolean>
): Promise<CommandResult> {
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: merge <id1> <id2> [id3...]\nMerge multiple memories into one (first becomes base)',
    };
  }

  const title = typeof flags.title === 'string' ? flags.title : undefined;

  try {
    // Find all memories (support partial IDs)
    const entries = await listMemories(config);
    const matchedIds: string[] = [];

    for (const id of args) {
      const match = entries.find((e) => e.id === id || e.id.startsWith(id));
      if (!match) {
        return {
          success: false,
          message: `No memory found with ID starting with "${id}"`,
        };
      }
      matchedIds.push(match.id);
    }

    // Show what will be merged
    const toMerge = await Promise.all(matchedIds.map(id => getMemory(config, id)));
    const validMemories = toMerge.filter((m): m is NonNullable<typeof m> => m != null);

    if (validMemories.length < 2) {
      return {
        success: false,
        message: 'Need at least 2 valid memories to merge',
      };
    }

    const merged = await mergeMemories(config, matchedIds, { newTitle: title });

    if (!merged) {
      return {
        success: false,
        message: 'Failed to merge memories',
      };
    }

    const mergedTitles = validMemories.map(m => `  - ${m.title}`).join('\n');

    return {
      success: true,
      message: `Merged ${validMemories.length} memories into one:\n\nMerged:\n${mergedTitles}\n\nResult:\n  ID: ${merged.id}\n  Title: ${merged.title}\n  Tags: ${merged.tags.join(', ') || '(none)'}`,
      data: merged,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to merge memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function handleStatus(config: Config): Promise<CommandResult> {
  const folders = findAllOneDriveFolders();
  const currentFolder = findOneDriveFolder();

  let message = '';

  if (folders.length === 0) {
    return {
      success: false,
      message: 'No OneDrive folders found.\nMake sure OneDrive is installed and syncing.',
    };
  }

  if (folders.length === 1) {
    message = `OneDrive folder: ${currentFolder}`;
  } else {
    message = `Multiple OneDrive folders detected:\n`;
    folders.forEach((folder, i) => {
      const isCurrent = folder === currentFolder;
      message += `  ${i + 1}. ${folder}${isCurrent ? ' (selected)' : ''}\n`;
    });
    message += `\nTo change, run: config set <number>`;
  }

  try {
    const storageFolder = getStorageFolder(config);
    message += `\nStorage folder: ${storageFolder}`;
  } catch {
    // Storage folder doesn't exist yet, that's fine
  }

  // Show current project context
  const projectContext = await detectProjectContext();
  message += '\n';
  if (projectContext.projectId) {
    message += `\nCurrent project: ${projectContext.projectName || 'unknown'}`;
    message += `\nProject ID: ${projectContext.projectId}`;
  } else {
    message += `\nCurrent project: (none detected - memories will be global)`;
  }

  return {
    success: true,
    message,
  };
}

function handleConfig(args: string[]): CommandResult {
  const subcommand = args[0];
  const folders = findAllOneDriveFolders();

  if (!subcommand || subcommand === 'list') {
    // List available OneDrive folders
    if (folders.length === 0) {
      return {
        success: false,
        message: 'No OneDrive folders found.',
      };
    }

    const currentFolder = findOneDriveFolder();
    let message = 'Available OneDrive folders:\n';
    folders.forEach((folder, i) => {
      const isCurrent = folder === currentFolder;
      message += `  ${i + 1}. ${folder}${isCurrent ? ' (selected)' : ''}\n`;
    });
    message += `\nTo select: config set <number>`;
    message += `\nTo reset:  config reset`;

    return { success: true, message };
  }

  if (subcommand === 'set') {
    const indexStr = args[1];
    if (!indexStr) {
      return {
        success: false,
        message: 'Usage: config set <number>\nRun "config list" to see available folders.',
      };
    }

    const index = parseInt(indexStr, 10) - 1;
    if (isNaN(index) || index < 0 || index >= folders.length) {
      return {
        success: false,
        message: `Invalid selection. Choose 1-${folders.length}.`,
      };
    }

    const selectedFolder = folders[index];
    setOneDriveFolder(selectedFolder);

    return {
      success: true,
      message: `OneDrive folder set to: ${selectedFolder}`,
    };
  }

  if (subcommand === 'reset') {
    clearOneDrivePreference();
    const autoDetected = findOneDriveFolder();
    return {
      success: true,
      message: `Preference cleared. Auto-detected folder: ${autoDetected || 'none'}`,
    };
  }

  return {
    success: false,
    message: `Unknown config command: ${subcommand}\nAvailable: list, set <number>, reset`,
  };
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CLAUDE_INSTRUCTIONS = `## Memory Skill

I have access to persistent memory via OneDrive. Use these commands in Bash:

- \`odsp-memory remember <category> <content>\` - Store a memory
- \`odsp-memory recall [query]\` - Search memories
- \`odsp-memory list [category]\` - List all memories
- \`odsp-memory forget <id>\` - Delete a memory

**Categories:** project, decision, preference, learning, task

**Best practices:**
- Proactively remember important context about projects, decisions, and user preferences
- At the start of sessions, recall relevant context: \`odsp-memory recall --category=project\`
- When users make decisions, store them: \`odsp-memory remember decision "Chose X because Y"\`
`;

function handleSetup(): CommandResult {
  // Check OneDrive first
  const oneDriveFolder = findOneDriveFolder();
  if (!oneDriveFolder) {
    return {
      success: false,
      message: 'Error: OneDrive folder not found.\nMake sure OneDrive is installed and syncing first.',
    };
  }

  // Find or create Claude config directory
  const claudeDir = join(homedir(), '.claude');
  const claudeMdPath = join(claudeDir, 'CLAUDE.md');
  const settingsPath = join(claudeDir, 'settings.json');

  try {
    // Create .claude directory if needed
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }

    let alreadyConfigured = false;

    // Configure CLAUDE.md with instructions
    let existingMdContent = '';
    if (existsSync(claudeMdPath)) {
      existingMdContent = readFileSync(claudeMdPath, 'utf-8');
      if (existingMdContent.includes('odsp-memory')) {
        alreadyConfigured = true;
      }
    }

    if (!alreadyConfigured) {
      const newMdContent = existingMdContent
        ? existingMdContent.trimEnd() + '\n\n' + CLAUDE_INSTRUCTIONS
        : CLAUDE_INSTRUCTIONS;
      writeFileSync(claudeMdPath, newMdContent, 'utf-8');
    }

    // Configure settings.json with hooks and permissions
    let settings: Record<string, unknown> = {};
    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      } catch {
        // If JSON is invalid, start fresh
        settings = {};
      }
    }

    // Add permission for odsp-memory commands
    if (!settings.permissions) {
      settings.permissions = { allow: [] };
    }
    const permissions = settings.permissions as { allow: string[] };
    if (!permissions.allow) {
      permissions.allow = [];
    }
    if (!permissions.allow.includes('Bash(odsp-memory:*)')) {
      permissions.allow.push('Bash(odsp-memory:*)');
    }

    // Add SessionStart hook for auto-recall
    if (!settings.hooks) {
      settings.hooks = {};
    }
    const hooks = settings.hooks as Record<string, unknown>;

    // Check if SessionStart hook already has odsp-memory
    const existingSessionStart = hooks.SessionStart as Array<{ hooks?: Array<{ command?: string }> }> | undefined;
    const hasMemoryHook = existingSessionStart?.some(h =>
      h.hooks?.some(hook => hook.command?.includes('odsp-memory'))
    );

    if (!hasMemoryHook) {
      hooks.SessionStart = [
        ...(existingSessionStart || []),
        {
          hooks: [
            {
              type: 'command',
              command: 'odsp-memory context --limit=5'
            }
          ]
        }
      ];
    }

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    if (alreadyConfigured) {
      return {
        success: true,
        message: `Claude is already configured!\n\nOneDrive folder: ${oneDriveFolder}\nClaude config: ${claudeMdPath}\nSettings: ${settingsPath}\n\nTest it with: odsp-memory remember project "Test memory"`,
      };
    }

    return {
      success: true,
      message: `Setup complete!\n\nOneDrive folder: ${oneDriveFolder}\nClaude config: ${claudeMdPath}\nSettings: ${settingsPath}\n\nClaude Code will now:\n- Auto-recall memories at session start\n- Use memory commands without prompts\n\nTest it by asking Claude to "remember that this is a test project".`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to configure Claude: ${error instanceof Error ? error.message : 'Unknown error'}\n\nYou can manually add these instructions to ${claudeMdPath}:\n\n${CLAUDE_INSTRUCTIONS}`,
    };
  }
}

async function handleContext(
  config: Config,
  flags: Record<string, string | boolean>
): Promise<CommandResult> {
  const limit = typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : 5;
  const verbose = flags.verbose === true || flags.v === true;

  try {
    // Detect project change
    const { changed, previous, current } = await detectProjectChange();

    // Detect file patterns in current directory
    const matchedPatterns = detectFilePatterns();
    const patternTags = getTagsFromPatterns(matchedPatterns);

    // Build context message
    const lines: string[] = [];

    // Project info
    if (current.projectName) {
      if (changed && previous?.projectName) {
        lines.push(`Project changed: ${previous.projectName} -> ${current.projectName}`);
      } else if (changed) {
        lines.push(`Project: ${current.projectName}`);
      } else {
        lines.push(`Project: ${current.projectName} (unchanged)`);
      }
    } else {
      lines.push('Project: (none detected)');
    }

    // Detected patterns (verbose mode)
    if (verbose && matchedPatterns.length > 0) {
      lines.push('\nDetected file patterns:');
      for (const pattern of matchedPatterns) {
        lines.push(`  - ${pattern.description} (tags: ${pattern.tags.join(', ')})`);
      }
    }

    lines.push('');

    // Recall memories based on context
    let memories: Awaited<ReturnType<typeof recallRecent>> = [];

    if (patternTags.length > 0) {
      // Search with detected tags
      const results = await searchMemories(config, patternTags.join(' '), {
        limit,
        includeFullContent: true,
        tags: patternTags,
      });
      memories = results.map((r) => r.memory).filter((m): m is NonNullable<typeof m> => m != null);
    }

    // If no pattern-based results or not enough, supplement with recent project memories
    if (memories.length < limit) {
      const recentMemories = await recallRecent(config, limit - memories.length);
      // Avoid duplicates
      const existingIds = new Set(memories.map(m => m.id));
      for (const m of recentMemories) {
        if (!existingIds.has(m.id)) {
          memories.push(m);
        }
      }
    }

    if (memories.length === 0) {
      lines.push('No relevant memories found for this context.');
    } else {
      lines.push(formatMemoriesForDisplay(memories));
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: memories,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get context: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

function handleHelp(): CommandResult {
  const help = `
OneDrive Memory Skill for Claude Code

Uses local OneDrive folder for storage - syncs automatically via OneDrive client.

COMMANDS:
  remember <category> <content>   Store a new memory (auto-scoped to current project)
    --tags=tag1,tag2              Add tags to the memory
    --global                      Create a global memory (not project-scoped)
    --priority=high|normal|low    Set memory importance (default: normal)
    --ttl=<duration>              Auto-expire after duration (e.g., 7d, 2w, 1m, 1y)

  update <id> <new-content>       Update an existing memory's content
    --tags=tag1,tag2              Update tags (can be used alone or with content)

  recall [query]                  Search and retrieve memories
    --category=<category>         Filter by category
    --limit=<number>              Limit results (default: 10)
    --all                         Show all memories (ignore project filter)
    --global                      Show only global memories

  context                         Smart recall based on current project and file patterns
    --limit=<number>              Limit results (default: 5)
    --verbose, -v                 Show detected file patterns

  forget <id>                     Delete a memory by ID (supports partial IDs)

  list [category]                 List all memories, optionally filtered
    --project                     Show only current project's memories

  cleanup                         Remove expired memories
    --dry-run, -n                 Show what would be deleted without deleting

  link <id1> <id2>                Create bidirectional link between two memories
    --unlink                      Remove an existing link instead

  related <id>                    Show all memories related to a given memory

  merge <id1> <id2> [id3...]      Combine multiple memories into one
    --title="New title"           Set a custom title for the merged memory

  status                          Show OneDrive folder and current project

  config list                     List available OneDrive folders
  config set <number>             Select which OneDrive folder to use
  config reset                    Reset to auto-detection

  setup                           Configure Claude Code to use this skill

  help                            Show this help message

CATEGORIES:
  project     Codebase structure, architecture, key files
  decision    Choices made and rationale
  preference  User's coding style, conventions
  learning    Gotchas, discoveries, things to remember
  task        Ongoing work, next steps, blockers
  (custom)    Any other category name you want

PROJECT SCOPING:
  Memories are automatically scoped to the current git repository.
  - When you 'remember', the memory is linked to the current project
  - When you 'recall', only current project + global memories are shown
  - Use --global flag to create/view global memories across all projects
  - Use --all flag to see all memories regardless of project

PRIORITY:
  Use --priority to mark memory importance:
  - high:   Always surfaces in recall, even with low match scores
  - normal: Default - ranked by relevance (default)
  - low:    Only shows with specific searches, deprioritized in recall

EXPIRATION (TTL):
  Use --ttl to auto-expire temporary memories:
  - 7d:  Expires in 7 days (good for task context)
  - 2w:  Expires in 2 weeks
  - 1m:  Expires in 1 month
  - 1y:  Expires in 1 year
  Expired memories are hidden from recall. Use 'cleanup' to delete them.
  Memories older than 90 days without TTL show a "stale" warning.

RELATIONSHIPS & CONSOLIDATION:
  Use 'link' to connect related memories:
  - Links are bidirectional (both memories reference each other)
  - Use 'related <id>' to see all connected memories
  - Great for connecting decisions to the projects they affect

  Use 'merge' to consolidate similar memories:
  - First memory becomes the base, others are appended and deleted
  - Tags and relationships from all memories are combined
  - Use --title to set a new title for the merged memory

EXAMPLES:
  remember project "The API uses Express with TypeScript, routes in /src/routes"
  remember decision "Chose PostgreSQL over MongoDB for ACID compliance" --tags=database,architecture
  remember preference "Always use 2-space indentation" --global
  remember learning "CRITICAL: Never delete production logs" --priority=high
  remember task "Working on user auth feature" --ttl=7d
  update abc123 "Updated content for this memory"
  update abc123 --tags=new-tag,updated
  recall database
  recall --category=project
  recall --all
  context --verbose
  list
  list decision
  list --project
  link abc123 def456
  related abc123
  merge abc123 def456 --title="Combined Notes"
  cleanup --dry-run
  forget abc123
`;

  return {
    success: true,
    message: help.trim(),
  };
}

// Check if user needs to select a OneDrive folder
function checkOneDriveSelection(): boolean {
  const { needsSelection, folders } = needsOneDriveSelection();

  if (needsSelection) {
    console.log('Multiple OneDrive folders detected:\n');
    folders.forEach((folder, i) => {
      console.log(`  ${i + 1}. ${folder}`);
    });
    console.log('\nPlease select one with: config set <number>');
    console.log('Or run: status to see current selection\n');
    return false;
  }

  return true;
}

// Main entry point
async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv.slice(2));

  // Help doesn't require OneDrive check
  if (command === 'help' || !command) {
    const result = handleHelp();
    console.log(result.message);
    process.exit(0);
  }

  // Config command handles its own OneDrive logic
  if (command === 'config') {
    const result = handleConfig(args);
    console.log(result.message);
    process.exit(result.success ? 0 : 1);
  }

  // Status command shows all folders
  if (command === 'status') {
    const config = loadConfig();
    const result = await handleStatus(config);
    console.log(result.message);
    process.exit(result.success ? 0 : 1);
  }

  // Setup command configures Claude Code
  if (command === 'setup') {
    const result = handleSetup();
    console.log(result.message);
    process.exit(result.success ? 0 : 1);
  }

  const config = loadConfig();

  // Check if OneDrive folder selection is needed
  if (!checkOneDriveSelection()) {
    process.exit(1);
  }

  // Check OneDrive is available
  const oneDriveFolder = findOneDriveFolder();
  if (!oneDriveFolder) {
    console.error(
      'Error: OneDrive folder not found.\n' +
      'Make sure OneDrive is installed and syncing.\n' +
      'Run "status" to check OneDrive detection.'
    );
    process.exit(1);
  }

  let result: CommandResult;

  switch (command) {
    case 'remember':
      result = await handleRemember(config, args, flags);
      break;
    case 'update':
      result = await handleUpdate(config, args, flags);
      break;
    case 'recall':
      result = await handleRecall(config, args, flags);
      break;
    case 'context':
      result = await handleContext(config, flags);
      break;
    case 'forget':
      result = await handleForget(config, args);
      break;
    case 'list':
      result = await handleList(config, args, flags);
      break;
    case 'cleanup':
      result = await handleCleanup(config, flags);
      break;
    case 'link':
      result = await handleLink(config, args, flags);
      break;
    case 'related':
      result = await handleRelated(config, args);
      break;
    case 'merge':
      result = await handleMerge(config, args, flags);
      break;
    default:
      result = {
        success: false,
        message: `Unknown command: ${command}\nRun 'help' to see available commands.`,
      };
      break;
  }

  console.log(result.message);
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
