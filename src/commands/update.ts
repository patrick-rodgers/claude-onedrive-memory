import { listMemories, updateMemory } from '../memory.js';
import type { Config, CommandResult } from '../types.js';

export interface UpdateParams {
  id: string;
  content?: string;
  tags?: string[];
}

export async function update(
  config: Config,
  params: UpdateParams
): Promise<CommandResult> {
  // Must provide either content or tags
  if (!params.content && !params.tags) {
    return {
      success: false,
      message: 'Please provide new content or tags to update.',
    };
  }

  try {
    // First find the memory (support partial ID)
    const entries = await listMemories(config);
    const match = entries.find(
      (e) => e.id === params.id || e.id.startsWith(params.id)
    );

    if (!match) {
      return {
        success: false,
        message: `No memory found with ID starting with "${params.id}"`,
      };
    }

    const updates: { content?: string; tags?: string[] } = {};
    if (params.content) updates.content = params.content;
    if (params.tags) updates.tags = params.tags;

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
      message: `Failed to update memory: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}
