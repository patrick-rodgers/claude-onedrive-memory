import {
  searchMemories,
  recallByCategory,
  recallRecent,
  formatMemoriesForDisplay,
  type ProjectFilterOptions,
} from '../search.js';
import { detectProjectContext } from '../project.js';
import type { Config, MemoryCategory, CommandResult } from '../types.js';

export interface RecallParams {
  query?: string;
  category?: MemoryCategory;
  limit?: number;
  global?: boolean;
  all?: boolean;
}

export async function recall(
  config: Config,
  params: RecallParams
): Promise<CommandResult> {
  const query = params.query || '';
  const limit = params.limit || 10;

  // Project filtering options
  const projectOptions: ProjectFilterOptions = {
    allProjects: params.all === true,
    includeGlobal: params.global !== false,
  };

  // If --global flag is set, show only global memories
  if (params.global === true) {
    projectOptions.allProjects = true;
    projectOptions.includeGlobal = true;
  }

  try {
    let memories;

    if (!query && !params.category) {
      // No query, return recent memories
      memories = await recallRecent(config, limit, projectOptions);
    } else if (params.category && !query) {
      // Category only, return all in category
      memories = await recallByCategory(
        config,
        params.category,
        limit,
        projectOptions
      );
    } else {
      // Search with query
      const results = await searchMemories(config, query, {
        category: params.category,
        limit,
        includeFullContent: true,
        ...projectOptions,
      });
      memories = results
        .map((r) => r.memory)
        .filter((m): m is NonNullable<typeof m> => m != null);
    }

    // If --global flag is set, filter to only global memories
    if (params.global === true) {
      memories = memories.filter((m) => !m.projectId);
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
      message: `Failed to recall memories: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}
