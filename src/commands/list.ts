import { listMemories } from '../memory.js';
import { formatIndexForDisplay } from '../search.js';
import { detectProjectContext } from '../project.js';
import type { Config, MemoryCategory, CommandResult } from '../types.js';

export interface ListParams {
  category?: MemoryCategory;
  project?: string;
  projectOnly?: boolean;
}

export async function list(
  config: Config,
  params: ListParams
): Promise<CommandResult> {
  try {
    let entries = await listMemories(config, params.category);

    // Filter by current project if requested
    if (params.projectOnly) {
      const context = await detectProjectContext();
      if (context.projectId) {
        entries = entries.filter((e) => e.projectId === context.projectId);
      } else {
        // No project context - show only global
        entries = entries.filter((e) => !e.projectId);
      }
    }

    // Filter by specific project ID if provided
    if (params.project) {
      entries = entries.filter((e) => e.projectId === params.project);
    }

    return {
      success: true,
      message: formatIndexForDisplay(entries),
      data: entries,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list memories: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}
