#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  createMemory,
  deleteMemory,
  listMemories,
  updateMemory,
  getMemory,
  linkMemories,
  unlinkMemories,
  getRelatedMemories,
  mergeMemories,
} from "./memory.js";
import {
  searchMemories,
  recallByCategory,
  recallRecent,
  formatMemoriesForDisplay,
  formatIndexForDisplay,
  isExpired,
} from "./search.js";
import {
  findOneDriveFolder,
  findAllOneDriveFolders,
  getStorageFolder,
  setOneDriveFolder,
  clearOneDrivePreference,
} from "./storage.js";
import { detectProjectContext } from "./project.js";
import {
  detectFilePatterns,
  getTagsFromPatterns,
  detectProjectChange,
} from "./triggers.js";
import {
  getMemoryStatistics,
  formatStats,
  generateRelationshipGraph,
  exportToJSON,
  exportToMarkdown,
} from "./analytics.js";
import {
  batchAddTag,
  batchRemoveTag,
  bulkDelete,
  formatBatchResult,
} from "./batch.js";
import type { Config, MemoryCategory, MemoryPriority } from "./types.js";
import type { ProjectFilterOptions } from "./search.js";

function loadConfig(): Config {
  return {};
}

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const server = new McpServer({
  name: "odsp-memory",
  version: pkg.version,
});

