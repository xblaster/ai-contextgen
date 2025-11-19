const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Binary file extensions to skip
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.exe', '.dll', '.zip', '.tar', '.gz',
  '.mp4', '.mp3', '.ogg', '.mov',
  '.pdf', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf'
]);

// Maximum file size (1MB)
const MAX_SIZE = 1024 * 1024;

/**
 * Creates a cryptic (compressed + encoded) snapshot
 * @param {string} baseDir - Base directory containing files
 * @param {string[]} files - Array of relative file paths
 * @param {number} [compressionLevel=6] - Gzip compression level (1-9)
 * @param {Function} [onProgress] - Optional progress callback (current, total)
 * @returns {Object} { output: string, globalChecksum: string, processedCount: number }
 */
function crypticEncoder(baseDir, files, compressionLevel = 6, onProgress) {
  const fileEntries = [];
  const checksumParts = [];
  let processedCount = 0;
  let totalOriginalSize = 0;

  for (let i = 0; i < files.length; i++) {
    const relativePath = files[i];
    const fullPath = path.join(baseDir, relativePath);
    const ext = path.extname(relativePath).toLowerCase();

    // Skip binary files
    if (BINARY_EXTENSIONS.has(ext)) {
      if (onProgress) onProgress(i + 1, files.length);
      continue;
    }

    // Check file size
    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch (err) {
      if (onProgress) onProgress(i + 1, files.length);
      continue;
    }

    if (stats.size > MAX_SIZE) {
      if (onProgress) onProgress(i + 1, files.length);
      continue;
    }

    // Read file content
    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch (err) {
      if (onProgress) onProgress(i + 1, files.length);
      continue;
    }

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(content).digest('hex');
    checksumParts.push(`${relativePath}:${checksum}`);

    // Encode content as Base64
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    fileEntries.push({
      path: relativePath,
      checksum: checksum,
      size: stats.size,
      content: base64Content
    });

    totalOriginalSize += stats.size;
    processedCount++;
    if (onProgress) onProgress(i + 1, files.length);
  }

  // Calculate global checksum
  const globalChecksum = crypto.createHash('sha256')
    .update(checksumParts.join('\n'))
    .digest('hex');

  // Build JSON payload
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    originalSize: totalOriginalSize,
    files: fileEntries
  };

  const jsonString = JSON.stringify(payload);

  // Compress with gzip
  const compressed = zlib.gzipSync(jsonString, { level: compressionLevel });

  // Encode as Base64
  const encodedData = compressed.toString('base64');

  // Build header
  const header = [
    'CRYPTIC-SNAPSHOT-V1',
    `GLOBAL-CHECKSUM: ${globalChecksum}`,
    `COMPRESSION-LEVEL: ${compressionLevel}`,
    `FILE-COUNT: ${processedCount}`,
    '---HEADER-END---'
  ].join('\n');

  // Combine header and data
  const output = header + '\n' + encodedData;

  return {
    output,
    globalChecksum,
    processedCount
  };
}

module.exports = crypticEncoder;
