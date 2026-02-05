import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export interface ProjectContext {
  projectId: string | null;   // Normalized git remote URL
  projectName: string | null; // Human-readable project name
  gitRoot: string | null;     // Local git root path
}

/**
 * Detect the current project context based on git repository
 */
export async function detectProjectContext(): Promise<ProjectContext> {
  try {
    // Get git root directory
    const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
    });
    const cleanGitRoot = gitRoot.trim();

    // Try to get origin remote URL
    let projectId: string | null = null;
    let projectName: string | null = null;

    try {
      const { stdout: remoteUrl } = await execAsync('git remote get-url origin', {
        encoding: 'utf-8',
      });
      projectId = normalizeGitUrl(remoteUrl.trim());
      projectName = extractProjectName(projectId);
    } catch {
      // No origin remote - use directory name as fallback
      projectName = path.basename(cleanGitRoot);
      projectId = `local:${projectName}`;
    }

    return {
      projectId,
      projectName,
      gitRoot: cleanGitRoot,
    };
  } catch {
    // Not a git repository
    return {
      projectId: null,
      projectName: null,
      gitRoot: null,
    };
  }
}

/**
 * Normalize git URLs to a consistent format
 * SSH: git@github.com:user/repo.git -> github.com/user/repo
 * HTTPS: https://github.com/user/repo.git -> github.com/user/repo
 */
export function normalizeGitUrl(url: string): string {
  let normalized = url.trim();

  // Remove .git suffix
  normalized = normalized.replace(/\.git$/, '');

  // Handle SSH format: git@github.com:user/repo
  const sshMatch = normalized.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  // Handle HTTPS format: https://github.com/user/repo
  const httpsMatch = normalized.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  // Handle Azure DevOps SSH: git@ssh.dev.azure.com:v3/org/project/repo
  const azureSshMatch = normalized.match(/^git@ssh\.dev\.azure\.com:v3\/(.+)$/);
  if (azureSshMatch) {
    return `dev.azure.com/${azureSshMatch[1]}`;
  }

  // Handle Azure DevOps HTTPS: https://dev.azure.com/org/project/_git/repo
  const azureHttpsMatch = normalized.match(/^https?:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/(.+)$/);
  if (azureHttpsMatch) {
    return `dev.azure.com/${azureHttpsMatch[1]}/${azureHttpsMatch[2]}/${azureHttpsMatch[3]}`;
  }

  // Fallback: return as-is
  return normalized;
}

/**
 * Extract project name from normalized git URL
 * github.com/user/repo -> repo
 * dev.azure.com/org/project/repo -> repo
 */
export function extractProjectName(normalizedUrl: string): string {
  // Handle local: prefix
  if (normalizedUrl.startsWith('local:')) {
    return normalizedUrl.substring(6);
  }

  // Get the last path segment
  const parts = normalizedUrl.split('/');
  return parts[parts.length - 1] || normalizedUrl;
}
