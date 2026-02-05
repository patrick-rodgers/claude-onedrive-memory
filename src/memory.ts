import { v4 as uuidv4 } from 'uuid';
import matter from 'gray-matter';
import {
  readStorageFile,
  writeStorageFile,
  deleteStorageFile,
  readIndex,
  writeIndex,
} from './storage.js';
import { detectProjectContext } from './project.js';
import type { Config, Memory, MemoryCategory, MemoryIndexEntry, MemoryIndex, MemoryPriority } from './types.js';

export interface CreateMemoryOptions {
  global?: boolean;           // If true, create a global memory (no project scope)
  priority?: MemoryPriority;  // Memory importance level
  ttl?: string;               // Time-to-live (e.g., "7d", "30d", "1y")
  relatedTo?: string[];       // IDs of related memories
}

// Parse TTL string into milliseconds
function parseTTL(ttl: string): number | null {
  const match = ttl.match(/^(\d+)([dDwWmMyY])$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  switch (unit) {
    case 'd': return value * MS_PER_DAY;
    case 'w': return value * 7 * MS_PER_DAY;
    case 'm': return value * 30 * MS_PER_DAY;
    case 'y': return value * 365 * MS_PER_DAY;
    default: return null;
  }
}

// Generate a URL-safe slug from title
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

// Extract title from content (first line or first N chars)
function extractTitle(content: string): string {
  const firstLine = content.split('\n')[0].trim();
  // Remove markdown heading prefix if present
  const title = firstLine.replace(/^#+\s*/, '');
  return title.substring(0, 100) || 'Untitled Memory';
}

// Create snippet from content
function createSnippet(content: string): string {
  // Remove the title line and get first 150 chars
  const lines = content.split('\n');
  const bodyStart = lines[0].startsWith('#') ? 1 : 0;
  const body = lines.slice(bodyStart).join(' ').trim();
  return body.substring(0, 150) + (body.length > 150 ? '...' : '');
}

// Format memory as markdown with frontmatter
function formatMemory(memory: Memory): string {
  const frontmatter: Record<string, unknown> = {
    id: memory.id,
    category: memory.category,
    tags: memory.tags,
    created: memory.created,
    updated: memory.updated,
  };

  // Only include project fields if they exist
  if (memory.projectId) {
    frontmatter.projectId = memory.projectId;
  }
  if (memory.projectName) {
    frontmatter.projectName = memory.projectName;
  }
  // Only include priority if not normal (default)
  if (memory.priority && memory.priority !== 'normal') {
    frontmatter.priority = memory.priority;
  }
  // Include expiration if set
  if (memory.expiresAt) {
    frontmatter.expiresAt = memory.expiresAt;
  }
  // Include related memories if set
  if (memory.relatedTo && memory.relatedTo.length > 0) {
    frontmatter.relatedTo = memory.relatedTo;
  }

  return matter.stringify(memory.content, frontmatter);
}

// Parse memory from markdown with frontmatter
function parseMemory(content: string): Memory | null {
  try {
    const parsed = matter(content);
    const memory: Memory = {
      id: parsed.data.id as string,
      category: parsed.data.category as MemoryCategory,
      tags: (parsed.data.tags as string[]) || [],
      title: extractTitle(parsed.content),
      created: parsed.data.created as string,
      updated: parsed.data.updated as string,
      content: parsed.content.trim(),
    };

    // Include project fields if present
    if (parsed.data.projectId) {
      memory.projectId = parsed.data.projectId as string;
    }
    if (parsed.data.projectName) {
      memory.projectName = parsed.data.projectName as string;
    }
    // Include priority if present
    if (parsed.data.priority) {
      memory.priority = parsed.data.priority as MemoryPriority;
    }
    // Include expiration if present
    if (parsed.data.expiresAt) {
      memory.expiresAt = parsed.data.expiresAt as string;
    }
    // Include related memories if present
    if (parsed.data.relatedTo && Array.isArray(parsed.data.relatedTo)) {
      memory.relatedTo = parsed.data.relatedTo as string[];
    }

    return memory;
  } catch {
    return null;
  }
}

export async function createMemory(
  config: Config,
  category: MemoryCategory,
  content: string,
  tags: string[] = [],
  options: CreateMemoryOptions = {}
): Promise<Memory> {
  const now = new Date().toISOString();
  const id = uuidv4();
  const title = extractTitle(content);
  const slug = slugify(title);
  const datePrefix = now.split('T')[0];

  const memory: Memory = {
    id,
    category,
    tags,
    title,
    created: now,
    updated: now,
    content,
  };

  // Set priority if specified
  if (options.priority && options.priority !== 'normal') {
    memory.priority = options.priority;
  }

  // Set expiration if TTL specified
  if (options.ttl) {
    const ttlMs = parseTTL(options.ttl);
    if (ttlMs) {
      const expiresAt = new Date(Date.now() + ttlMs);
      memory.expiresAt = expiresAt.toISOString();
    }
  }

  // Set related memories if specified
  if (options.relatedTo && options.relatedTo.length > 0) {
    memory.relatedTo = options.relatedTo;
  }

  // Detect project context unless creating a global memory
  if (!options.global) {
    const projectContext = await detectProjectContext();
    if (projectContext.projectId) {
      memory.projectId = projectContext.projectId;
      memory.projectName = projectContext.projectName ?? undefined;
    }
  }

  // Write memory file (path is relative to app folder)
  const filePath = `memories/${category}/${datePrefix}-${slug}.md`;
  await writeStorageFile(config, filePath, formatMemory(memory));

  // Update index
  const index = await readIndex(config);
  const indexEntry: MemoryIndexEntry = {
    id,
    category,
    tags,
    title,
    path: `memories/${category}/${datePrefix}-${slug}.md`,
    created: now,
    updated: now,
    snippet: createSnippet(content),
  };

  // Include priority in index
  if (memory.priority) {
    indexEntry.priority = memory.priority;
  }

  // Include project info in index
  if (memory.projectId) {
    indexEntry.projectId = memory.projectId;
  }
  if (memory.projectName) {
    indexEntry.projectName = memory.projectName;
  }
  // Include expiration in index
  if (memory.expiresAt) {
    indexEntry.expiresAt = memory.expiresAt;
  }
  // Include related memories in index
  if (memory.relatedTo && memory.relatedTo.length > 0) {
    indexEntry.relatedTo = memory.relatedTo;
  }

  index.memories.push(indexEntry);
  await writeIndex(config, index);

  return memory;
}

export async function getMemory(config: Config, id: string): Promise<Memory | null> {
  const index = await readIndex(config);
  const entry = index.memories.find((m) => m.id === id);

  if (!entry) return null;

  const content = await readStorageFile(config, entry.path);

  if (!content) return null;

  return parseMemory(content);
}

export async function updateMemory(
  config: Config,
  id: string,
  updates: { content?: string; tags?: string[]; relatedTo?: string[] }
): Promise<Memory | null> {
  const index = await readIndex(config);
  const entryIndex = index.memories.findIndex((m) => m.id === id);

  if (entryIndex === -1) return null;

  const entry = index.memories[entryIndex];
  const existingContent = await readStorageFile(config, entry.path);

  if (!existingContent) return null;

  const memory = parseMemory(existingContent);
  if (!memory) return null;

  // Apply updates
  const now = new Date().toISOString();
  if (updates.content !== undefined) {
    memory.content = updates.content;
    memory.title = extractTitle(updates.content);
  }
  if (updates.tags !== undefined) {
    memory.tags = updates.tags;
  }
  if (updates.relatedTo !== undefined) {
    memory.relatedTo = updates.relatedTo.length > 0 ? updates.relatedTo : undefined;
  }
  memory.updated = now;

  // Write updated memory
  await writeStorageFile(config, entry.path, formatMemory(memory));

  // Update index entry
  index.memories[entryIndex] = {
    ...entry,
    title: memory.title,
    tags: memory.tags,
    updated: now,
    snippet: createSnippet(memory.content),
    relatedTo: memory.relatedTo,
  };
  await writeIndex(config, index);

  return memory;
}

export async function deleteMemory(config: Config, id: string): Promise<boolean> {
  const index = await readIndex(config);
  const entryIndex = index.memories.findIndex((m) => m.id === id);

  if (entryIndex === -1) return false;

  const entry = index.memories[entryIndex];

  // Delete file
  await deleteStorageFile(config, entry.path);

  // Update index
  index.memories.splice(entryIndex, 1);
  await writeIndex(config, index);

  return true;
}

export async function listMemories(
  config: Config,
  category?: MemoryCategory
): Promise<MemoryIndexEntry[]> {
  const index = await readIndex(config);

  if (category) {
    return index.memories.filter((m) => m.category === category);
  }

  return index.memories;
}

export async function getFullIndex(config: Config): Promise<MemoryIndex> {
  return readIndex(config);
}

/**
 * Link two memories together (bidirectional)
 */
export async function linkMemories(
  config: Config,
  id1: string,
  id2: string
): Promise<{ memory1: Memory | null; memory2: Memory | null }> {
  const memory1 = await getMemory(config, id1);
  const memory2 = await getMemory(config, id2);

  if (!memory1 || !memory2) {
    return { memory1: null, memory2: null };
  }

  // Add id2 to memory1's relatedTo
  const related1 = memory1.relatedTo || [];
  if (!related1.includes(id2)) {
    related1.push(id2);
    await updateMemory(config, id1, { relatedTo: related1 });
  }

  // Add id1 to memory2's relatedTo
  const related2 = memory2.relatedTo || [];
  if (!related2.includes(id1)) {
    related2.push(id1);
    await updateMemory(config, id2, { relatedTo: related2 });
  }

  // Return updated memories
  return {
    memory1: await getMemory(config, id1),
    memory2: await getMemory(config, id2),
  };
}

/**
 * Unlink two memories (remove bidirectional link)
 */
export async function unlinkMemories(
  config: Config,
  id1: string,
  id2: string
): Promise<boolean> {
  const memory1 = await getMemory(config, id1);
  const memory2 = await getMemory(config, id2);

  if (!memory1 || !memory2) {
    return false;
  }

  // Remove id2 from memory1's relatedTo
  if (memory1.relatedTo) {
    const related1 = memory1.relatedTo.filter(id => id !== id2);
    await updateMemory(config, id1, { relatedTo: related1 });
  }

  // Remove id1 from memory2's relatedTo
  if (memory2.relatedTo) {
    const related2 = memory2.relatedTo.filter(id => id !== id1);
    await updateMemory(config, id2, { relatedTo: related2 });
  }

  return true;
}

/**
 * Get all memories related to a given memory
 */
export async function getRelatedMemories(
  config: Config,
  id: string
): Promise<Memory[]> {
  const memory = await getMemory(config, id);
  if (!memory || !memory.relatedTo || memory.relatedTo.length === 0) {
    return [];
  }

  const related: Memory[] = [];
  for (const relatedId of memory.relatedTo) {
    const relatedMemory = await getMemory(config, relatedId);
    if (relatedMemory) {
      related.push(relatedMemory);
    }
  }

  return related;
}

/**
 * Merge multiple memories into one
 * The first memory in the array becomes the base, others are appended and deleted
 */
export async function mergeMemories(
  config: Config,
  ids: string[],
  options: {
    newTitle?: string;
    newCategory?: MemoryCategory;
    keepAll?: boolean; // If false, only keep base memory's metadata
  } = {}
): Promise<Memory | null> {
  if (ids.length < 2) {
    return null;
  }

  // Load all memories
  const memories: Memory[] = [];
  for (const id of ids) {
    const memory = await getMemory(config, id);
    if (memory) {
      memories.push(memory);
    }
  }

  if (memories.length < 2) {
    return null;
  }

  const base = memories[0];
  const others = memories.slice(1);

  // Combine content
  const combinedContent = memories
    .map((m, i) => {
      if (i === 0 && !options.newTitle) {
        return m.content;
      }
      return `## ${m.title}\n\n${m.content}`;
    })
    .join('\n\n---\n\n');

  // Combine tags
  const allTags = new Set<string>();
  for (const m of memories) {
    for (const tag of m.tags) {
      allTags.add(tag);
    }
  }

  // Combine related memories
  const allRelated = new Set<string>();
  for (const m of memories) {
    if (m.relatedTo) {
      for (const relatedId of m.relatedTo) {
        // Don't include IDs of memories being merged
        if (!ids.includes(relatedId)) {
          allRelated.add(relatedId);
        }
      }
    }
  }

  // Update base memory with combined content
  const finalContent = options.newTitle
    ? `# ${options.newTitle}\n\n${combinedContent}`
    : combinedContent;

  await updateMemory(config, base.id, {
    content: finalContent,
    tags: Array.from(allTags),
    relatedTo: Array.from(allRelated),
  });

  // Delete the other memories
  for (const other of others) {
    await deleteMemory(config, other.id);
  }

  // Return the updated base memory
  return getMemory(config, base.id);
}
