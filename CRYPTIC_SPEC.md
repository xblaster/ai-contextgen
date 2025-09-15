# Cryptic Base64 Encoded File Tool Specification

## Overview

This specification defines a cryptic base64 encoded file compression tool that extends AI-ContextGen with secure, size-optimized file archiving capabilities. The tool creates compressed, encoded snapshots that can be decoded and verified for integrity.

## Features

### Core Functionality
- **Cryptic Encoding**: Combines compression (gzip) + base64 encoding for size optimization
- **Hash Verification**: SHA-256 checksums for individual files and global integrity
- **Ignore Pattern Support**: Respects `.gitignore`, `.ai-ignore`, and custom ignore patterns
- **Binary File Handling**: Automatically excludes binary files and oversized content
- **Reversible Process**: Full decode/restore capability with integrity verification

### Security & Integrity
- Individual file SHA-256 checksums
- Global archive SHA-256 checksum
- Tamper detection during decode process
- File size and type validation

## API Specification

### New CLI Commands

```bash
# Generate cryptic encoded snapshot
ai-contextgen cryptic [options]
  --input, -i <folder>     Input directory (default: .)
  --output, -o <filename>  Output cryptic file (default: __aicontextgen.cryptic)
  --compression-level, -c <level>  Gzip compression level 1-9 (default: 6)

# Decode cryptic snapshot
ai-contextgen decrypt <cryptic-file> [options]
  --output, -o <folder>    Target directory (default: ./decoded)
  --verify-only, -v        Only verify integrity without extracting
```

### File Format Structure

```
CRYPTIC-SNAPSHOT-V1\n
GLOBAL-CHECKSUM: <sha256>\n
COMPRESSION-LEVEL: <1-9>\n
FILE-COUNT: <number>\n
---HEADER-END---\n
<base64-encoded-gzip-compressed-json-data>
```

### JSON Data Structure (before compression/encoding)

```json
{
  "metadata": {
    "version": "1.0",
    "generated": "2025-01-15T10:30:00Z",
    "source_directory": "/path/to/source",
    "file_count": 42,
    "compression_level": 6,
    "total_size_original": 1048576,
    "total_size_compressed": 262144
  },
  "files": [
    {
      "path": "src/example.js",
      "checksum": "a1b2c3d4e5f6...",
      "size": 1024,
      "content": "base64-encoded-file-content"
    }
  ],
  "global_checksum": "global-sha256-hash"
}
```

## Module Specifications

### `src/crypticEncoder.js`
- `crypticEncode(startDir, files, options)`: Generate cryptic encoded snapshot
- `calculateGlobalHash(files)`: Compute global integrity hash
- `compressAndEncode(jsonData, compressionLevel)`: Apply gzip + base64

### `src/crypticDecoder.js`
- `crypticDecode(crypticFilePath, outputDir, options)`: Decode and restore files
- `verifyIntegrity(decodedData)`: Verify all checksums
- `decodeAndDecompress(encodedData)`: Reverse base64 + gzip

### `src/crypticUtils.js`
- `generateFileChecksum(content)`: SHA-256 hash generation
- `detectBinaryFile(filePath)`: Binary file detection
- `validateCrypticFormat(content)`: Format validation

## Integration Points

### Existing Code Integration
- Extend `ai-contextgen.js` with new commands
- Reuse `getIgnoreFilter.js` for file filtering
- Reuse `listFiles.js` for directory scanning
- Similar progress bar integration as existing commands

### Error Handling
- Invalid cryptic file format
- Checksum mismatch detection
- Compression/decompression errors
- File system permission errors
- Missing dependencies

## Performance Requirements

### Compression Targets
- Achieve 60-80% size reduction on typical text-heavy projects
- Process files up to 10MB total project size efficiently
- Memory usage should not exceed 2x the largest file size

### Processing Speed
- Encoding: < 5 seconds for projects with 100 files
- Decoding: < 3 seconds for same project size
- Progress indication for operations > 1 second

## Security Considerations

### Data Integrity
- Multiple checksum layers prevent data corruption
- Fail-fast on any integrity violation
- Clear error messages for verification failures

### File Safety
- Never overwrite existing files without explicit confirmation
- Validate output paths to prevent directory traversal
- Respect file system permissions

## Testing Requirements

### Unit Tests
- Cryptic encoding/decoding round-trip
- Checksum generation and verification
- Binary file exclusion
- Ignore pattern respect
- Error condition handling

### Integration Tests
- End-to-end CLI workflow
- Large project handling
- Cross-platform path handling
- Memory usage validation

## Backward Compatibility

- Existing `snapshot`/`restore` commands remain unchanged
- New cryptic functionality is additive
- Shared utilities maintain existing interfaces
- No breaking changes to current API

## Future Extensions

### Potential Enhancements
- Encryption support (AES-256)
- Multiple compression algorithms
- Selective file inclusion/exclusion
- Incremental snapshot support
- Cloud storage integration

### Version Management
- Format version headers for future compatibility
- Migration utilities for format upgrades
- Deprecation paths for older formats