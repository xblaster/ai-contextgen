# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-01-15

### Added
- **Cryptic Encoding Feature**: New compressed, base64-encoded snapshot format
  - `cryptic` command for generating compressed snapshots with gzip compression
  - `decrypt` command for decoding and restoring cryptic snapshots
  - Configurable compression levels (1-9, default: 6)
  - 60-80% size reduction on typical text-heavy projects
- **Enhanced Integrity Verification**:
  - SHA-256 checksums for individual files and global archive integrity
  - Tamper detection during decode process
  - `--verify-only` option to check integrity without extracting
- **Cryptic File Format**: Structured format with metadata header and compressed JSON payload
- **Comprehensive Test Suite**: Unit tests for cryptic encoding/decoding functionality

### Technical Details
- New modules: `src/crypticEncoder.js` and `src/crypticDecoder.js`
- Reuses existing ignore patterns and file filtering logic
- Maintains backward compatibility with existing snapshot/restore commands
- Memory efficient processing for projects up to 10MB

## [1.4.0] - 2024-12-XX

### Fixed
- Handle code blocks with internal backticks correctly
- Improved markdown delimiter handling
- Fixed checksum errors with CRLF line endings in restore operations

### Added
- Global checksum validation for snapshots and restore operations

## [1.3.0] - 2024-XX-XX

### Added
- Individual file checksum verification
- Enhanced backup and restore integrity checks