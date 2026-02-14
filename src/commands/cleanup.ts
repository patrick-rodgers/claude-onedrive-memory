import { listMemories, deleteMemory } from '../memory.js';
import { isExpired } from '../search.js';
import type { Config, CommandResult } from '../types.js';

export interface CleanupParams {
  dryRun?: boolean;
}

export async function cleanup(
  config: Config,
  params: CleanupParams
): Promise<CommandResult> {
  const dryRun = params.dryRun || false;

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
      message: `Failed to cleanup: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}
