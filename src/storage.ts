import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import type { Config, MemoryIndex } from './types.js';

// Config file location for storing OneDrive preference
const CONFIG_DIR = join(homedir(), '.claude', 'odsp-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface StorageConfig {
  oneDrivePath?: string;
  isCustomPath?: boolean; // True if user set a custom path (not OneDrive)
}

// Load saved config
function loadStorageConfig(): StorageConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

// Save config
function saveStorageConfig(config: StorageConfig): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch {
    // Ignore errors
  }
}

// Find all OneDrive folders on the system
export function findAllOneDriveFolders(): string[] {
  const folders: string[] = [];
  const seen = new Set<string>();

  // Method 1: Check Windows environment variables
  const envVars = ['OneDriveCommercial', 'OneDriveConsumer', 'OneDrive'];
  for (const envVar of envVars) {
    const path = process.env[envVar];
    if (path && existsSync(path) && !seen.has(path)) {
      folders.push(path);
      seen.add(path);
    }
  }

  // Method 2: Scan home directory
  const home = homedir();
  try {
    const homeDirs = readdirSync(home);
    for (const dir of homeDirs) {
      if (dir.startsWith('OneDrive - ') || dir === 'OneDrive') {
        const fullPath = join(home, dir);
        if (existsSync(fullPath) && !seen.has(fullPath)) {
          folders.push(fullPath);
          seen.add(fullPath);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return folders;
}

// Find the configured or auto-detected OneDrive folder
export function findOneDriveFolder(): string | null {
  // Check for saved preference first
  const config = loadStorageConfig();
  if (config.oneDrivePath && existsSync(config.oneDrivePath)) {
    return config.oneDrivePath;
  }

  // Auto-detect
  const folders = findAllOneDriveFolders();
  return folders.length > 0 ? folders[0] : null;
}

// Set the preferred OneDrive folder or custom storage path
export function setOneDriveFolder(path: string, isCustom: boolean = false): void {
  if (!existsSync(path)) {
    throw new Error(`Path does not exist: ${path}`);
  }
  if (!statSync(path).isDirectory()) {
    throw new Error(`Path is not a directory: ${path}`);
  }
  saveStorageConfig({ oneDrivePath: path, isCustomPath: isCustom });
}

// Clear the saved preference
export function clearOneDrivePreference(): void {
  saveStorageConfig({});
}

// Check if multiple OneDrive folders exist and none is configured
export function needsOneDriveSelection(): { needsSelection: boolean; folders: string[] } {
  const config = loadStorageConfig();
  const folders = findAllOneDriveFolders();

  // If we have a valid saved preference, no selection needed
  if (config.oneDrivePath && existsSync(config.oneDrivePath)) {
    return { needsSelection: false, folders };
  }

  // If multiple folders and no preference, need selection
  return { needsSelection: folders.length > 1, folders };
}

// Get the app's storage folder within OneDrive or custom location
export function getStorageFolder(config: Config): string {
  // Mark config as intentionally unused to satisfy static analysis
  void config;
  // Check for saved preference first
  const storageConfig = loadStorageConfig();

  // If custom path is set, use it directly
  if (storageConfig.isCustomPath && storageConfig.oneDrivePath) {
    if (!existsSync(storageConfig.oneDrivePath)) {
      throw new Error(
        `Custom storage path not found: ${storageConfig.oneDrivePath}\n` +
        'Use "configure_storage" tool to set a valid location.'
      );
    }
    return storageConfig.oneDrivePath;
  }

  // Otherwise, find OneDrive folder
  const oneDriveFolder = findOneDriveFolder();

  if (!oneDriveFolder) {
    throw new Error(
      'Could not find OneDrive folder. Make sure OneDrive is installed and syncing.\n' +
      'Or use "configure_storage" tool to set a custom storage location.'
    );
  }

  // Use Apps/ClaudeMemory within OneDrive
  return join(oneDriveFolder, 'Apps', 'ClaudeMemory');
}

// Ensure a directory exists
async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

// Read a file from storage
export async function readStorageFile(config: Config, relativePath: string): Promise<string | null> {
  const fullPath = join(getStorageFolder(config), relativePath);

  try {
    return await readFile(fullPath, 'utf-8');
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// Write a file to storage
export async function writeStorageFile(
  config: Config,
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = join(getStorageFolder(config), relativePath);

  // Ensure parent directory exists
  await ensureDir(dirname(fullPath));

  await writeFile(fullPath, content, 'utf-8');
}

// Delete a file from storage
export async function deleteStorageFile(config: Config, relativePath: string): Promise<boolean> {
  const fullPath = join(getStorageFolder(config), relativePath);

  try {
    await unlink(fullPath);
    return true;
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

// Check if a file exists
export async function storageFileExists(config: Config, relativePath: string): Promise<boolean> {
  const fullPath = join(getStorageFolder(config), relativePath);
  return existsSync(fullPath);
}

// Index-specific helpers
const INDEX_FILE = 'index.json';

export async function readIndex(config: Config): Promise<MemoryIndex> {
  const content = await readStorageFile(config, INDEX_FILE);

  if (!content) {
    return {
      version: 1,
      memories: [],
    };
  }

  return JSON.parse(content) as MemoryIndex;
}

export async function writeIndex(config: Config, index: MemoryIndex): Promise<void> {
  await writeStorageFile(config, INDEX_FILE, JSON.stringify(index, null, 2));
}
