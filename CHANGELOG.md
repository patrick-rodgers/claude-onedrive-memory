# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-02-11

### Added

#### Analytics & Reporting
- **stats** command - Comprehensive memory statistics including:
  - Total memory count and age distribution
  - Breakdown by category, project, and priority
  - Top tags analysis
  - Health status (expired/stale memories)
  - Relationship statistics

- **graph** command - Visualize memory relationships with mermaid diagrams:
  - Generate full relationship graph across all memories
  - Show subgraph starting from specific memory
  - Configurable depth for relationship traversal
  - Color-coded by category for easy visualization

- **export** command - Export memories in multiple formats:
  - JSON export for backup and data processing
  - Markdown export for human-readable documentation
  - Optional category filtering
  - Preserves all metadata and relationships

#### Batch Operations
- **tag** command - Add tags to multiple memories at once:
  - Filter by search query or category
  - Dry-run mode for safe preview before applying
  - Batch results summary showing affected memories

- **untag** command - Remove tags from multiple memories:
  - Same filtering options as tag command
  - Dry-run support for safety
  - Detailed results reporting

- **bulk-delete** command - Delete multiple memories based on criteria:
  - Delete expired memories (past expiration date)
  - Delete stale memories (>90 days old)
  - Filter by category
  - Required dry-run mode for safety
  - Comprehensive summary of deletions

### Changed
- Updated README.md with comprehensive documentation for all new features
- Expanded CommandResult type to support new analytics and batch operation results
- Enhanced help text with detailed examples for new commands

### Technical Details
- Added `src/analytics.ts` module with stats, graph, and export functionality
- Added `src/batch.ts` module with tag, untag, and bulk-delete operations
- Updated `src/index.ts` with new command handlers and help documentation
- Modified `src/types.ts` to support flexible command result types

## [1.0.0] - 2024-02-05

### Initial Release
- Core memory operations (remember, recall, forget, list)
- OneDrive integration for automatic sync
- Project-aware memory storage
- Tag and category support
- Priority levels and expiration dates
- Memory relationships and linking
- Update and merge capabilities
- Cleanup operations
- Status and configuration management
