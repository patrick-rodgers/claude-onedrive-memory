# Distribution Guide

How to package and share the OneDrive Memory Skill with your team.

## Option 1: GitHub Repository (Recommended)

Best for teams - easy updates, version control, and install directly from GitHub.

### Setup

```bash
# Initialize git repo
cd odsp-memory-skill
git init
git add .
git commit -m "Initial commit: OneDrive memory skill"

# Create repo on GitHub/GitHub Enterprise, then:
git remote add origin https://github.com/YOUR_ORG/odsp-memory-skill.git
git push -u origin main
```

### For Teammates

```bash
# Install globally
npm install -g github:YOUR_ORG/odsp-memory-skill

# Or install a specific version/tag
npm install -g github:YOUR_ORG/odsp-memory-skill#v1.0.0
```

## Option 2: Azure Artifacts (Private npm Registry)

Best for Microsoft teams using Azure DevOps.

### Setup

1. Create a feed in Azure Artifacts
2. Configure npm to use the feed:

```bash
# Set registry for this package
npm config set @yourscope:registry https://pkgs.dev.azure.com/YOUR_ORG/_packaging/YOUR_FEED/npm/registry/

# Authenticate (one-time)
npx vsts-npm-auth -config .npmrc
```

3. Update package.json to use a scope:
```json
{
  "name": "@yourscope/odsp-memory-skill"
}
```

4. Publish:
```bash
npm publish
```

### For Teammates

```bash
# Configure registry (one-time)
npm config set @yourscope:registry https://pkgs.dev.azure.com/YOUR_ORG/_packaging/YOUR_FEED/npm/registry/

# Install
npm install -g @yourscope/odsp-memory-skill
```

## Option 3: Share a Tarball

Simplest option - create a package file and share it directly.

### Create Package

```bash
npm pack
# Creates: odsp-memory-skill-1.0.0.tgz
```

### Share

- Upload to SharePoint/Teams
- Send via email
- Put on a shared network drive

### For Teammates

```bash
# Download the .tgz file, then:
npm install -g ./odsp-memory-skill-1.0.0.tgz
```

## Option 4: Public npm (Open Source)

If you want to share publicly.

### Setup

```bash
# Login to npm (one-time)
npm login

# Publish
npm publish
```

### For Teammates

```bash
npm install -g odsp-memory-skill
```

## After Installation

Once installed, the `odsp-memory` command is available globally:

```bash
# Check OneDrive detection
odsp-memory status

# If multiple OneDrive folders, select one
odsp-memory config list
odsp-memory config set 1

# Test it out
odsp-memory remember project "Hello from my first memory"
odsp-memory list
odsp-memory recall
```

## Updating

### For Maintainers

```bash
# Bump version
npm version patch  # or minor, major

# Push changes
git push && git push --tags

# If using npm registry
npm publish
```

### For Teammates

```bash
# Reinstall to get latest
npm install -g github:YOUR_ORG/odsp-memory-skill

# Or if using npm registry
npm update -g odsp-memory-skill
```

## Running Without Installation

Use `npx` to run without installing globally:

```bash
# From GitHub
npx github:YOUR_ORG/odsp-memory-skill status
npx github:YOUR_ORG/odsp-memory-skill remember project "Quick note"

# From npm
npx odsp-memory-skill list
```
