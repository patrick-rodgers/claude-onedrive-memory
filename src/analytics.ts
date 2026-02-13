import { listMemories, getMemory } from './memory.js';
import { isExpired, isStale } from './search.js';
import type { Config, MemoryCategory, MemoryIndexEntry } from './types.js';

export interface MemoryStats {
  total: number;
  byCategory: Record<string, number>;
  byProject: Record<string, { name: string; count: number }>;
  byPriority: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  expired: number;
  stale: number;
  withLinks: number;
  avgAge: number; // Days
  oldest: { title: string; age: number } | null;
  newest: { title: string; age: number } | null;
}

export async function getMemoryStatistics(config: Config): Promise<MemoryStats> {
  const entries = await listMemories(config);

  const stats: MemoryStats = {
    total: entries.length,
    byCategory: {},
    byProject: {},
    byPriority: { high: 0, normal: 0, low: 0 },
    topTags: [],
    expired: 0,
    stale: 0,
    withLinks: 0,
    avgAge: 0,
    oldest: null,
    newest: null,
  };

  if (entries.length === 0) {
    return stats;
  }

  const tagCounts = new Map<string, number>();
  let totalAge = 0;
  let oldestAge = 0;
  let newestAge = Infinity;
  let oldestEntry: MemoryIndexEntry | null = null;
  let newestEntry: MemoryIndexEntry | null = null;

  const now = Date.now();

  for (const entry of entries) {
    // Category counts
    stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;

    // Project counts
    if (entry.projectId) {
      const projectKey = entry.projectId;
      if (!stats.byProject[projectKey]) {
        stats.byProject[projectKey] = { name: entry.projectName || 'Unknown', count: 0 };
      }
      stats.byProject[projectKey].count++;
    } else {
      if (!stats.byProject['global']) {
        stats.byProject['global'] = { name: '(Global)', count: 0 };
      }
      stats.byProject['global'].count++;
    }

    // Priority counts
    const priority = entry.priority || 'normal';
    stats.byPriority[priority]++;

    // Tag counts
    for (const tag of entry.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }

    // Expired/stale counts
    if (isExpired(entry)) {
      stats.expired++;
    } else if (isStale(entry)) {
      stats.stale++;
    }

    // Link counts
    if (entry.relatedTo && entry.relatedTo.length > 0) {
      stats.withLinks++;
    }

    // Age calculations
    const createdDate = new Date(entry.created).getTime();
    const age = (now - createdDate) / (24 * 60 * 60 * 1000); // Days
    totalAge += age;

    if (age > oldestAge) {
      oldestAge = age;
      oldestEntry = entry;
    }
    if (age < newestAge) {
      newestAge = age;
      newestEntry = entry;
    }
  }

  // Calculate averages
  stats.avgAge = Math.round(totalAge / entries.length);

  // Top tags (sorted by count, top 10)
  stats.topTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Oldest/newest
  if (oldestEntry) {
    stats.oldest = { title: oldestEntry.title, age: Math.round(oldestAge) };
  }
  if (newestEntry) {
    stats.newest = { title: newestEntry.title, age: Math.round(newestAge) };
  }

  return stats;
}

