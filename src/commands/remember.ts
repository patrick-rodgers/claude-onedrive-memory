import { createMemory } from '../memory.js';
import type { Config, MemoryCategory, MemoryPriority, CommandResult } from '../types.js';

export interface RememberParams {
  category: MemoryCategory;
  content: string;
  tags?: string[];
  global?: boolean;
  priority?: MemoryPriority;
  ttl?: string;
}

export async function remember(
  config: Config,
  params: RememberParams
): Promise<CommandResult> {
  // Validate priority if provided
  if (params.priority && !['high', 'normal', 'low'].includes(params.priority)) {
    return {
      success: false,
      message: 'Invalid priority. Use: high, normal, or low',
    };
  }

  // Validate TTL format if provided
  if (params.ttl && !/^\d+[dDwWmMyY]$/.test(params.ttl)) {
    return {
      success: false,
      message: 'Invalid TTL format. Use: <number><unit> (e.g., 7d, 2w, 1m, 1y)',
    };
  }

  try {
    const memory = await createMemory(
      config,
      params.category,
      params.content,
      params.tags || [],
      {
        global: params.global,
        priority: params.priority,
        ttl: params.ttl,
      }
    );

    const scopeInfo = memory.projectName
      ? `Project: ${memory.projectName}`
      : 'Scope: global';
    const priorityInfo =
      memory.priority && memory.priority !== 'normal'
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
      message: `Failed to store memory: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}
