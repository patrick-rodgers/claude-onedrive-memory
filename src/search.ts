import { listMemories, getMemory } from './memory.js';
import { detectProjectContext } from './project.js';
import type { Config, Memory, MemoryCategory, MemoryIndexEntry } from './types.js';

export interface ProjectFilterOptions {
  projectId?: string | null;  // Filter to specific project (null = detect current)
  includeGlobal?: boolean;    // Include global memories (default: true)
  allProjects?: boolean;      // Ignore project filtering entirely
}

export interface StalenessOptions {
  includeExpired?: boolean;   // Include expired memories (default: false)
  staleDays?: number;         // Days after which a memory is considered stale (default: 90)
}

// Check if a memory is expired
export function isExpired(entry: { expiresAt?: string }): boolean {
  if (!entry.expiresAt) return false;
  return new Date(entry.expiresAt) < new Date();
}

// Check if a memory is stale (not expired, but old)
export function isStale(entry: { updated: string; expiresAt?: string }, staleDays: number = 90): boolean {
  if (entry.expiresAt) return false; // Has explicit TTL, not considered stale
  const updatedDate = new Date(entry.updated);
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - staleDays);
  return updatedDate < staleDate;
}

// Get staleness info for display
export function getStalenessInfo(entry: { updated: string; expiresAt?: string }): string | null {
  if (entry.expiresAt) {
    const expiresAt = new Date(entry.expiresAt);
    const now = new Date();
    if (expiresAt < now) {
      return 'EXPIRED';
    }
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLeft <= 7) {
      return `expires in ${daysLeft}d`;
    }
    return null;
  }

  // Check for staleness (90 days default)
  if (isStale(entry, 90)) {
    const updatedDate = new Date(entry.updated);
    const daysAgo = Math.floor((Date.now() - updatedDate.getTime()) / (24 * 60 * 60 * 1000));
    return `stale (${daysAgo}d old)`;
  }

  return null;
}

interface SearchResult {
  entry: MemoryIndexEntry;
  score: number;
  memory?: Memory;
}

// Filter entries by project context
async function filterByProject(
  entries: MemoryIndexEntry[],
  options: ProjectFilterOptions & StalenessOptions
): Promise<MemoryIndexEntry[]> {
  const { includeGlobal = true, allProjects = false, includeExpired = false } = options;

  // First, filter out expired memories unless explicitly included
  if (!includeExpired) {
    entries = entries.filter(entry => !isExpired(entry));
  }

  // If allProjects is true, return everything (after expiration filter)
  if (allProjects) {
    return entries;
  }

  // Detect current project if not specified
  let projectId = options.projectId;
  if (projectId === undefined) {
    const context = await detectProjectContext();
    projectId = context.projectId;
  }

  // If no project context and not including global, return empty
  if (!projectId && !includeGlobal) {
    return [];
  }

  return entries.filter((entry) => {
    const entryIsGlobal = !entry.projectId;
    const isCurrentProject = entry.projectId === projectId;

    if (entryIsGlobal) {
      return includeGlobal;
    }
    return isCurrentProject;
  });
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
  } & ProjectFilterOptions = {}
): Promise<SearchResult[]> {
  const { category, tags, limit = 10, includeFullContent = false } = options;

  // Get all memories (filtered by category if specified)
  let entries = await listMemories(config, category);

  // Filter by project
  entries = await filterByProject(entries, options);

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

    // Priority boost/penalty
    if (entry.priority === 'high') {
      score *= 1.5; // 50% boost for high priority
      score += 50;  // Plus flat bonus to ensure they surface
    } else if (entry.priority === 'low') {
      score *= 0.7; // 30% penalty for low priority
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
  limit: number = 20,
  projectOptions: ProjectFilterOptions = {}
): Promise<Memory[]> {
  let entries = await listMemories(config, category);

  // Filter by project
  entries = await filterByProject(entries, projectOptions);

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

export async function recallRecent(
  config: Config,
  limit: number = 10,
  projectOptions: ProjectFilterOptions = {}
): Promise<Memory[]> {
  let entries = await listMemories(config);

  // Filter by project
  entries = await filterByProject(entries, projectOptions);

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
      const projectStr = m.projectName ? `\n**Project:** ${m.projectName}` : '\n**Project:** (global)';
      const priorityStr = m.priority && m.priority !== 'normal' ? ` **[${m.priority.toUpperCase()}]**` : '';
      const stalenessInfo = getStalenessInfo(m);
      const stalenessStr = stalenessInfo ? ` **(${stalenessInfo})**` : '';
      return `## ${m.title}${priorityStr}${stalenessStr}\n**Category:** ${m.category}${tagStr}${projectStr}\n**ID:** ${m.id}\n**Updated:** ${m.updated}\n\n${m.content}`;
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
      const projectStr = entry.projectName ? ` (${entry.projectName})` : ' (global)';
      const priorityStr = entry.priority && entry.priority !== 'normal' ? ` [${entry.priority.toUpperCase()}]` : '';
      const stalenessInfo = getStalenessInfo(entry);
      const stalenessStr = stalenessInfo ? ` (${stalenessInfo})` : '';
      lines.push(`- **${entry.title}**${priorityStr}${stalenessStr}${tagStr}${projectStr}`);
      lines.push(`  ID: ${entry.id.substring(0, 8)}... | Updated: ${entry.updated.split('T')[0]}`);
      if (entry.snippet) {
        lines.push(`  ${entry.snippet}`);
      }
    }
  }

  return lines.join('\n');
}
