#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  remember,
  recall,
  list,
  forget,
  update,
  context,
  cleanup,
  status,
  type RememberParams,
  type RecallParams,
  type ListParams,
  type ForgetParams,
  type UpdateParams,
  type ContextParams,
  type CleanupParams,
  type StatusParams,
} from './commands/index.js';

import {
  linkMemories,
  unlinkMemories,
  getRelatedMemories,
  mergeMemories,
  getMemory,
  listMemories,
} from './memory.js';

import {
  getMemoryStatistics,
  formatStats,
  generateRelationshipGraph,
  exportToJSON,
  exportToMarkdown,
} from './analytics.js';

import {
  batchAddTag,
  batchRemoveTag,
  bulkDelete,
  formatBatchResult,
} from './batch.js';

import { formatMemoriesForDisplay } from './search.js';
import { detectProjectContext } from './project.js';
import {
  findAllOneDriveFolders,
  findOneDriveFolder,
  setOneDriveFolder,
  clearOneDrivePreference,
  needsOneDriveSelection,
} from './storage.js';

import type { Config, MemoryCategory } from './types.js';

function loadConfig(): Config {
  return {};
}

const server = new Server(
  {
    name: 'claude-onedrive-memory',
    version: '0.2.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============================================================================
// Resources - Browse memories as resources
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const config = loadConfig();
  try {
    const entries = await listMemories(config);
    const projectContext = await detectProjectContext();

    // Group memories by category for better organization
    const categories = [...new Set(entries.map((e) => e.category))];

    const resources = [
      // All memories list
      {
        uri: 'memory://list',
        name: 'All Memories',
        description: `Complete list of ${entries.length} memories with metadata (JSON array). URI: memory://list`,
        mimeType: 'application/json',
      },
      // Current project memories
      ...(projectContext.projectId
        ? [
            {
              uri: `memory://project/${encodeURIComponent(projectContext.projectId)}`,
              name: `${projectContext.projectName || 'Current Project'} Memories`,
              description: `All memories scoped to this project (JSON array). URI pattern: memory://project/{project-id}`,
              mimeType: 'application/json',
            },
          ]
        : []),
      // Category resources
      ...categories.map((cat) => ({
        uri: `memory://category/${encodeURIComponent(cat)}`,
        name: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Memories`,
        description: `All ${cat} memories (JSON array). URI pattern: memory://category/{category-name}`,
        mimeType: 'application/json',
      })),
      // Individual memory resources
      ...entries.slice(0, 100).map((entry) => ({
        uri: `memory://${entry.id}`,
        name: entry.title,
        description: `${entry.category} memory | Tags: ${entry.tags.join(', ') || 'none'} | Created: ${new Date(entry.created).toLocaleDateString()} | URI: memory://{memory-id}`,
        mimeType: 'text/markdown',
      })),
    ];

    return { resources };
  } catch (error) {
    console.error('Error listing resources:', error);
    return { resources: [] };
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const config = loadConfig();
  const uri = request.params.uri;

  try {
    // Parse URI
    if (uri === 'memory://list') {
      // Return all memories as JSON
      const entries = await listMemories(config);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(entries, null, 2),
          },
        ],
      };
    } else if (uri.startsWith('memory://project/')) {
      // Return project memories
      const projectId = decodeURIComponent(uri.replace('memory://project/', ''));
      const entries = await listMemories(config);
      const projectMemories = entries.filter((e) => e.projectId === projectId);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(projectMemories, null, 2),
          },
        ],
      };
    } else if (uri.startsWith('memory://category/')) {
      // Return category memories
      const category = decodeURIComponent(uri.replace('memory://category/', ''));
      const entries = await listMemories(config, category as MemoryCategory);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(entries, null, 2),
          },
        ],
      };
    } else if (uri.startsWith('memory://')) {
      // Return specific memory
      const id = uri.replace('memory://', '');
      const memory = await getMemory(config, id);
      if (!memory) {
        throw new Error(`Memory not found: ${id}`);
      }
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: `# ${memory.title}\n\n**Category:** ${memory.category}\n**Tags:** ${memory.tags.join(', ') || 'none'}\n**Created:** ${new Date(memory.created).toLocaleString()}\n**Updated:** ${new Date(memory.updated).toLocaleString()}\n${memory.projectName ? `**Project:** ${memory.projectName}\n` : ''}${memory.priority && memory.priority !== 'normal' ? `**Priority:** ${memory.priority}\n` : ''}${memory.expiresAt ? `**Expires:** ${new Date(memory.expiresAt).toLocaleString()}\n` : ''}\n---\n\n${memory.content}`,
          },
        ],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to read resource: ${errorMessage}`);
  }
});

// ============================================================================
// Tools - Full memory operation toolkit
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ========== Core Memory Operations ==========
    {
      name: 'remember',
      description:
        'Store a memory in OneDrive. Memories are project-scoped by default (uses git repository detection) or can be marked as global. Categories: project, decision, preference, learning, task.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['project', 'decision', 'preference', 'learning', 'task'],
            description: 'Memory category',
          },
          content: {
            type: 'string',
            description: 'Memory content (markdown supported)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional tags for categorization',
          },
          global: {
            type: 'boolean',
            description: 'If true, memory is global (not project-scoped). Default: false',
            default: false,
          },
          priority: {
            type: 'string',
            enum: ['high', 'normal', 'low'],
            description: 'Memory priority for search ranking. Default: normal',
          },
          ttl: {
            type: 'string',
            description: 'Time-to-live (e.g., "7d", "30d", "1y"). Memory will auto-expire.',
          },
        },
        required: ['category', 'content'],
      },
    },
    {
      name: 'recall',
      description:
        'Search and retrieve memories. Automatically filters to current project unless global is specified. Uses intelligent scoring algorithm that considers content relevance, tags, category, and priority.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (searches title, content, tags)',
          },
          category: {
            type: 'string',
            enum: ['project', 'decision', 'preference', 'learning', 'task'],
            description: 'Filter by category',
          },
          global: {
            type: 'boolean',
            description: 'If true, search only global memories (not project-scoped)',
          },
          all: {
            type: 'boolean',
            description: 'If true, search all memories regardless of project',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results. Default: 10',
            default: 10,
          },
        },
      },
    },
    {
      name: 'list',
      description: 'List all memories, optionally filtered by category or project.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['project', 'decision', 'preference', 'learning', 'task'],
            description: 'Filter by category',
          },
          project: {
            type: 'string',
            description: 'Filter by project ID',
          },
          projectOnly: {
            type: 'boolean',
            description: 'If true, show only current project memories',
          },
        },
      },
    },
    {
      name: 'forget',
      description: 'Delete a memory by ID. Supports partial ID matching (e.g., first few characters).',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Memory ID (full or partial)',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'update',
      description: "Update an existing memory's content or tags.",
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Memory ID to update',
          },
          content: {
            type: 'string',
            description: 'New content (replaces existing)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'New tags (replaces existing)',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'get_context',
      description:
        'Get smart context for current project. Analyzes file patterns in the working directory and returns relevant memories based on detected technologies and patterns.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of memories to return. Default: 5',
            default: 5,
          },
          verbose: {
            type: 'boolean',
            description: 'If true, show detected file patterns in output',
          },
        },
      },
    },
    {
      name: 'cleanup',
      description: 'Remove expired memories based on TTL. Use dryRun to preview before deleting.',
      inputSchema: {
        type: 'object',
        properties: {
          dryRun: {
            type: 'boolean',
            description: 'If true, show what would be deleted without deleting',
            default: false,
          },
        },
      },
    },
    {
      name: 'status',
      description:
        'Check OneDrive detection and system status. Shows OneDrive folder location, current project context, and storage information. If multiple OneDrive folders are detected, will show options.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'configure_storage',
      description:
        'Configure storage location. Use this to select from detected OneDrive folders or set a custom storage path. Required when multiple OneDrive folders are detected.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'select', 'custom', 'reset'],
            description: 'Action: list (show options), select (choose OneDrive folder by index), custom (set custom path), reset (clear preference)',
          },
          index: {
            type: 'number',
            description: 'OneDrive folder index to select (1-based, use with action=select)',
          },
          path: {
            type: 'string',
            description: 'Custom storage path (use with action=custom)',
          },
        },
        required: ['action'],
      },
    },

    // ========== Memory Relationships ==========
    {
      name: 'link_memories',
      description:
        'Create or remove bidirectional links between two memories. Linked memories will reference each other.',
      inputSchema: {
        type: 'object',
        properties: {
          id1: {
            type: 'string',
            description: 'First memory ID (full or partial)',
          },
          id2: {
            type: 'string',
            description: 'Second memory ID (full or partial)',
          },
          operation: {
            type: 'string',
            enum: ['link', 'unlink'],
            description: 'Operation to perform: link (create) or unlink (remove)',
            default: 'link',
          },
        },
        required: ['id1', 'id2'],
      },
    },
    {
      name: 'get_related',
      description: 'Get all memories that are linked to a specific memory.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Memory ID (full or partial)',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'merge_memories',
      description:
        'Merge multiple memories into one. The first memory becomes the base, and others are appended to it. Original memories are deleted.',
      inputSchema: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of memory IDs to merge (minimum 2)',
          },
          title: {
            type: 'string',
            description: 'Optional custom title for merged memory',
          },
        },
        required: ['ids'],
      },
    },

    // ========== Batch Operations ==========
    {
      name: 'batch_tag',
      description:
        'Add or remove a tag from multiple memories at once. Can filter by query or category.',
      inputSchema: {
        type: 'object',
        properties: {
          tag: {
            type: 'string',
            description: 'Tag name to add or remove',
          },
          operation: {
            type: 'string',
            enum: ['add', 'remove'],
            description: 'Operation: add tag or remove tag',
            default: 'add',
          },
          query: {
            type: 'string',
            description: 'Optional search query to filter memories',
          },
          category: {
            type: 'string',
            enum: ['project', 'decision', 'preference', 'learning', 'task'],
            description: 'Optional category filter',
          },
          dryRun: {
            type: 'boolean',
            description: 'If true, preview changes without applying them',
            default: false,
          },
        },
        required: ['tag', 'operation'],
      },
    },
    {
      name: 'batch_delete',
      description:
        'Delete multiple memories at once based on filters. CAUTION: This is destructive. Always use dryRun first!',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['project', 'decision', 'preference', 'learning', 'task'],
            description: 'Delete all memories in this category',
          },
          expired: {
            type: 'boolean',
            description: 'Delete all expired memories (past TTL)',
          },
          stale: {
            type: 'boolean',
            description: 'Delete stale memories (older than 90 days)',
          },
          query: {
            type: 'string',
            description: 'Delete memories matching search query',
          },
          dryRun: {
            type: 'boolean',
            description: 'If true, preview what would be deleted without deleting',
            default: true,
          },
        },
      },
    },

    // ========== Analytics & Export ==========
    {
      name: 'get_statistics',
      description:
        'Get comprehensive statistics about your memories: counts by category/project/priority, top tags, age distribution, health status.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'visualize_graph',
      description:
        'Generate a mermaid diagram showing memory relationships. Can show full graph or subgraph from a specific memory.',
      inputSchema: {
        type: 'object',
        properties: {
          fromId: {
            type: 'string',
            description: 'Optional: Start from specific memory ID to show subgraph',
          },
          depth: {
            type: 'number',
            description: 'Maximum relationship depth to traverse. Default: 3',
            default: 3,
          },
        },
      },
    },
    {
      name: 'export_memories',
      description:
        'Export memories to JSON or Markdown format. Useful for backups or external analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'markdown'],
            description: 'Export format: json or markdown',
            default: 'json',
          },
          category: {
            type: 'string',
            enum: ['project', 'decision', 'preference', 'learning', 'task'],
            description: 'Optional: export only specific category',
          },
        },
      },
    },
  ],
}));

// ============================================================================
// Tool Call Handler
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const config = loadConfig();

  try {
    switch (request.params.name) {
      // ========== Core Operations ==========
      case 'remember': {
        const params = request.params.arguments as unknown as RememberParams;
        const result = await remember(config, params);
        return {
          content: [
            {
              type: 'text',
              text: result.success ? `✓ ${result.message}` : `✗ ${result.message}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'recall': {
        const params = request.params.arguments as unknown as RecallParams;
        const result = await recall(config, params);
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case 'list': {
        const params = request.params.arguments as unknown as ListParams;
        const result = await list(config, params);
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case 'forget': {
        const params = request.params.arguments as unknown as ForgetParams;
        const result = await forget(config, params);
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case 'update': {
        const params = request.params.arguments as unknown as UpdateParams;
        const result = await update(config, params);
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case 'get_context': {
        const params = request.params.arguments as unknown as ContextParams;
        const result = await context(config, params);
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case 'cleanup': {
        const params = request.params.arguments as unknown as CleanupParams;
        const result = await cleanup(config, params);
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case 'status': {
        const params = request.params.arguments as unknown as StatusParams;
        const result = await status(config, params);

        // Check if multiple OneDrive folders exist
        const { needsSelection, folders } = needsOneDriveSelection();
        let statusMessage = result.message;

        if (needsSelection && folders.length > 1) {
          statusMessage += '\n\n⚠️ **Multiple OneDrive folders detected!**\n\n';
          statusMessage += 'Available folders:\n';
          folders.forEach((folder, i) => {
            statusMessage += `  ${i + 1}. ${folder}\n`;
          });
          statusMessage += '\nUse the `configure_storage` tool to select one:\n';
          statusMessage += '- List options: { action: "list" }\n';
          statusMessage += `- Select folder: { action: "select", index: 1 }\n`;
          statusMessage += '- Custom path: { action: "custom", path: "/your/custom/path" }';
        }

        return {
          content: [
            {
              type: 'text',
              text: statusMessage,
            },
          ],
          isError: !result.success,
        };
      }

      case 'configure_storage': {
        const args = request.params.arguments as { action: string; index?: number; path?: string };

        try {
          const folders = findAllOneDriveFolders();

          switch (args.action) {
            case 'list': {
              if (folders.length === 0) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: '⚠️ No OneDrive folders detected.\n\nYou can set a custom storage path:\n`configure_storage` with action="custom" and path="/your/custom/path"',
                    },
                  ],
                  isError: false,
                };
              }

              const currentFolder = findOneDriveFolder();
              let message = '**Available OneDrive folders:**\n\n';
              folders.forEach((folder, i) => {
                const isCurrent = folder === currentFolder;
                message += `  ${i + 1}. ${folder}${isCurrent ? ' ✓ (current)' : ''}\n`;
              });
              message += '\n**To select:**\n';
              message += '`configure_storage` with action="select" and index=<number>\n\n';
              message += '**Or set custom path:**\n';
              message += '`configure_storage` with action="custom" and path="/your/path"';

              return {
                content: [{ type: 'text', text: message }],
                isError: false,
              };
            }

            case 'select': {
              if (!args.index) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: '❌ Missing required parameter: index\n\nExample: { action: "select", index: 1 }',
                    },
                  ],
                  isError: true,
                };
              }

              const index = args.index - 1; // Convert to 0-based
              if (index < 0 || index >= folders.length) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `❌ Invalid index: ${args.index}. Must be between 1 and ${folders.length}.`,
                    },
                  ],
                  isError: true,
                };
              }

              const selectedFolder = folders[index];
              setOneDriveFolder(selectedFolder, false); // Not a custom path

              return {
                content: [
                  {
                    type: 'text',
                    text: `✓ OneDrive folder selected:\n${selectedFolder}\n\nMemories will be stored in:\n${selectedFolder}/Apps/ClaudeMemory/`,
                  },
                ],
                isError: false,
              };
            }

            case 'custom': {
              if (!args.path) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: '❌ Missing required parameter: path\n\nExample: { action: "custom", path: "/Users/you/Documents/ClaudeMemory" }',
                    },
                  ],
                  isError: true,
                };
              }

              setOneDriveFolder(args.path, true); // Is a custom path

              return {
                content: [
                  {
                    type: 'text',
                    text: `✓ Custom storage location set to:\n${args.path}\n\nMemories will be stored directly in this folder (no /Apps/ClaudeMemory subfolder).`,
                  },
                ],
                isError: false,
              };
            }

            case 'reset': {
              clearOneDrivePreference();
              const autoDetected = findOneDriveFolder();

              return {
                content: [
                  {
                    type: 'text',
                    text: autoDetected
                      ? `✓ Storage preference cleared.\n\nAuto-detected folder: ${autoDetected}`
                      : '✓ Storage preference cleared.\n\n⚠️ No OneDrive folder auto-detected. Use `configure_storage` to set a location.',
                  },
                ],
                isError: false,
              };
            }

            default:
              return {
                content: [
                  {
                    type: 'text',
                    text: `❌ Unknown action: ${args.action}\n\nValid actions: list, select, custom, reset`,
                  },
                ],
                isError: true,
              };
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to configure storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      // ========== Memory Relationships ==========
      case 'link_memories': {
        const args = request.params.arguments as { id1: string; id2: string; operation?: string };
        const operation = args.operation || 'link';

        try {
          const entries = await listMemories(config);
          const match1 = entries.find((e) => e.id === args.id1 || e.id.startsWith(args.id1));
          const match2 = entries.find((e) => e.id === args.id2 || e.id.startsWith(args.id2));

          if (!match1) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No memory found with ID starting with "${args.id1}"`,
                },
              ],
              isError: true,
            };
          }
          if (!match2) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No memory found with ID starting with "${args.id2}"`,
                },
              ],
              isError: true,
            };
          }

          if (operation === 'unlink') {
            const success = await unlinkMemories(config, match1.id, match2.id);
            return {
              content: [
                {
                  type: 'text',
                  text: success
                    ? `✓ Unlinked:\n  "${match1.title}"\n  "${match2.title}"`
                    : '✗ Failed to unlink memories',
                },
              ],
              isError: !success,
            };
          }

          const { memory1, memory2 } = await linkMemories(config, match1.id, match2.id);
          return {
            content: [
              {
                type: 'text',
                text:
                  memory1 && memory2
                    ? `✓ Linked:\n  "${memory1.title}"\n  "${memory2.title}"\n\nThese memories will now reference each other.`
                    : '✗ Failed to link memories',
              },
            ],
            isError: !(memory1 && memory2),
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to ${operation} memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'get_related': {
        const args = request.params.arguments as { id: string };

        try {
          const entries = await listMemories(config);
          const match = entries.find((e) => e.id === args.id || e.id.startsWith(args.id));

          if (!match) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No memory found with ID starting with "${args.id}"`,
                },
              ],
              isError: true,
            };
          }

          const related = await getRelatedMemories(config, match.id);
          const sourceMemory = await getMemory(config, match.id);

          if (!sourceMemory) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Failed to load memory',
                },
              ],
              isError: true,
            };
          }

          let message = `## ${sourceMemory.title}\n\n`;

          if (related.length === 0) {
            message += 'No related memories found.\n\nUse `link_memories` to create relationships.';
          } else {
            message += `**Related memories (${related.length}):**\n\n`;
            message += formatMemoriesForDisplay(related);
          }

          return {
            content: [
              {
                type: 'text',
                text: message,
              },
            ],
            isError: false,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to get related memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'merge_memories': {
        const args = request.params.arguments as { ids: string[]; title?: string };

        if (!args.ids || args.ids.length < 2) {
          return {
            content: [
              {
                type: 'text',
                text: 'Need at least 2 memory IDs to merge',
              },
            ],
            isError: true,
          };
        }

        try {
          const entries = await listMemories(config);
          const matchedIds: string[] = [];

          for (const id of args.ids) {
            const match = entries.find((e) => e.id === id || e.id.startsWith(id));
            if (!match) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No memory found with ID starting with "${id}"`,
                  },
                ],
                isError: true,
              };
            }
            matchedIds.push(match.id);
          }

          const toMerge = await Promise.all(matchedIds.map((id) => getMemory(config, id)));
          const validMemories = toMerge.filter((m): m is NonNullable<typeof m> => m != null);

          if (validMemories.length < 2) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Need at least 2 valid memories to merge',
                },
              ],
              isError: true,
            };
          }

          const merged = await mergeMemories(config, matchedIds, { newTitle: args.title });

          if (!merged) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Failed to merge memories',
                },
              ],
              isError: true,
            };
          }

          const mergedTitles = validMemories.map((m) => `  - ${m.title}`).join('\n');

          return {
            content: [
              {
                type: 'text',
                text: `✓ Merged ${validMemories.length} memories into one:\n\nMerged:\n${mergedTitles}\n\nResult:\n  ID: ${merged.id}\n  Title: ${merged.title}\n  Tags: ${merged.tags.join(', ') || '(none)'}`,
              },
            ],
            isError: false,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to merge memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      // ========== Batch Operations ==========
      case 'batch_tag': {
        const args = request.params.arguments as {
          tag: string;
          operation: string;
          query?: string;
          category?: MemoryCategory;
          dryRun?: boolean;
        };

        try {
          const dryRun = args.dryRun ?? false;

          if (args.operation === 'add') {
            const result = await batchAddTag(config, args.tag, {
              query: args.query,
              category: args.category,
              dryRun,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: formatBatchResult(
                    result,
                    dryRun ? `Would tag with #${args.tag}` : `Tagged with #${args.tag}`
                  ),
                },
              ],
              isError: false,
            };
          } else {
            const result = await batchRemoveTag(config, args.tag, {
              query: args.query,
              category: args.category,
              dryRun,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: formatBatchResult(
                    result,
                    dryRun ? `Would remove tag #${args.tag}` : `Removed tag #${args.tag}`
                  ),
                },
              ],
              isError: false,
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to ${args.operation} tag: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'batch_delete': {
        const args = request.params.arguments as {
          category?: MemoryCategory;
          expired?: boolean;
          stale?: boolean;
          query?: string;
          dryRun?: boolean;
        };

        const dryRun = args.dryRun ?? true; // Default to dry run for safety

        if (!args.expired && !args.stale && !args.query && !args.category) {
          return {
            content: [
              {
                type: 'text',
                text: 'Must specify at least one filter: expired, stale, query, or category\nUse dryRun: true to preview what would be deleted.',
              },
            ],
            isError: true,
          };
        }

        try {
          const result = await bulkDelete(config, {
            category: args.category,
            expired: args.expired,
            stale: args.stale,
            query: args.query,
            dryRun,
          });

          return {
            content: [
              {
                type: 'text',
                text: formatBatchResult(result, dryRun ? 'Would delete' : 'Deleted'),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to bulk delete: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      // ========== Analytics & Export ==========
      case 'get_statistics': {
        try {
          const stats = await getMemoryStatistics(config);
          return {
            content: [
              {
                type: 'text',
                text: formatStats(stats),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to generate statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'visualize_graph': {
        const args = request.params.arguments as { fromId?: string; depth?: number };

        try {
          const graph = await generateRelationshipGraph(config, args.fromId, args.depth ?? 3);
          return {
            content: [
              {
                type: 'text',
                text: graph,
              },
            ],
            isError: false,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to generate graph: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'export_memories': {
        const args = request.params.arguments as { format?: string; category?: string };
        const format = args.format || 'json';

        try {
          let content: string;

          if (format === 'json') {
            content = await exportToJSON(config, args.category);
          } else if (format === 'markdown') {
            content = await exportToMarkdown(config, args.category);
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `Unknown format: ${format}. Use 'json' or 'markdown'.`,
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: content,
              },
            ],
            isError: false,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is for MCP protocol)
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('  claude-onedrive-memory MCP Server v0.2.0');
  console.error('  Persistent memory for Claude using OneDrive or custom storage');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('');
  console.error('📦 MCP Resources (memory:// URI scheme):');
  console.error('   • memory://list              - All memories (JSON)');
  console.error('   • memory://{id}              - Specific memory (Markdown)');
  console.error('   • memory://project/{id}      - Project memories (JSON)');
  console.error('   • memory://category/{name}   - Category memories (JSON)');
  console.error('');
  console.error('🛠️  MCP Tools: 17 operations available');
  console.error('   Core: remember, recall, list, forget, update, get_context,');
  console.error('         cleanup, status, configure_storage');
  console.error('   Advanced: link_memories, get_related, merge_memories,');
  console.error('             batch_tag, batch_delete, get_statistics,');
  console.error('             visualize_graph, export_memories');
  console.error('');
  console.error('📁 Storage: Auto-detects OneDrive or use custom path');
  console.error('   Use "status" tool to check, "configure_storage" to set');
  console.error('═══════════════════════════════════════════════════════════════');
}

main().catch((error) => {
  console.error('Fatal error in MCP server:', error);
  process.exit(1);
});