// --- memory_remember ---
server.tool(
  "memory_remember",
  "Store a new memory. Memories are automatically scoped to the current git project unless global is set.",
  {
    category: z.string().describe("Memory category: project, decision, preference, learning, task, or custom"),
    content: z.string().describe("The memory content to store"),
    tags: z.array(z.string()).optional().describe("Tags for the memory"),
    global: z.boolean().optional().describe("If true, memory is not scoped to any project"),
    priority: z.enum(["high", "normal", "low"]).optional().describe("Memory importance level"),
    ttl: z.string().optional().describe("Time-to-live (e.g., 7d, 2w, 1m, 1y)"),
  },
  async ({ category, content, tags, global: isGlobal, priority, ttl }) => {
    const config = loadConfig();
    try {
      if (ttl && !/^\d+[dDwWmMyY]$/.test(ttl)) {
        return errorResult("Invalid TTL format. Use: <number><unit> (e.g., 7d, 2w, 1m, 1y)");
      }

      const memory = await createMemory(config, category as MemoryCategory, content, tags ?? [], {
        global: isGlobal,
        priority: priority as MemoryPriority | undefined,
        ttl,
      });

      const scopeInfo = memory.projectName ? `Project: ${memory.projectName}` : "Scope: global";
      const priorityInfo = memory.priority && memory.priority !== "normal" ? `\nPriority: ${memory.priority}` : "";
      const expiresInfo = memory.expiresAt ? `\nExpires: ${new Date(memory.expiresAt).toLocaleDateString()}` : "";

      return text(
        `Memory stored successfully!\nID: ${memory.id}\nCategory: ${memory.category}\nTitle: ${memory.title}\n${scopeInfo}${priorityInfo}${expiresInfo}`
      );
    } catch (error) {
      return errorResult(`Failed to store memory: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_recall ---
server.tool(
  "memory_recall",
  "Search and retrieve stored memories. Returns recent memories if no query is provided.",
  {
    query: z.string().optional().describe("Search query text"),
    category: z.string().optional().describe("Filter by category"),
    limit: z.number().optional().describe("Maximum results to return (default: 10)"),
    all: z.boolean().optional().describe("Show all memories regardless of project"),
    global: z.boolean().optional().describe("Show only global memories"),
  },
  async ({ query, category, limit = 10, all: allProjects, global: globalOnly }) => {
    const config = loadConfig();
    try {
      const projectOptions: ProjectFilterOptions = {
        allProjects: allProjects || globalOnly,
        includeGlobal: true,
      };

      let memories;
      if (!query && !category) {
        memories = await recallRecent(config, limit, projectOptions);
      } else if (category && !query) {
        memories = await recallByCategory(config, category as MemoryCategory, limit, projectOptions);
      } else {
        const results = await searchMemories(config, query || "", {
          category: category as MemoryCategory,
          limit,
          includeFullContent: true,
          ...projectOptions,
        });
        memories = results.map((r) => r.memory).filter((m): m is NonNullable<typeof m> => m != null);
      }

      if (globalOnly) {
        memories = memories.filter((m) => !m.projectId);
      }

      if (memories.length === 0) {
        const context = await detectProjectContext();
        const scopeHint = allProjects
          ? ""
          : context.projectName
            ? `\nSearched in project: ${context.projectName} (use all=true for all projects)`
            : "\nNo project context detected (showing global memories only)";
        return text(`No memories found matching your query.${scopeHint}`);
      }

      return text(formatMemoriesForDisplay(memories));
    } catch (error) {
      return errorResult(`Failed to recall memories: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_list ---
server.tool(
  "memory_list",
  "List all stored memories, optionally filtered by category or project.",
  {
    category: z.string().optional().describe("Filter by category"),
    project: z.boolean().optional().describe("Show only current project's memories"),
  },
  async ({ category, project: projectOnly }) => {
    const config = loadConfig();
    try {
      let entries = await listMemories(config, category as MemoryCategory | undefined);

      if (projectOnly) {
        const context = await detectProjectContext();
        if (context.projectId) {
          entries = entries.filter((e) => e.projectId === context.projectId);
        } else {
          entries = entries.filter((e) => !e.projectId);
        }
      }

      return text(formatIndexForDisplay(entries));
    } catch (error) {
      return errorResult(`Failed to list memories: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_forget ---
server.tool(
  "memory_forget",
  "Delete a memory by ID (supports partial ID matching).",
  {
    id: z.string().describe("Full or partial memory ID"),
  },
  async ({ id }) => {
    const config = loadConfig();
    try {
      const entries = await listMemories(config);
      const match = entries.find((e) => e.id === id || e.id.startsWith(id));

      if (!match) {
        return errorResult(`No memory found with ID starting with "${id}"`);
      }

      const deleted = await deleteMemory(config, match.id);
      if (deleted) {
        return text(`Memory "${match.title}" has been forgotten.`);
      } else {
        return errorResult(`Failed to delete memory with ID "${match.id}"`);
      }
    } catch (error) {
      return errorResult(`Failed to forget memory: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_update ---
server.tool(
  "memory_update",
  "Update an existing memory's content or tags.",
  {
    id: z.string().describe("Full or partial memory ID"),
    content: z.string().optional().describe("New content for the memory"),
    tags: z.array(z.string()).optional().describe("New tags for the memory"),
  },
  async ({ id, content, tags }) => {
    const config = loadConfig();

    if (!content && !tags) {
      return errorResult("Please provide content or tags to update.");
    }

    try {
      const entries = await listMemories(config);
      const match = entries.find((e) => e.id === id || e.id.startsWith(id));

      if (!match) {
        return errorResult(`No memory found with ID starting with "${id}"`);
      }

      const updates: { content?: string; tags?: string[] } = {};
      if (content) updates.content = content;
      if (tags) updates.tags = tags;

      const memory = await updateMemory(config, match.id, updates);
      if (!memory) {
        return errorResult(`Failed to update memory with ID "${match.id}"`);
      }

      return text(
        `Memory updated successfully!\nID: ${memory.id}\nTitle: ${memory.title}\nTags: ${memory.tags.join(", ") || "(none)"}`
      );
    } catch (error) {
      return errorResult(`Failed to update memory: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_context ---
server.tool(
  "memory_context",
  "Smart recall based on current project context and detected file patterns. Great for session start.",
  {
    limit: z.number().optional().describe("Maximum memories to return (default: 5)"),
    verbose: z.boolean().optional().describe("Include detected file pattern details"),
  },
  async ({ limit = 5, verbose }) => {
    const config = loadConfig();
    try {
      const { changed, previous, current } = await detectProjectChange();
      const matchedPatterns = detectFilePatterns();
      const patternTags = getTagsFromPatterns(matchedPatterns);

      const lines: string[] = [];

      if (current.projectName) {
        if (changed && previous?.projectName) {
          lines.push(`Project changed: ${previous.projectName} -> ${current.projectName}`);
        } else if (changed) {
          lines.push(`Project: ${current.projectName}`);
        } else {
          lines.push(`Project: ${current.projectName} (unchanged)`);
        }
      } else {
        lines.push("Project: (none detected)");
      }

      if (verbose && matchedPatterns.length > 0) {
        lines.push("\nDetected file patterns:");
        for (const pattern of matchedPatterns) {
          lines.push(`  - ${pattern.description} (tags: ${pattern.tags.join(", ")})`);
        }
      }

      lines.push("");

      let memories: Awaited<ReturnType<typeof recallRecent>> = [];

      if (patternTags.length > 0) {
        const results = await searchMemories(config, patternTags.join(" "), {
          limit,
          includeFullContent: true,
          tags: patternTags,
        });
        memories = results.map((r) => r.memory).filter((m): m is NonNullable<typeof m> => m != null);
      }

      if (memories.length < limit) {
        const recentMemories = await recallRecent(config, limit - memories.length);
        const existingIds = new Set(memories.map((m) => m.id));
        for (const m of recentMemories) {
          if (!existingIds.has(m.id)) {
            memories.push(m);
          }
        }
      }

      if (memories.length === 0) {
        lines.push("No relevant memories found for this context.");
      } else {
        lines.push(formatMemoriesForDisplay(memories));
      }

      return text(lines.join("\n"));
    } catch (error) {
      return errorResult(`Failed to get context: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_link ---
server.tool(
  "memory_link",
  "Create or remove a bidirectional link between two memories.",
  {
    id1: z.string().describe("First memory ID (full or partial)"),
    id2: z.string().describe("Second memory ID (full or partial)"),
    unlink: z.boolean().optional().describe("If true, remove the link instead of creating it"),
  },
  async ({ id1, id2, unlink }) => {
    const config = loadConfig();
    try {
      const entries = await listMemories(config);
      const match1 = entries.find((e) => e.id === id1 || e.id.startsWith(id1));
      const match2 = entries.find((e) => e.id === id2 || e.id.startsWith(id2));

      if (!match1) return errorResult(`No memory found with ID starting with "${id1}"`);
      if (!match2) return errorResult(`No memory found with ID starting with "${id2}"`);

      if (unlink) {
        const success = await unlinkMemories(config, match1.id, match2.id);
        if (success) {
          return text(`Unlinked:\n  "${match1.title}"\n  "${match2.title}"`);
        }
        return errorResult("Failed to unlink memories");
      }

      const { memory1, memory2 } = await linkMemories(config, match1.id, match2.id);
      if (memory1 && memory2) {
        return text(`Linked:\n  "${memory1.title}"\n  "${memory2.title}"\n\nThese memories will now reference each other.`);
      }
      return errorResult("Failed to link memories");
    } catch (error) {
      return errorResult(`Failed to ${unlink ? "unlink" : "link"} memories: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_related ---
server.tool(
  "memory_related",
  "Show all memories related to a given memory.",
  {
    id: z.string().describe("Memory ID (full or partial)"),
  },
  async ({ id }) => {
    const config = loadConfig();
    try {
      const entries = await listMemories(config);
      const match = entries.find((e) => e.id === id || e.id.startsWith(id));

      if (!match) return errorResult(`No memory found with ID starting with "${id}"`);

      const related = await getRelatedMemories(config, match.id);
      const sourceMemory = await getMemory(config, match.id);

      if (!sourceMemory) return errorResult("Failed to load memory");

      let message = `## ${sourceMemory.title}\n\n`;
      if (related.length === 0) {
        message += "No related memories found.\n\nUse memory_link to create relationships.";
      } else {
        message += `**Related memories (${related.length}):**\n\n`;
        message += formatMemoriesForDisplay(related);
      }

      return text(message);
    } catch (error) {
      return errorResult(`Failed to get related memories: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_merge ---
server.tool(
  "memory_merge",
  "Merge multiple memories into one. The first memory becomes the base.",
  {
    ids: z.array(z.string()).min(2).describe("Array of memory IDs to merge (first is base)"),
    title: z.string().optional().describe("Custom title for the merged memory"),
  },
  async ({ ids, title }) => {
    const config = loadConfig();
    try {
      const entries = await listMemories(config);
      const matchedIds: string[] = [];

      for (const id of ids) {
        const match = entries.find((e) => e.id === id || e.id.startsWith(id));
        if (!match) return errorResult(`No memory found with ID starting with "${id}"`);
        matchedIds.push(match.id);
      }

      const toMerge = await Promise.all(matchedIds.map((id) => getMemory(config, id)));
      const validMemories = toMerge.filter((m): m is NonNullable<typeof m> => m != null);

      if (validMemories.length < 2) {
        return errorResult("Need at least 2 valid memories to merge");
      }

      const merged = await mergeMemories(config, matchedIds, { newTitle: title });
      if (!merged) return errorResult("Failed to merge memories");

      const mergedTitles = validMemories.map((m) => `  - ${m.title}`).join("\n");
      return text(
        `Merged ${validMemories.length} memories into one:\n\nMerged:\n${mergedTitles}\n\nResult:\n  ID: ${merged.id}\n  Title: ${merged.title}\n  Tags: ${merged.tags.join(", ") || "(none)"}`
      );
    } catch (error) {
      return errorResult(`Failed to merge memories: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_cleanup ---
server.tool(
  "memory_cleanup",
  "Remove expired memories. Use dryRun to preview what would be deleted.",
  {
    dryRun: z.boolean().optional().describe("Preview without deleting"),
  },
  async ({ dryRun }) => {
    const config = loadConfig();
    try {
      const entries = await listMemories(config);
      const expiredEntries = entries.filter(isExpired);

      if (expiredEntries.length === 0) {
        return text("No expired memories found.");
      }

      if (dryRun) {
        const lines = ["Expired memories that would be deleted:", ""];
        for (const entry of expiredEntries) {
          lines.push(`- ${entry.title} (expired: ${entry.expiresAt})`);
        }
        lines.push("", `Total: ${expiredEntries.length} memories`);
        lines.push("", "Run without dryRun to delete these memories.");
        return text(lines.join("\n"));
      }

      let deleted = 0;
      for (const entry of expiredEntries) {
        const success = await deleteMemory(config, entry.id);
        if (success) deleted++;
      }

      return text(`Cleaned up ${deleted} expired memories.`);
    } catch (error) {
      return errorResult(`Failed to cleanup: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_stats ---
server.tool(
  "memory_stats",
  "Show comprehensive memory statistics and analytics.",
  {},
  async () => {
    const config = loadConfig();
    try {
      const stats = await getMemoryStatistics(config);
      return text(formatStats(stats));
    } catch (error) {
      return errorResult(`Failed to generate statistics: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_graph ---
server.tool(
  "memory_graph",
  "Visualize memory relationships as a mermaid diagram.",
  {
    id: z.string().optional().describe("Memory ID to start subgraph from (shows all if omitted)"),
    depth: z.number().optional().describe("Max relationship depth to show (default: 3)"),
  },
  async ({ id, depth = 3 }) => {
    const config = loadConfig();
    try {
      const graph = await generateRelationshipGraph(config, id, depth);
      return text(graph);
    } catch (error) {
      return errorResult(`Failed to generate graph: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_export ---
server.tool(
  "memory_export",
  "Export memories to JSON or markdown format.",
  {
    format: z.enum(["json", "markdown"]).optional().describe("Output format (default: json)"),
    category: z.string().optional().describe("Export only this category"),
  },
  async ({ format = "json", category }) => {
    const config = loadConfig();
    try {
      let content: string;
      if (format === "json") {
        content = await exportToJSON(config, category);
      } else {
        content = await exportToMarkdown(config, category);
      }
      return text(content);
    } catch (error) {
      return errorResult(`Failed to export: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_tag ---
server.tool(
  "memory_tag",
  "Add a tag to multiple memories matching a query or category.",
  {
    tag: z.string().describe("Tag to add"),
    query: z.string().optional().describe("Tag memories matching this search"),
    category: z.string().optional().describe("Tag all memories in this category"),
    dryRun: z.boolean().optional().describe("Preview without making changes"),
  },
  async ({ tag, query, category, dryRun }) => {
    const config = loadConfig();
    try {
      const result = await batchAddTag(config, tag, {
        query,
        category: category as MemoryCategory | undefined,
        dryRun,
      });
      return text(formatBatchResult(result, dryRun ? `Would tag with #${tag}` : `Tagged with #${tag}`));
    } catch (error) {
      return errorResult(`Failed to tag memories: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_untag ---
server.tool(
  "memory_untag",
  "Remove a tag from multiple memories matching a query or category.",
  {
    tag: z.string().describe("Tag to remove"),
    query: z.string().optional().describe("Untag memories matching this search"),
    category: z.string().optional().describe("Untag all memories in this category"),
    dryRun: z.boolean().optional().describe("Preview without making changes"),
  },
  async ({ tag, query, category, dryRun }) => {
    const config = loadConfig();
    try {
      const result = await batchRemoveTag(config, tag, {
        query,
        category: category as MemoryCategory | undefined,
        dryRun,
      });
      return text(formatBatchResult(result, dryRun ? `Would remove tag #${tag}` : `Removed tag #${tag}`));
    } catch (error) {
      return errorResult(`Failed to untag memories: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_bulk_delete ---
server.tool(
  "memory_bulk_delete",
  "Delete multiple memories at once using filters. Always use dryRun first!",
  {
    expired: z.boolean().optional().describe("Delete all expired memories"),
    stale: z.boolean().optional().describe("Delete memories >90 days old"),
    query: z.string().optional().describe("Delete memories matching this search"),
    category: z.string().optional().describe("Delete all in this category"),
    dryRun: z.boolean().optional().describe("Preview without deleting"),
  },
  async ({ expired, stale, query, category, dryRun }) => {
    const config = loadConfig();

    if (!expired && !stale && !query && !category) {
      return errorResult("Must specify at least one filter: expired, stale, query, or category");
    }

    try {
      const result = await bulkDelete(config, {
        category: category as MemoryCategory | undefined,
        expired,
        stale,
        query,
        dryRun,
      });
      return text(formatBatchResult(result, dryRun ? "Would delete" : "Deleted"));
    } catch (error) {
      return errorResult(`Failed to bulk delete: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

// --- memory_status ---
server.tool(
  "memory_status",
  "Show OneDrive detection status, storage folder, and current project context.",
  {},
  async () => {
    const config = loadConfig();
    const folders = findAllOneDriveFolders();
    const currentFolder = findOneDriveFolder();

    let message = "";

    if (folders.length === 0) {
      return errorResult("No OneDrive folders found.\nMake sure OneDrive is installed and syncing.");
    }

    if (folders.length === 1) {
      message = `OneDrive folder: ${currentFolder}`;
    } else {
      message = "Multiple OneDrive folders detected:\n";
      folders.forEach((folder, i) => {
        const isCurrent = folder === currentFolder;
        message += `  ${i + 1}. ${folder}${isCurrent ? " (selected)" : ""}\n`;
      });
      message += "\nTo change, use memory_config with action=set";
    }

    try {
      const storageFolder = getStorageFolder(config);
      message += `\nStorage folder: ${storageFolder}`;
    } catch {
      // Storage folder doesn't exist yet
    }

    const projectContext = await detectProjectContext();
    message += "\n";
    if (projectContext.projectId) {
      message += `\nCurrent project: ${projectContext.projectName || "unknown"}`;
      message += `\nProject ID: ${projectContext.projectId}`;
    } else {
      message += "\nCurrent project: (none detected - memories will be global)";
    }

    return text(message);
  }
);

// --- memory_config ---
server.tool(
  "memory_config",
  "Manage OneDrive folder configuration: list available folders, select one, or reset to auto-detection.",
  {
    action: z.enum(["list", "set", "reset"]).describe("Action: list, set, or reset"),
    index: z.number().optional().describe("Folder index to select (1-based, for 'set' action)"),
  },
  async ({ action, index }) => {
    const folders = findAllOneDriveFolders();

    if (action === "list") {
      if (folders.length === 0) {
        return errorResult("No OneDrive folders found.");
      }

      const currentFolder = findOneDriveFolder();
      let message = "Available OneDrive folders:\n";
      folders.forEach((folder, i) => {
        const isCurrent = folder === currentFolder;
        message += `  ${i + 1}. ${folder}${isCurrent ? " (selected)" : ""}\n`;
      });
      message += "\nTo select: use action=set with index=<number>";
      message += "\nTo reset:  use action=reset";
      return text(message);
    }

    if (action === "set") {
      if (index === undefined) {
        return errorResult('Usage: action=set, index=<number>\nUse action=list to see available folders.');
      }

      const folderIndex = index - 1;
      if (folderIndex < 0 || folderIndex >= folders.length) {
        return errorResult(`Invalid selection. Choose 1-${folders.length}.`);
      }

      const selectedFolder = folders[folderIndex];
      setOneDriveFolder(selectedFolder);
      return text(`OneDrive folder set to: ${selectedFolder}`);
    }

    if (action === "reset") {
      clearOneDrivePreference();
      const autoDetected = findOneDriveFolder();
      return text(`Preference cleared. Auto-detected folder: ${autoDetected || "none"}`);
    }

    return errorResult(`Unknown action: ${action}`);
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
