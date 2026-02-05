import { v4 as uuidv4 } from 'uuid';
import matter from 'gray-matter';
import {
  readStorageFile,
  writeStorageFile,
  deleteStorageFile,
  readIndex,
  writeIndex,
} from './storage.js';
import type { Config, Memory, MemoryCategory, MemoryIndexEntry, MemoryIndex } from './types.js';

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
  const frontmatter = {
    id: memory.id,
    category: memory.category,
    tags: memory.tags,
    created: memory.created,
    updated: memory.updated,
  };

  return matter.stringify(memory.content, frontmatter);
}

// Parse memory from markdown with frontmatter
function parseMemory(content: string): Memory | null {
  try {
    const parsed = matter(content);
    return {
      id: parsed.data.id as string,
      category: parsed.data.category as MemoryCategory,
      tags: (parsed.data.tags as string[]) || [],
      title: extractTitle(parsed.content),
      created: parsed.data.created as string,
      updated: parsed.data.updated as string,
      content: parsed.content.trim(),
    };
  } catch {
    return null;
  }
}

export async function createMemory(
  config: Config,
  category: MemoryCategory,
  content: string,
  tags: string[] = []
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
  updates: { content?: string; tags?: string[] }
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