export function formatStats(stats: MemoryStats): string {
  const lines: string[] = [];

  lines.push('# Memory Statistics\n');

  // Overview
  lines.push('## Overview');
  lines.push(`**Total memories:** ${stats.total}`);
  lines.push(`**Average age:** ${stats.avgAge} days`);
  if (stats.oldest) {
    lines.push(`**Oldest:** "${stats.oldest.title}" (${stats.oldest.age}d ago)`);
  }
  if (stats.newest) {
    lines.push(`**Newest:** "${stats.newest.title}" (${stats.newest.age}d ago)`);
  }
  lines.push('');

  // Health
  lines.push('## Health');
  const healthIssues: string[] = [];
  if (stats.expired > 0) {
    healthIssues.push(`${stats.expired} expired (run cleanup)`);
  }
  if (stats.stale > 0) {
    healthIssues.push(`${stats.stale} stale (>90 days old)`);
  }
  if (healthIssues.length === 0) {
    lines.push('✅ All memories are fresh');
  } else {
    lines.push(`⚠️  ${healthIssues.join(', ')}`);
  }
  lines.push('');

  // By category
  lines.push('## By Category');
  const categories = Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1]);

  if (categories.length === 0) {
    lines.push('(none)');
  } else {
    for (const [category, count] of categories) {
      const bar = '█'.repeat(Math.ceil((count / stats.total) * 20));
      const pct = Math.round((count / stats.total) * 100);
      lines.push(`  ${category.padEnd(12)} ${bar} ${count} (${pct}%)`);
    }
  }
  lines.push('');

  // By priority
  lines.push('## By Priority');
  lines.push(`  High:   ${stats.byPriority.high}`);
  lines.push(`  Normal: ${stats.byPriority.normal}`);
  lines.push(`  Low:    ${stats.byPriority.low}`);
  lines.push('');

  // By project
  lines.push('## By Project');
  const projects = Object.entries(stats.byProject)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10); // Top 10 projects

  if (projects.length === 0) {
    lines.push('(none)');
  } else {
    for (const [, { name, count }] of projects) {
      const bar = '█'.repeat(Math.ceil((count / stats.total) * 20));
      const pct = Math.round((count / stats.total) * 100);
      lines.push(`  ${name.padEnd(30)} ${bar} ${count} (${pct}%)`);
    }
    if (Object.keys(stats.byProject).length > 10) {
      lines.push(`  ... and ${Object.keys(stats.byProject).length - 10} more projects`);
    }
  }
  lines.push('');

  // Top tags
  lines.push('## Top Tags');
  if (stats.topTags.length === 0) {
    lines.push('(no tags)');
  } else {
    for (const { tag, count } of stats.topTags) {
      const bar = '█'.repeat(Math.ceil((count / stats.total) * 15));
      lines.push(`  #${tag.padEnd(20)} ${bar} ${count}`);
    }
  }
  lines.push('');

  // Relationships
  lines.push('## Relationships');
  if (stats.withLinks === 0) {
    lines.push('No linked memories yet. Use `link <id1> <id2>` to create relationships.');
  } else {
    const linkedPct = Math.round((stats.withLinks / stats.total) * 100);
    lines.push(`${stats.withLinks} memories have links (${linkedPct}%)`);
  }

  return lines.join('\n');
}

// Generate relationship graph in mermaid format
export async function generateRelationshipGraph(
  config: Config,
  fromId?: string,
  maxDepth: number = 3
): Promise<string> {
  const entries = await listMemories(config);

  // If specific ID provided, do subgraph from that node
  if (fromId) {
    const match = entries.find(e => e.id === fromId || e.id.startsWith(fromId));
    if (!match) {
      throw new Error(`No memory found with ID starting with "${fromId}"`);
    }
    return generateSubgraph(config, match.id, maxDepth);
  }

  // Otherwise, generate full graph
  const lines: string[] = [];
  lines.push('```mermaid');
  lines.push('graph TD');
  lines.push('');

  // Find all memories with relationships
  const withRelations = entries.filter(e => e.relatedTo && e.relatedTo.length > 0);

  if (withRelations.length === 0) {
    lines.push('  A[No relationships yet]');
    lines.push('  style A fill:#f9f,stroke:#333,stroke-width:2px');
  } else {
    // Add nodes
    const nodeIds = new Map<string, string>(); // memory id -> node id
    let nodeCounter = 0;

    for (const entry of withRelations) {
      if (!nodeIds.has(entry.id)) {
        const nodeId = `N${nodeCounter++}`;
        nodeIds.set(entry.id, nodeId);
        const label = entry.title.length > 30
          ? entry.title.substring(0, 27) + '...'
          : entry.title;
        const categoryColor = getCategoryColor(entry.category);
        lines.push(`  ${nodeId}["${label}"]`);
        lines.push(`  style ${nodeId} fill:${categoryColor}`);
      }

      // Add related nodes if not already added
      if (entry.relatedTo) {
        for (const relatedId of entry.relatedTo) {
          const related = entries.find(e => e.id === relatedId);
          if (related && !nodeIds.has(related.id)) {
            const nodeId = `N${nodeCounter++}`;
            nodeIds.set(related.id, nodeId);
            const label = related.title.length > 30
              ? related.title.substring(0, 27) + '...'
              : related.title;
            const categoryColor = getCategoryColor(related.category);
            lines.push(`  ${nodeId}["${label}"]`);
            lines.push(`  style ${nodeId} fill:${categoryColor}`);
          }
        }
      }
    }

    lines.push('');

    // Add edges
    for (const entry of withRelations) {
      const fromNode = nodeIds.get(entry.id);
      if (fromNode && entry.relatedTo) {
        for (const relatedId of entry.relatedTo) {
          const toNode = nodeIds.get(relatedId);
          if (toNode) {
            lines.push(`  ${fromNode} --- ${toNode}`);
          }
        }
      }
    }
  }

  lines.push('```');
  lines.push('');
  lines.push(`Total nodes: ${withRelations.length}`);

  return lines.join('\n');
}

