#!/usr/bin/env node

import { createMemory, deleteMemory, listMemories } from './memory.js';
import {
  searchMemories,
  recallByCategory,
  recallRecent,
  formatMemoriesForDisplay,
  formatIndexForDisplay,
} from './search.js';
import {
  findOneDriveFolder,
  findAllOneDriveFolders,
  getStorageFolder,
  setOneDriveFolder,
  clearOneDrivePreference,
  needsOneDriveSelection,
} from './storage.js';
import type { Config, MemoryCategory, CommandResult } from './types.js';

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

  try {
    const memory = await createMemory(config, category, content, tags);
    return {
      success: true,
      message: `Memory stored successfully!\nID: ${memory.id}\nCategory: ${memory.category}\nTitle: ${memory.title}`,
      data: memory,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to store memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  try {
    let memories;

    if (!query && !category) {
      // No query, return recent memories
      memories = await recallRecent(config, limit);
    } else if (category && !query) {
      // Category only, return all in category
      memories = await recallByCategory(config, category as MemoryCategory, limit);
    } else {
      // Search with query
      const results = await searchMemories(config, query, {
        category: category as MemoryCategory,
        limit,
        includeFullContent: true,
      });
      memories = results.map((r) => r.memory).filter((m): m is NonNullable<typeof m> => m != null);
    }

    if (memories.length === 0) {
      return {
        success: true,
        message: 'No memories found matching your query.',
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
  _flags: Record<string, string | boolean>
): Promise<CommandResult> {
  const category = args[0] as MemoryCategory | undefined;

  try {
    const entries = await listMemories(config, category);

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

function handleStatus(config: Config): CommandResult {
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

  try {
    // Create .claude directory if needed
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }

    // Check if CLAUDE.md exists and already has our instructions
    let existingContent = '';
    if (existsSync(claudeMdPath)) {
      existingContent = readFileSync(claudeMdPath, 'utf-8');
      if (existingContent.includes('odsp-memory')) {
        return {
          success: true,
          message: `Claude is already configured!\n\nOneDrive folder: ${oneDriveFolder}\nClaude config: ${claudeMdPath}\n\nTest it with: odsp-memory remember project "Test memory"`,
        };
      }
    }

    // Append our instructions
    const newContent = existingContent
      ? existingContent.trimEnd() + '\n\n' + CLAUDE_INSTRUCTIONS
      : CLAUDE_INSTRUCTIONS;

    writeFileSync(claudeMdPath, newContent, 'utf-8');

    return {
      success: true,
      message: `Setup complete!\n\nOneDrive folder: ${oneDriveFolder}\nClaude config: ${claudeMdPath}\n\nClaude Code now knows about the memory skill.\nTest it by asking Claude to "remember that this is a test project".`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to configure Claude: ${error instanceof Error ? error.message : 'Unknown error'}\n\nYou can manually add these instructions to ${claudeMdPath}:\n\n${CLAUDE_INSTRUCTIONS}`,
    };
  }
}

function handleHelp(): CommandResult {
  const help = `
OneDrive Memory Skill for Claude Code

Uses local OneDrive folder for storage - syncs automatically via OneDrive client.

COMMANDS:
  remember <category> <content>   Store a new memory
    --tags=tag1,tag2              Add tags to the memory

  recall [query]                  Search and retrieve memories
    --category=<category>         Filter by category
    --limit=<number>              Limit results (default: 10)

  forget <id>                     Delete a memory by ID (supports partial IDs)

  list [category]                 List all memories, optionally filtered

  status                          Show OneDrive folder location

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

EXAMPLES:
  remember project "The API uses Express with TypeScript, routes in /src/routes"
  remember decision "Chose PostgreSQL over MongoDB for ACID compliance" --tags=database,architecture
  recall database
  recall --category=project
  list
  list decision
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
    const result = handleStatus(config);
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
    case 'recall':
      result = await handleRecall(config, args, flags);
      break;
    case 'forget':
      result = await handleForget(config, args);
      break;
    case 'list':
      result = await handleList(config, args, flags);
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
