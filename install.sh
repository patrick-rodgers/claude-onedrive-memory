#!/usr/bin/env bash
# OneDrive Memory Skill - GitHub Release Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/odsp-memory-skill/main/install.sh | bash

set -e

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Configuration
REPO="patrick-rodgers/claude-onedrive-memory"
GITHUB_API="https://api.github.com/repos/$REPO/releases/latest"  # Always fetches the latest release

echo ""
echo -e "${CYAN}========================================"
echo -e "  OneDrive Memory Skill for Claude Code"
echo -e "========================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "  ${RED}✗ Node.js not found${NC}"
    echo ""
    echo -e "${YELLOW}Please install Node.js 18 or higher from: https://nodejs.org/${NC}"
    exit 1
fi

# Check OneDrive
ONEDRIVE_FOUND=false
if [ -d "$HOME/OneDrive" ] || [ -d "$HOME/Library/CloudStorage/OneDrive-Personal" ] || [ -d "$HOME/Library/CloudStorage/OneDrive-Business" ]; then
    echo -e "  ${GREEN}✓ OneDrive detected${NC}"
    ONEDRIVE_FOUND=true
else
    echo -e "  ${YELLOW}⚠ OneDrive not detected${NC}"
    echo -e "    ${GRAY}Install OneDrive for auto-sync across devices${NC}"
fi

# Get latest release info
echo ""
echo -e "${YELLOW}[2/5] Fetching latest release...${NC}"

if ! command -v curl &> /dev/null; then
    echo -e "  ${RED}✗ curl not found${NC}"
    exit 1
fi

RELEASE_DATA=$(curl -fsSL -H "User-Agent: odsp-memory-installer" "$GITHUB_API" 2>&1) || {
    echo -e "  ${RED}✗ Failed to fetch release${NC}"
    echo ""
    echo -e "${YELLOW}Please check:${NC}"
    echo -e "  ${GRAY}- Your internet connection${NC}"
    echo -e "  ${GRAY}- GitHub repository exists: https://github.com/$REPO${NC}"
    exit 1
}

VERSION=$(echo "$RELEASE_DATA" | grep -o '"tag_name": *"[^"]*"' | sed 's/"tag_name": *"\(.*\)"/\1/')
DOWNLOAD_URL=$(echo "$RELEASE_DATA" | grep -o '"browser_download_url": *"[^"]*\.tgz"' | sed 's/"browser_download_url": *"\(.*\)"/\1/' | head -n1)

if [ -z "$DOWNLOAD_URL" ]; then
    echo -e "  ${RED}✗ Package file not found in release${NC}"
    exit 1
fi

echo -e "  ${GREEN}✓ Latest version: $VERSION${NC}"

# Download package
echo ""
echo -e "${YELLOW}[3/5] Downloading package...${NC}"

TEMP_DIR=$(mktemp -d)
PACKAGE_FILE="$TEMP_DIR/odsp-memory-skill.tgz"

curl -fsSL -o "$PACKAGE_FILE" "$DOWNLOAD_URL" || {
    echo -e "  ${RED}✗ Download failed${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
}

echo -e "  ${GREEN}✓ Downloaded to: $PACKAGE_FILE${NC}"

# Install package
echo ""
echo -e "${YELLOW}[4/5] Installing globally...${NC}"

if npm install -g "$PACKAGE_FILE" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Installed odsp-memory command${NC}"
else
    echo -e "  ${RED}✗ Installation failed${NC}"
    echo ""
    echo -e "${YELLOW}Try running with sudo:${NC}"
    echo -e "  ${CYAN}curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | sudo bash${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Run setup
echo ""
echo -e "${YELLOW}[5/5] Configuring Claude Code...${NC}"

if odsp-memory setup > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Claude Code configured${NC}"
else
    echo -e "  ${YELLOW}⚠ Setup encountered issues${NC}"
    echo -e "  ${GRAY}You can run 'odsp-memory setup' manually later${NC}"
fi

# Cleanup
rm -rf "$TEMP_DIR"

# Success message
echo ""
echo -e "${GREEN}========================================"
echo -e "  Installation Complete!"
echo -e "========================================${NC}"
echo ""
echo -e "${CYAN}Claude Code now has persistent memory!${NC}"
echo ""
echo -e "${NC}What happens next:${NC}"
echo -e "  ${GRAY}• Claude auto-recalls memories when starting sessions${NC}"
echo -e "  ${GRAY}• Proactively remembers projects, decisions & preferences${NC}"
echo -e "  ${GRAY}• Memories sync via OneDrive across all your devices${NC}"
echo ""
echo -e "${NC}Test it out:${NC}"
echo -e "  ${CYAN}odsp-memory status${NC}"
echo ""
echo -e "${NC}Documentation:${NC}"
echo -e "  ${CYAN}https://github.com/$REPO${NC}"
echo ""
