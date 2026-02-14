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

  if (folders.length === 0) {
    return {
      success: false,
      message:
        'No OneDrive folders found.\nMake sure OneDrive is installed and syncing.',
    };
  }

  if (folders.length === 1) {
    message = `OneDrive folder: ${currentFolder}`;
  } else {
    message = `Multiple OneDrive folders detected:\n`;
    folders.forEach((folder, i) => {
      const isCurrent = folder === currentFolder;
      message += `  ${i + 1}. ${folder}${isCurrent ? ' (selected)' : ''}\n`;
    });
    message += `\nTo change, run: config set <number>`;
  }

  try {
    const storageFolder = getStorageFolder(config);
    message += `\nStorage folder: ${storageFolder}`;
  } catch {
    // Storage folder doesn't exist yet, that's fine
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
