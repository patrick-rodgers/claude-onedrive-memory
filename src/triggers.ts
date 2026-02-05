import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { detectProjectContext } from './project.js';

export interface FilePatternMapping {
  pattern: string;      // Glob-like pattern (e.g., "*.prisma", "Dockerfile")
  tags: string[];       // Tags to search for when pattern is found
  category?: string;    // Optional category filter
  description: string;  // Human-readable description
}

// Default file pattern mappings
const DEFAULT_PATTERNS: FilePatternMapping[] = [
  { pattern: '*.prisma', tags: ['database', 'prisma', 'orm'], description: 'Prisma schema files' },
  { pattern: 'schema.prisma', tags: ['database', 'prisma', 'orm'], description: 'Prisma schema' },
  { pattern: 'Dockerfile', tags: ['docker', 'deployment', 'container'], description: 'Docker configuration' },
  { pattern: 'docker-compose*.yml', tags: ['docker', 'deployment', 'container'], description: 'Docker Compose' },
  { pattern: '.github/workflows/*', tags: ['ci', 'github-actions', 'deployment'], description: 'GitHub Actions' },
  { pattern: 'package.json', tags: ['dependencies', 'npm'], description: 'Node.js project' },
  { pattern: 'tsconfig.json', tags: ['typescript', 'config'], description: 'TypeScript config' },
  { pattern: '*.test.ts', tags: ['testing', 'jest'], description: 'Test files' },
  { pattern: '*.spec.ts', tags: ['testing', 'jest'], description: 'Test files' },
  { pattern: '.env*', tags: ['environment', 'config', 'secrets'], description: 'Environment files' },
  { pattern: 'tailwind.config.*', tags: ['tailwind', 'css', 'styling'], description: 'Tailwind CSS' },
  { pattern: 'next.config.*', tags: ['nextjs', 'react'], description: 'Next.js config' },
  { pattern: 'vite.config.*', tags: ['vite', 'bundler'], description: 'Vite config' },
  { pattern: 'webpack.config.*', tags: ['webpack', 'bundler'], description: 'Webpack config' },
];

const CONFIG_DIR = join(homedir(), '.claude', 'odsp-memory');
const PATTERNS_FILE = join(CONFIG_DIR, 'patterns.json');
const LAST_PROJECT_FILE = join(CONFIG_DIR, 'last-project.json');

/**
 * Get all file pattern mappings (default + user custom)
 */
export function getPatternMappings(): FilePatternMapping[] {
  const patterns = [...DEFAULT_PATTERNS];

  // Load custom patterns if they exist
  if (existsSync(PATTERNS_FILE)) {
    try {
      const custom = JSON.parse(readFileSync(PATTERNS_FILE, 'utf-8'));
      if (Array.isArray(custom)) {
        patterns.push(...custom);
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  return patterns;
}

/**
 * Save custom pattern mappings
 */
export function saveCustomPatterns(patterns: FilePatternMapping[]): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2), 'utf-8');
}

/**
 * Simple glob-like pattern matching
 */
function matchesPattern(filename: string, pattern: string): boolean {
  // Handle exact match
  if (pattern === filename) return true;

  // Handle *.ext pattern
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1); // Get ".ext"
    return filename.endsWith(ext);
  }

  // Handle prefix* pattern (e.g., "docker-compose*")
  if (pattern.endsWith('*') && !pattern.startsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return filename.startsWith(prefix);
  }

  // Handle */subpath pattern (directory wildcard)
  if (pattern.includes('/*')) {
    const parts = pattern.split('/*');
    if (parts.length === 2) {
      // Simple case: dir/* matches any file in dir
      return filename.startsWith(parts[0] + '/');
    }
  }

  return false;
}

/**
 * Scan current directory for files matching patterns
 */
export function detectFilePatterns(directory: string = process.cwd()): FilePatternMapping[] {
  const patterns = getPatternMappings();
  const matchedPatterns: FilePatternMapping[] = [];
  const seenDescriptions = new Set<string>();

  try {
    // Scan top-level files
    const files = readdirSync(directory, { withFileTypes: true });

    for (const file of files) {
      const filename = file.name;

      for (const pattern of patterns) {
        if (matchesPattern(filename, pattern.pattern)) {
          // Avoid duplicate descriptions
          if (!seenDescriptions.has(pattern.description)) {
            matchedPatterns.push(pattern);
            seenDescriptions.add(pattern.description);
          }
        }
      }

      // Check subdirectories for specific patterns (like .github/workflows)
      if (file.isDirectory() && filename === '.github') {
        try {
          const workflowsDir = join(directory, '.github', 'workflows');
          if (existsSync(workflowsDir)) {
            const workflowPattern = patterns.find(p => p.pattern.includes('.github/workflows'));
            if (workflowPattern && !seenDescriptions.has(workflowPattern.description)) {
              matchedPatterns.push(workflowPattern);
              seenDescriptions.add(workflowPattern.description);
            }
          }
        } catch {
          // Ignore errors reading subdirectories
        }
      }
    }
  } catch {
    // Can't read directory, return empty
  }

  return matchedPatterns;
}

/**
 * Get all unique tags from matched patterns
 */
export function getTagsFromPatterns(matchedPatterns: FilePatternMapping[]): string[] {
  const tags = new Set<string>();
  for (const pattern of matchedPatterns) {
    for (const tag of pattern.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags);
}

/**
 * Track the last known project to detect project changes
 */
export interface LastProjectState {
  projectId: string | null;
  projectName: string | null;
  timestamp: string;
}

export function getLastProject(): LastProjectState | null {
  if (!existsSync(LAST_PROJECT_FILE)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(LAST_PROJECT_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveLastProject(state: LastProjectState): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(LAST_PROJECT_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function detectProjectChange(): Promise<{
  changed: boolean;
  previous: LastProjectState | null;
  current: LastProjectState;
}> {
  const projectContext = await detectProjectContext();
  const previous = getLastProject();

  const current: LastProjectState = {
    projectId: projectContext.projectId,
    projectName: projectContext.projectName,
    timestamp: new Date().toISOString(),
  };

  const changed = previous === null || previous.projectId !== current.projectId;

  // Save current state
  saveLastProject(current);

  return { changed, previous, current };
}
