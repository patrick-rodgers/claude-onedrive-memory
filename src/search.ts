import { listMemories, getMemory } from './memory.js';
import type { Config, Memory, MemoryCategory, MemoryIndexEntry } from './types.js';

interface SearchResult {
  entry: MemoryIndexEntry;
  score: number;
  memory?: Memory;
}

// Simple text matching score
function calculateScore(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryWords = lowerQuery.split(/\s+/).filter(Boolean);

  let score = 0;

  // Exact phrase match (highest score)
  if (lowerText.includes(lowerQuery)) {
    score += 100;
  }

  // Individual word matches
  for (const word of queryWords) {
    if (lowerText.includes(word)) {
      score += 10;
      // Bonus for word appearing multiple times
      const matches = lowerText.split(word).length - 1;
      score += Math.min(matches - 1, 5) * 2;
    }
  }

  // Title match bonus
  return score;
}

export async function searchMemories(
  config: Config,
  query: string,
  options: {
    category?: MemoryCategory;
    tags?: string[];
    limit?: number;
    includeFullContent?: boolean;
  } = {}
): Promise<SearchResult[]> {
  const { category, tags, limit = 10, includeFullContent = false } = options;

  // Get all memories (filtered by category if specified)
  let entries = await listMemories(config, category);

  // Filter by tags if specified
  if (tags && tags.length > 0) {
    entries = entries.filter((entry) =>
      tags.some((tag) => entry.tags.includes(tag.toLowerCase()))
    );
  }

  // Score each entry
  const results: SearchResult[] = [];

  for (const entry of entries) {
    // Calculate score based on title, snippet, tags, and category
    let score = 0;

    // Title is most important
    score += calculateScore(entry.title, query) * 2;

    // Snippet/content
    score += calculateScore(entry.snippet, query);

    // Tags
    const tagString = entry.tags.join(' ');
    score += calculateScore(tagString, query) * 1.5;

    // Category match
    if (entry.category.toLowerCase().includes(query.toLowerCase())) {
      score += 20;
    }

    if (score > 0) {
      results.push({ entry, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Limit results
  const limitedResults = results.slice(0, limit);

  // Optionally fetch full content
  if (includeFullContent) {
    for (const result of limitedResults) {
      result.memory = (await getMemory(config, result.entry.id)) || undefined;
    }
  }

  return limitedResults;
}

export async function recallByCategory(
  config: Config,
  category: MemoryCategory,
  limit: number = 20
): Promise<Memory[]> {
  const entries = await listMemories(config, category);

  // Sort by most recent first
  entries.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());

  const memories: Memory[] = [];
  for (const entry of entries.slice(0, limit)) {
    const memory = await getMemory(config, entry.id);
    if (memory) {
      memories.push(memory);
    }
  }

  return memories;
}

export async function recallRecent(config: Config, limit: number = 10): Promise<Memory[]> {
  const entries = await listMemories(config);

  // Sort by most recent first
  entries.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());

  const memories: Memory[] = [];
  for (const entry of entries.slice(0, limit)) {
    const memory = await getMemory(config, entry.id);
    if (memory) {
      memories.push(memory);
    }
  }

  return memories;
}

// Format memories for display
export function formatMemoriesForDisplay(memories: Memory[]): string {
  if (memories.length === 0) {
    return 'No memories found.';
  }

  return memories
    .map((m) => {
      const tagStr = m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : '';
      return `## ${m.title}\n**Category:** ${m.category}${tagStr}\n**ID:** ${m.id}\n**Updated:** ${m.updated}\n\n${m.content}`;
    })
    .join('\n\n---\n\n');
}

export function formatIndexForDisplay(entries: MemoryIndexEntry[]): string {
  if (entries.length === 0) {
    return 'No memories stored.';
  }

  // Group by category
  const byCategory = new Map<string, MemoryIndexEntry[]>();
  for (const entry of entries) {
    const list = byCategory.get(entry.category) || [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  const lines: string[] = [];
  for (const [category, categoryEntries] of byCategory) {
    lines.push(`\n## ${category.toUpperCase()}`);
    for (const entry of categoryEntries) {
      const tagStr = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
      lines.push(`- **${entry.title}**${tagStr}`);
      lines.push(`  ID: ${entry.id.substring(0, 8)}... | Updated: ${entry.updated.split('T')[0]}`);
      if (entry.snippet) {
        lines.push(`  ${entry.snippet}`);
      }
    }
  }

  return lines.join('\n');
}
