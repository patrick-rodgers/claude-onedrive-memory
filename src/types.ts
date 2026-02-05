export type MemoryCategory =
  | 'project'
  | 'decision'
  | 'preference'
  | 'learning'
  | 'task'
  | string; // Allow custom categories

export type MemoryPriority = 'high' | 'normal' | 'low';

export interface MemoryMetadata {
  id: string;
  category: MemoryCategory;
  tags: string[];
  title: string;
  created: string; // ISO date string
  updated: string; // ISO date string
  projectId?: string;   // Git remote URL (normalized) or null for global
  projectName?: string; // Human-readable project name
  priority?: MemoryPriority; // Memory importance (default: normal)
  expiresAt?: string;   // ISO date string - memory auto-expires after this date
  relatedTo?: string[]; // IDs of related memories
}

export interface Memory extends MemoryMetadata {
  content: string;
}

export interface MemoryIndexEntry {
  id: string;
  category: MemoryCategory;
  tags: string[];
  title: string;
  path: string; // Relative path in OneDrive
  created: string;
  updated: string;
  snippet: string; // First ~100 chars of content for search
  projectId?: string;   // Git remote URL (normalized) or null for global
  projectName?: string; // Human-readable project name
  priority?: MemoryPriority; // Memory importance (default: normal)
  expiresAt?: string;   // ISO date string - memory auto-expires after this date
  relatedTo?: string[]; // IDs of related memories
}

export interface MemoryIndex {
  version: number;
  memories: MemoryIndexEntry[];
}

export interface Config {
  // Config is now minimal - OneDrive folder is auto-detected
  // Future: could add custom storage path override
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresOn: Date;
}

export type Command =
  | { type: 'remember'; category: MemoryCategory; content: string; tags?: string[] }
  | { type: 'recall'; query: string; category?: MemoryCategory }
  | { type: 'forget'; id: string }
  | { type: 'list'; category?: MemoryCategory }
  | { type: 'help' }
  | { type: 'auth' };

export interface CommandResult {
  success: boolean;
  message: string;
  data?: Memory[] | Memory | MemoryIndexEntry[];
}