async function generateSubgraph(
  config: Config,
  rootId: string,
  maxDepth: number
): Promise<string> {
  const entries = await listMemories(config);
  const visited = new Set<string>();
  const toVisit: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];
  const nodeIds = new Map<string, string>();
  let nodeCounter = 0;

  const lines: string[] = [];
  lines.push('```mermaid');
  lines.push('graph TD');
  lines.push('');

  // BFS to find connected nodes within maxDepth
  while (toVisit.length > 0) {
    const { id, depth } = toVisit.shift()!;

    if (visited.has(id) || depth > maxDepth) {
      continue;
    }

    visited.add(id);
    const entry = entries.find(e => e.id === id);

    if (!entry) continue;

    // Add node
    if (!nodeIds.has(id)) {
      const nodeId = depth === 0 ? 'ROOT' : `N${nodeCounter++}`;
      nodeIds.set(id, nodeId);
      const label = entry.title.length > 30
        ? entry.title.substring(0, 27) + '...'
        : entry.title;
      const categoryColor = getCategoryColor(entry.category);
      lines.push(`  ${nodeId}["${label}"]`);
      if (depth === 0) {
        lines.push(`  style ${nodeId} fill:#ff6,stroke:#333,stroke-width:4px`);
      } else {
        lines.push(`  style ${nodeId} fill:${categoryColor}`);
      }
    }

    // Add related nodes to visit queue
    if (entry.relatedTo) {
      for (const relatedId of entry.relatedTo) {
        if (!visited.has(relatedId)) {
          toVisit.push({ id: relatedId, depth: depth + 1 });
        }
      }
    }
  }

  lines.push('');

  // Add edges for visited nodes
  for (const id of visited) {
    const entry = entries.find(e => e.id === id);
    if (!entry || !entry.relatedTo) continue;

    const fromNode = nodeIds.get(id);
    for (const relatedId of entry.relatedTo) {
      if (visited.has(relatedId)) {
        const toNode = nodeIds.get(relatedId);
        if (fromNode && toNode) {
          lines.push(`  ${fromNode} --- ${toNode}`);
        }
      }
    }
  }

  lines.push('```');
  lines.push('');
  lines.push(`Nodes: ${visited.size} (depth: ${maxDepth})`);

  return lines.join('\n');
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    project: '#bbf',
    decision: '#bfb',
    preference: '#fbb',
    learning: '#ffb',
    task: '#fbf',
  };
  return colors[category] || '#ddd';
}

// Export memories to JSON
export async function exportToJSON(config: Config, category?: string): Promise<string> {
  const entries = await listMemories(config, category as MemoryCategory);
  const memories = await Promise.all(
    entries.map(entry => getMemory(config, entry.id))
  );

  return JSON.stringify(memories.filter(m => m !== null), null, 2);
}

// Export memories to markdown
export async function exportToMarkdown(config: Config, category?: string): Promise<string> {
  const entries = await listMemories(config, category as MemoryCategory);
  const memories = await Promise.all(
    entries.map(entry => getMemory(config, entry.id))
  );

  const lines: string[] = [];
  lines.push('# Memory Export');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total memories: ${memories.filter(m => m !== null).length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const memory of memories) {
    if (!memory) continue;

    lines.push(`## ${memory.title}`);
    lines.push('');
    lines.push(`**Category:** ${memory.category}`);
    if (memory.tags.length > 0) {
      lines.push(`**Tags:** ${memory.tags.map(t => `#${t}`).join(', ')}`);
    }
    if (memory.projectName) {
      lines.push(`**Project:** ${memory.projectName}`);
    }
    if (memory.priority && memory.priority !== 'normal') {
      lines.push(`**Priority:** ${memory.priority}`);
    }
    lines.push(`**Created:** ${new Date(memory.created).toLocaleDateString()}`);
    lines.push(`**Updated:** ${new Date(memory.updated).toLocaleDateString()}`);
    lines.push('');
    lines.push(memory.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
