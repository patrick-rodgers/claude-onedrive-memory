import { listMemories, deleteMemory } from '../memory.js';
import type { Config, CommandResult } from '../types.js';

export interface ForgetParams {
  id: string;
}

export async function forget(
  config: Config,
  params: ForgetParams
): Promise<CommandResult> {
  try {
    // First try to find the memory (support partial ID)
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
      message: `Failed to forget memory: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}
