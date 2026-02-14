import { searchMemories, recallRecent, formatMemoriesForDisplay } from '../search.js';
import { detectProjectChange } from '../triggers.js';
import { detectFilePatterns, getTagsFromPatterns } from '../triggers.js';
import type { Config, CommandResult } from '../types.js';

export interface ContextParams {
  limit?: number;
  verbose?: boolean;
}

export async function context(
  config: Config,
  params: ContextParams
): Promise<CommandResult> {
  const limit = params.limit || 5;
  const verbose = params.verbose || false;

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
        lines.push(
          `Project changed: ${previous.projectName} -> ${current.projectName}`
        );
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
        lines.push(
          `  - ${pattern.description} (tags: ${pattern.tags.join(', ')})`
        );
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
      memories = results
        .map((r) => r.memory)
        .filter((m): m is NonNullable<typeof m> => m != null);
    }

    // If no pattern-based results or not enough, supplement with recent project memories
    if (memories.length < limit) {
      const recentMemories = await recallRecent(config, limit - memories.length);
      // Avoid duplicates
      const existingIds = new Set(memories.map((m) => m.id));
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
      message: `Failed to get context: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}
