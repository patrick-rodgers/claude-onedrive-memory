import {
  findAllOneDriveFolders,
  findOneDriveFolder,
  getStorageFolder,
} from '../storage.js';
import { detectProjectContext } from '../project.js';
import type { Config, CommandResult } from '../types.js';

export interface StatusParams {}

export async function status(
  config: Config,
  params: StatusParams
): Promise<CommandResult> {
  const folders = findAllOneDriveFolders();
  const currentFolder = findOneDriveFolder();

  let message = '';

  // Try to get storage folder first - it handles both OneDrive and custom paths
  let storageFolder: string | null = null;
  try {
    storageFolder = getStorageFolder(config);
  } catch {
    // Storage folder not available
  }

  // Only fail if we have no OneDrive folders AND no custom storage configured
  if (folders.length === 0 && !storageFolder) {
    return {
      success: false,
      message:
        'No OneDrive folders found and no custom storage configured.\n' +
        'Make sure OneDrive is installed and syncing, or use "configure_storage" tool to set a custom location.',
    };
  }

  // Display OneDrive information if available
  if (folders.length === 1) {
    message = `OneDrive folder: ${currentFolder}`;
  } else if (folders.length > 1) {
    message = `Multiple OneDrive folders detected:\n`;
    folders.forEach((folder, i) => {
      const isCurrent = folder === currentFolder;
      message += `  ${i + 1}. ${folder}${isCurrent ? ' (selected)' : ''}\n`;
    });
    message += `\nTo change, run: config set <number>`;
  }

  // Display storage folder (works for both OneDrive and custom paths)
  if (storageFolder) {
    if (message) {
      message += `\nStorage folder: ${storageFolder}`;
    } else {
      message = `Storage folder: ${storageFolder}`;
    }
  }

  // Show current project context
  const projectContext = await detectProjectContext();
  message += '\n';
  if (projectContext.projectId) {
    message += `\nCurrent project: ${projectContext.projectName || 'unknown'}`;
    message += `\nProject ID: ${projectContext.projectId}`;
  } else {
    message += `\nCurrent project: (none detected - memories will be global)`;
  }

  return {
    success: true,
    message,
  };
}
