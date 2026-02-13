#!/usr/bin/env pwsh
# OneDrive Memory Skill - GitHub Release Installer
# Usage: iwr -useb https://raw.githubusercontent.com/YOUR-USERNAME/odsp-memory-skill/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OneDrive Memory Skill for Claude Code" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$REPO = "patrick-rodgers/claude-onedrive-memory"
$GITHUB_API = "https://api.github.com/repos/$REPO/releases/latest"

# Check prerequisites
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $nodeVersion) {
        throw "Node.js not found"
    }
    Write-Host "  ✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js 18 or higher from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check OneDrive
$oneDrivePaths = @(
    "$env:OneDrive",
    "$env:OneDriveCommercial",
    "$env:OneDriveConsumer"
) | Where-Object { $_ -and (Test-Path $_) }

if ($oneDrivePaths.Count -eq 0) {
    Write-Host "  ⚠ OneDrive not detected" -ForegroundColor Yellow
    Write-Host "    Install OneDrive for auto-sync across devices" -ForegroundColor Gray
} else {
    Write-Host "  ✓ OneDrive detected: $($oneDrivePaths[0])" -ForegroundColor Green
}

# Get latest release info
Write-Host ""
Write-Host "[2/5] Fetching latest release..." -ForegroundColor Yellow

try {
    $release = Invoke-RestMethod -Uri $GITHUB_API -Headers @{
        "User-Agent" = "odsp-memory-installer"
    }
    $version = $release.tag_name
    $downloadUrl = ($release.assets | Where-Object { $_.name -like "*.tgz" }).browser_download_url

    if (-not $downloadUrl) {
        throw "Package file not found in release"
    }

    Write-Host "  ✓ Latest version: $version" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to fetch release: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  - Your internet connection" -ForegroundColor Gray
    Write-Host "  - GitHub repository exists: https://github.com/$REPO" -ForegroundColor Gray
    exit 1
}

# Download package
Write-Host ""
Write-Host "[3/5] Downloading package..." -ForegroundColor Yellow

$tempDir = Join-Path $env:TEMP "odsp-memory-install"
$packageFile = Join-Path $tempDir "odsp-memory-skill.tgz"

try {
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    Invoke-WebRequest -Uri $downloadUrl -OutFile $packageFile -UseBasicParsing
    Write-Host "  ✓ Downloaded to: $packageFile" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Download failed: $_" -ForegroundColor Red
    exit 1
}

# Install package
Write-Host ""
Write-Host "[4/5] Installing globally..." -ForegroundColor Yellow

try {
    npm install -g $packageFile 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
    Write-Host "  ✓ Installed odsp-memory command" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Installation failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running with admin/sudo permissions" -ForegroundColor Yellow
    exit 1
}

# Run setup
Write-Host ""
Write-Host "[5/5] Configuring Claude Code..." -ForegroundColor Yellow

try {
    odsp-memory setup 2>&1 | Out-Null
    Write-Host "  ✓ Claude Code configured" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Setup encountered issues: $_" -ForegroundColor Yellow
    Write-Host "  You can run 'odsp-memory setup' manually later" -ForegroundColor Gray
}

# Cleanup
try {
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
} catch {
    # Ignore cleanup errors
}

# Success message
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Claude Code now has persistent memory!" -ForegroundColor Cyan
Write-Host ""
Write-Host "What happens next:" -ForegroundColor White
Write-Host "  • Claude auto-recalls memories when starting sessions" -ForegroundColor Gray
Write-Host "  • Proactively remembers projects, decisions & preferences" -ForegroundColor Gray
Write-Host "  • Memories sync via OneDrive across all your devices" -ForegroundColor Gray
Write-Host ""
Write-Host "Test it out:" -ForegroundColor White
Write-Host "  odsp-memory status" -ForegroundColor Cyan
Write-Host ""
Write-Host "Documentation:" -ForegroundColor White
Write-Host "  https://github.com/$REPO" -ForegroundColor Cyan
Write-Host ""
