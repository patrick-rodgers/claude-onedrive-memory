import { listMemories, updateMemory, deleteMemory, getMemory } from './memory.js';
import { searchMemories, isExpired } from './search.js';
import type { Config, MemoryCategory } from './types.js';

export interface BatchTagOptions {
  query?: string;
  category?: MemoryCategory;
  projectOnly?: boolean;
  dryRun?: boolean;
}

export interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  items: Array<{
    id: string;
    title: string;
    success: boolean;
    error?: string;
  }>;
}

// Add tag to multiple memories
export async function batchAddTag(
  config: Config,
  tag: string,
  options: BatchTagOptions = {}
): Promise<BatchResult> {
  const result: BatchResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    items: [],
  };

  let entries;

  if (options.query) {
    // Search-based selection
    const searchResults = await searchMemories(config, options.query, {
      category: options.category,
      limit: 1000,
    });
    entries = searchResults.map(r => r.entry);
  } else if (options.category) {
    // Category-based selection
    entries = await listMemories(config, options.category);
  } else {
    // All memories
    entries = await listMemories(config);
  }

  for (const entry of entries) {
    result.processed++;

    if (options.dryRun) {
      result.items.push({
        id: entry.id,
        title: entry.title,
        success: true,
      });
      result.succeeded++;
      continue;
    }

    try {
      // Get current tags, add new one if not present
      const currentTags = entry.tags || [];
      if (!currentTags.includes(tag)) {
        const newTags = [...currentTags, tag];
        const updated = await updateMemory(config, entry.id, { tags: newTags });

        result.items.push({
          id: entry.id,
          title: entry.title,
          success: !!updated,
        });

        if (updated) {
          result.succeeded++;
        } else {
          result.failed++;
        }
      } else {
        // Already has tag, count as success
        result.items.push({
          id: entry.id,
          title: entry.title,
          success: true,
        });
        result.succeeded++;
      }
    } catch (error) {
      result.items.push({
        id: entry.id,
        title: entry.title,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.failed++;
    }
  }

  return result;
}

// Remove tag from multiple memories
export async function batchRemoveTag(
  config: Config,
  tag: string,
  options: BatchTagOptions = {}
): Promise<BatchResult> {
  const result: BatchResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    items: [],
  };

  let entries;

  if (options.query) {
    const searchResults = await searchMemories(config, options.query, {
      category: options.category,
      limit: 1000,
    });
    entries = searchResults.map(r => r.entry);
  } else if (options.category) {
    entries = await listMemories(config, options.category);
  } else {
    entries = await listMemories(config);
  }

  // Filter to only memories that have this tag
  entries = entries.filter(e => e.tags && e.tags.includes(tag));

  for (const entry of entries) {
    result.processed++;

    if (options.dryRun) {
      result.items.push({
        id: entry.id,
        title: entry.title,
        success: true,
      });
      result.succeeded++;
      continue;
    }

    try {
      const newTags = entry.tags.filter(t => t !== tag);
      const updated = await updateMemory(config, entry.id, { tags: newTags });

      result.items.push({
        id: entry.id,
        title: entry.title,
        success: !!updated,
      });

      if (updated) {
        result.succeeded++;
      } else {
        result.failed++;
      }
    } catch (error) {
      result.items.push({
        id: entry.id,
        title: entry.title,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.failed++;
    }
  }

  return result;
}

export interface BulkDeleteOptions {
  category?: MemoryCategory;
  expired?: boolean;
  stale?: boolean;
  query?: string;
  projectOnly?: boolean;
  dryRun?: boolean;
}

// Bulk delete memories
export async function bulkDelete(
  config: Config,
  options: BulkDeleteOptions = {}
): Promise<BatchResult> {
  const result: BatchResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    items: [],
  };

  let entries = await listMemories(config, options.category);

  // Apply filters
  if (options.expired) {
    entries = entries.filter(isExpired);
  }

  if (options.stale) {
    entries = entries.filter(e => {
      if (e.expiresAt) return false; // Has TTL, not stale
      const updated = new Date(e.updated);
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 90);
      return updated < staleDate;
    });
  }

  if (options.query) {
    const searchResults = await searchMemories(config, options.query, {
      category: options.category,
      limit: 1000,
    });
    const searchIds = new Set(searchResults.map(r => r.entry.id));
    entries = entries.filter(e => searchIds.has(e.id));
  }

  for (const entry of entries) {
    result.processed++;

    if (options.dryRun) {
      result.items.push({
        id: entry.id,
        title: entry.title,
        success: true,
      });
      result.succeeded++;
      continue;
    }

    try {
      const deleted = await deleteMemory(config, entry.id);

      result.items.push({
        id: entry.id,
        title: entry.title,
        success: deleted,
      });

      if (deleted) {
        result.succeeded++;
      } else {
        result.failed++;
      }
    } catch (error) {
      result.items.push({
        id: entry.id,
        title: entry.title,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.failed++;
    }
  }

  return result;
}

export function formatBatchResult(result: BatchResult, operation: string): string {
  const lines: string[] = [];

  lines.push(`## ${operation} Results\n`);
  lines.push(`Processed: ${result.processed}`);
  lines.push(`Succeeded: ${result.succeeded}`);
  if (result.failed > 0) {
    lines.push(`Failed: ${result.failed}`);
  }
  lines.push('');

  if (result.items.length > 0) {
    lines.push('### Details\n');
    for (const item of result.items) {
      const status = item.success ? '✓' : '✗';
      lines.push(`${status} ${item.title}`);
      if (item.error) {
        lines.push(`  Error: ${item.error}`);
      }
    }
  }

  return lines.join('\n');
}
