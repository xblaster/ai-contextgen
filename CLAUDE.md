# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-ContextGen is a Node.js CLI utility that generates Markdown snapshots of project codebases for AI context sharing and can restore files from these snapshots. The tool respects `.gitignore` and `.ai-ignore` rules, filters out binary files, and provides checksum verification.

## Common Commands

### Development
```bash
npm install          # Install dependencies
npm test            # Run Jest test suite (required before commits/PRs)
npm start           # Run the CLI tool (equivalent to node ai-contextgen.js)
```

### CLI Usage
```bash
node ai-contextgen.js                              # Generate snapshot with defaults
node ai-contextgen.js --input . --output snapshot.md  # Custom input/output
node ai-contextgen.js restore snapshot.md --output ./restored  # Restore files

# New cryptic functionality
node ai-contextgen.js cryptic --input . --output snapshot.cryptic  # Generate cryptic snapshot
node ai-contextgen.js decrypt snapshot.cryptic --output ./decoded  # Decode cryptic snapshot
node ai-contextgen.js decrypt snapshot.cryptic --verify-only       # Verify integrity only
```

### Testing
- Run `npm test` before every commit and PR to ensure Jest suite passes
- Tests are located in `__tests__/` directory
- Uses Jest with mock-fs for filesystem mocking

## Architecture

### Core Components

**Main Entry Point** (`ai-contextgen.js`):
- CLI interface using Commander.js
- Two main commands: `snapshot` (default) and `restore`
- Progress bars using cli-progress library
- File size limit: 1MB, configurable via MAX_SIZE constant
- Skip extensions for binary files (images, executables, etc.)

**Core Modules** (`src/` directory):
- `getIgnoreFilter.js`: Creates ignore filters from .gitignore and .ai-ignore files
- `listFiles.js`: Recursively scans directories respecting ignore patterns
- `filesToMarkdown.js`: Converts file contents to structured Markdown with checksums
- `markdownToFiles.js`: Restores files from Markdown snapshots
- `crypticEncoder.js`: Creates compressed, base64-encoded snapshots with integrity verification
- `crypticDecoder.js`: Decodes cryptic snapshots and verifies data integrity

### Data Flow

1. **Snapshot Generation**:
   - Parse CLI options for input directory and output file
   - Create ignore filter combining .gitignore, .ai-ignore, and .git/ exclusions
   - Recursively scan directory with progress tracking
   - Convert eligible files to Markdown format with SHA-256 checksums
   - Generate global checksum for integrity verification

2. **File Restoration**:
   - Parse Markdown snapshot using regex patterns
   - Extract file paths and contents
   - Recreate directory structure and files
   - Verify checksums for data integrity

3. **Cryptic Encoding** (New):
   - Apply same filtering and scanning logic as regular snapshots
   - Compress JSON data structure using gzip (configurable level 1-9)
   - Encode compressed data as base64 for size optimization
   - Generate file format with header containing metadata and integrity hashes

4. **Cryptic Decoding** (New):
   - Parse cryptic file format and validate header structure
   - Decode base64 and decompress gzip data
   - Verify individual file checksums and global integrity hash
   - Optionally verify-only without extracting files

### File Processing Logic

- **Inclusion**: Text files under 1MB not matching ignore patterns
- **Exclusion**: Binary files (.png, .jpg, .exe, etc.), oversized files, ignored paths
- **Format**: Each file gets a Markdown section with language-specific syntax highlighting
- **Integrity**: Individual SHA-256 checksums per file plus global verification checksum

## Code Style Guidelines

- Use 2-space indentation (from AGENTS.md)
- Favor modern JavaScript syntax (ES6+)
- Write descriptive commit messages in imperative mood
- Include brief PR descriptions linking to relevant issues

## Dependencies

- **commander**: CLI argument parsing
- **cli-progress**: Progress bar displays
- **ignore**: .gitignore/.ai-ignore pattern matching
- **jest**: Testing framework (dev dependency)
- **mock-fs**: Filesystem mocking for tests (dev dependency)