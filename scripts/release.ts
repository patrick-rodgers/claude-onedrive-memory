#!/usr/bin/env node
/**
 * Release script for odsp-memory-skill
 * Usage:
 *   npm run release patch   # 0.0.1 -> 0.0.2
 *   npm run release minor   # 0.0.1 -> 0.1.0
 *   npm run release major   # 0.0.1 -> 1.0.0
 *   npm run release 0.0.1   # Set specific version
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const PACKAGE_JSON_PATH = join(ROOT_DIR, 'package.json');

function exec(command: string, options = {}) {
  console.log(`\n→ ${command}`);
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
  const arg = process.argv[2];

  if (!arg) {
    console.error('Usage: npm run release <patch|minor|major|version>');
    console.error('Examples:');
    console.error('  npm run release patch   # Bump patch version');
    console.error('  npm run release minor   # Bump minor version');
    console.error('  npm run release major   # Bump major version');
    console.error('  npm run release 0.0.1   # Set specific version');
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

  console.log(`\n📦 Releasing odsp-memory-skill`);
  console.log(`   Current version: ${currentVersion}`);
  console.log(`   New version:     ${newVersion}`);
  console.log('');

  // Step 1: Update version in package.json
  console.log('1️⃣  Updating package.json...');
  updatePackageVersion(newVersion);

  // Step 2: Build
  console.log('\n2️⃣  Building...');
  exec('npm run build');

  // Step 3: Package for distribution
  console.log('\n3️⃣  Creating distribution package...');
  exec('npm run package');

  // Step 4: Commit version bump
  console.log('\n4️⃣  Committing version bump...');
  exec('git add package.json');
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
  writeFileSync(notesFile, releaseNotes);

  try {
    exec(
      `gh release create v${newVersion} ` +
      `--title "v${newVersion}" ` +
      `--notes-file "${notesFile}" ` +
      `teams-distribution/odsp-memory-skill-${newVersion}.tgz ` +
      `teams-distribution/install.ps1 ` +
      `teams-distribution/INSTALL.md`
    );
  } finally {
    // Clean up temp file
    try {
      execSync(`rm "${notesFile}"`, { cwd: ROOT_DIR });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  console.log('\n✅ Release complete!');
  console.log(`\n🎉 Version ${newVersion} has been released`);
  console.log(`   View release: https://github.com/$(git config --get remote.origin.url | sed 's/.*://;s/.git$//')/releases/tag/v${newVersion}`);
}

main().catch((error) => {
  console.error('\n❌ Release failed:', error.message);
  process.exit(1);
});
