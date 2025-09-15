const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

/**
 * Creates a cryptic encoded snapshot of files
 * @param {string} startDir - Source directory path
 * @param {string[]} files - Array of relative file paths
 * @param {object} options - Encoding options
 * @param {object} [bar] - Progress bar instance
 * @returns {string} Cryptic encoded snapshot
 */
function crypticEncode(startDir, files, options = {}, bar = null) {
  const {
    maxSize = 1024 * 1024,
    skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.exe', '.dll', '.zip', '.tar', '.gz', '.mp4', '.mp3', '.ogg', '.mov', '.pdf', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.otf'],
    compressionLevel = 6
  } = options;

  const processedFiles = [];
  let totalOriginalSize = 0;

  for (const file of files) {
    const filePath = path.join(startDir, file);
    const ext = path.extname(file).toLowerCase();

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (error) {
      // Skip files that can't be accessed
      if (bar && typeof bar.increment === 'function') bar.increment();
      continue;
    }

    // Skip large files
    if (stats.size > maxSize) {
      if (bar && typeof bar.increment === 'function') bar.increment();
      continue;
    }

    // Skip binary files
    if (skipExtensions.includes(ext)) {
      if (bar && typeof bar.increment === 'function') bar.increment();
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      const encodedContent = Buffer.from(content).toString('base64');

      processedFiles.push({
        path: file,
        checksum: checksum,
        size: stats.size,
        content: encodedContent
      });

      totalOriginalSize += stats.size;
    } catch (error) {
      // Skip files that can't be read as text
    }

    if (bar && typeof bar.increment === 'function') bar.increment();
  }

  // Calculate global checksum
  const globalChecksum = calculateGlobalHash(processedFiles);

  // Create metadata
  const metadata = {
    version: '1.0',
    generated: new Date().toISOString(),
    source_directory: startDir,
    file_count: processedFiles.length,
    compression_level: compressionLevel,
    total_size_original: totalOriginalSize
  };

  // Create data structure
  const data = {
    metadata: metadata,
    files: processedFiles,
    global_checksum: globalChecksum
  };

  // Compress and encode
  const encodedData = compressAndEncode(data, compressionLevel);
  const compressedSize = Buffer.from(encodedData, 'base64').length;

  // Update metadata with compressed size
  data.metadata.total_size_compressed = compressedSize;

  // Recalculate with updated metadata
  const finalEncodedData = compressAndEncode(data, compressionLevel);

  // Create cryptic file format
  const header = [
    'CRYPTIC-SNAPSHOT-V1',
    `GLOBAL-CHECKSUM: ${globalChecksum}`,
    `COMPRESSION-LEVEL: ${compressionLevel}`,
    `FILE-COUNT: ${processedFiles.length}`,
    '---HEADER-END---'
  ].join('\n');

  return `${header}\n${finalEncodedData}`;
}

/**
 * Calculates a global hash for file integrity verification
 * @param {object[]} files - Array of file objects with path and checksum
 * @returns {string} SHA-256 hash in hex format
 */
function calculateGlobalHash(files) {
  const hashInput = files
    .map(file => `${file.path}:${file.checksum}`)
    .join('\n');

  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Compresses JSON data with gzip and encodes as base64
 * @param {object} data - Data to compress and encode
 * @param {number} compressionLevel - Gzip compression level (1-9)
 * @returns {string} Base64 encoded compressed data
 */
function compressAndEncode(data, compressionLevel) {
  if (compressionLevel < 1 || compressionLevel > 9) {
    throw new Error('Compression level must be between 1 and 9');
  }

  const jsonString = JSON.stringify(data);
  const compressed = zlib.gzipSync(Buffer.from(jsonString), { level: compressionLevel });
  return compressed.toString('base64');
}

/**
 * Detects if a file is likely binary based on content sampling
 * @param {string} filePath - Path to the file to check
 * @returns {boolean} True if file appears to be binary
 */
function detectBinaryFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);

    if (bytesRead === 0) return false;

    // Check for null bytes (common in binary files)
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return true;
    }

    // Check for high ratio of non-printable characters
    let nonPrintable = 0;
    for (let i = 0; i < bytesRead; i++) {
      const byte = buffer[i];
      if (byte < 9 || (byte > 13 && byte < 32) || byte === 127) {
        nonPrintable++;
      }
    }

    // If more than 30% non-printable, consider it binary
    return (nonPrintable / bytesRead) > 0.3;
  } catch (error) {
    // If we can't read the file, assume it's binary
    return true;
  }
}

/**
 * Generates SHA-256 checksum for file content
 * @param {string} content - File content as string
 * @returns {string} SHA-256 hash in hex format
 */
function generateFileChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

module.exports = {
  crypticEncode,
  calculateGlobalHash,
  compressAndEncode,
  detectBinaryFile,
  generateFileChecksum
};