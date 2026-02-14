#!/usr/bin/env node
/**
 * Release script for claude-onedrive-memory
 * Usage:
 *   npm run release patch          # 0.2.0 -> 0.2.1
 *   npm run release minor          # 0.2.0 -> 0.3.0
 *   npm run release major          # 0.2.0 -> 1.0.0
 *   npm run release 0.3.0          # Set specific version
 *   npm run release patch --dry-run # Test locally without pushing
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const PACKAGE_JSON_PATH = join(ROOT_DIR, 'package.json');

let DRY_RUN = false;

function exec(command: string, options = {}) {
  console.log(`\n→ ${command}`);
  if (DRY_RUN) {
    console.log('  (skipped in dry-run mode)');
    return Buffer.from('');
  }
  return execSync(command, {
    stdio: 'inherit',
    cwd: ROOT_DIR,
    ...options
  });
}

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return parts as [number, number, number];
}

function bumpVersion(current: string, type: 'patch' | 'minor' | 'major'): string {
  let [major, minor, patch] = parseVersion(current);

  switch (type) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'patch':
      patch++;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

function updatePackageVersion(newVersion: string): string {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');
  return oldVersion;
}

function getReleaseNotes(oldVersion: string, newVersion: string): string {
  try {
    // Try to get commits since last tag
    const commits = execSync(
      `git log v${oldVersion}..HEAD --pretty=format:"- %s" --no-merges`,
      { encoding: 'utf-8', cwd: ROOT_DIR }
    ).trim();

    if (commits) {
      return `## What's Changed\n\n${commits}`;
    }
  } catch (e) {
    // No previous tag or error, return default notes
  }

  return `Release version ${newVersion}`;
}

async function main() {
  const args = process.argv.slice(2);
  const arg = args[0];
  DRY_RUN = args.includes('--dry-run');

  if (!arg || arg === '--dry-run') {
    console.error('Usage: npm run release <patch|minor|major|version> [--dry-run]');
    console.error('Examples:');
    console.error('  npm run release patch          # Bump patch version');
    console.error('  npm run release minor          # Bump minor version');
    console.error('  npm run release major          # Bump major version');
    console.error('  npm run release 0.0.1          # Set specific version');
    console.error('  npm run release patch --dry-run # Test locally without pushing');
    process.exit(1);
  }

  // Read current version
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const currentVersion = packageJson.version;

  // Determine new version
  let newVersion: string;
  if (['patch', 'minor', 'major'].includes(arg)) {
    newVersion = bumpVersion(currentVersion, arg as 'patch' | 'minor' | 'major');
  } else {
    // Validate custom version
    parseVersion(arg); // Will throw if invalid
    newVersion = arg;
  }

  console.log(`\n📦 Releasing claude-onedrive-memory ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`   Current version: ${currentVersion}`);
  console.log(`   New version:     ${newVersion}`);
  if (DRY_RUN) {
    console.log(`   Mode:            🧪 Dry run (no git push or npm publish)`);
  }
  console.log('');

  // Step 1: Update version in package.json
  console.log('1️⃣  Updating package.json...');
  const oldVersion = updatePackageVersion(newVersion);

  // Step 2: Build
  console.log('\n2️⃣  Building...');
  execSync('npm run build', { stdio: 'inherit', cwd: ROOT_DIR });

  // Step 3: Create tarball
  console.log('\n3️⃣  Creating npm package...');
  execSync('npm pack', { stdio: 'inherit', cwd: ROOT_DIR });

  if (DRY_RUN) {
    // In dry-run mode, restore the original version
    console.log('\n4️⃣  Restoring original version (dry-run mode)...');
    updatePackageVersion(currentVersion);

    console.log('\n✅ Dry run complete!');
    console.log(`\n🧪 Dry run results:`);
    console.log(`   ✓ Version bump works: ${currentVersion} → ${newVersion}`);
    console.log(`   ✓ Build successful`);
    console.log(`   ✓ Package creation successful`);
    console.log(`   ✓ Package tarball: patrick-rodgers-claude-onedrive-memory-${newVersion}.tgz`);
    console.log('\nSkipped in dry-run mode:');
    console.log('   - Git commit');
    console.log('   - Git tag creation');
    console.log('   - Push to remote');
    console.log('   - GitHub release creation');
    console.log('   - npm publish');
    console.log('\nTo perform a real release, run without --dry-run flag.');
    return;
  }

  // Step 4: Commit version bump
  console.log('\n4️⃣  Committing version bump...');
  exec('git add package.json package-lock.json');
  exec(`git commit -m "chore: bump version to ${newVersion}"`);

  // Step 5: Create and push tag
  console.log('\n5️⃣  Creating git tag...');
  exec(`git tag v${newVersion}`);
  exec('git push origin main');
  exec(`git push origin v${newVersion}`);

  // Step 6: Create GitHub release
  console.log('\n6️⃣  Creating GitHub release...');
  const releaseNotes = getReleaseNotes(currentVersion, newVersion);
  const notesFile = join(ROOT_DIR, '.release-notes.tmp');
  const tarballName = `patrick-rodgers-claude-onedrive-memory-${newVersion}.tgz`;
  writeFileSync(notesFile, releaseNotes);

  try {
    exec(
      `gh release create v${newVersion} ` +
      `--title "v${newVersion}" ` +
      `--notes-file "${notesFile}" ` +
      `${tarballName}`
    );
  } finally {
    // Clean up temp file
    try {
      execSync(`rm "${notesFile}"`, { cwd: ROOT_DIR });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  // Step 7: Publish to npm
  console.log('\n7️⃣  Publishing to npm...');
  exec('npm publish --access public');

  console.log('\n✅ Release complete!');
  console.log(`\n🎉 Version ${newVersion} has been released`);
  console.log(`   View release: https://github.com/patrick-rodgers/claude-onedrive-memory/releases/tag/v${newVersion}`);
  console.log(`   npm package: https://www.npmjs.com/package/@patrick-rodgers/claude-onedrive-memory/v/${newVersion}`);
}

main().catch((error) => {
  console.error('\n❌ Release failed:', error.message);
  process.exit(1);
});
