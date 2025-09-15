const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

/**
 * Decodes a cryptic file and restores the original files
 * @param {string} crypticFilePath - Path to the cryptic file
 * @param {string} outputDir - Directory to restore files to
 * @param {object} [options] - Decoding options
 * @param {object} [bar] - Progress bar instance
 * @returns {object} Decoding result with metadata
 */
async function crypticDecode(crypticFilePath, outputDir, options = {}, bar = null) {
  const { verifyOnly = false } = options;

  // Read and validate cryptic file
  if (!fs.existsSync(crypticFilePath)) {
    throw new Error(`Cryptic file not found: ${crypticFilePath}`);
  }

  const crypticContent = fs.readFileSync(crypticFilePath, 'utf8');
  const { header, encodedData } = parseCrypticFile(crypticContent);

  // Decode and decompress data
  const decodedData = decodeAndDecompress(encodedData);

  // Verify integrity
  verifyIntegrity(decodedData);

  // Verify header consistency
  verifyHeaderConsistency(header, decodedData);

  if (verifyOnly) {
    return {
      isValid: true,
      fileCount: decodedData.files.length,
      metadata: decodedData.metadata,
      globalChecksum: decodedData.global_checksum
    };
  }

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Restore files
  let restoredCount = 0;
  for (const fileInfo of decodedData.files) {
    const targetPath = path.join(outputDir, fileInfo.path);
    const targetDir = path.dirname(targetPath);

    // Create directory structure
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Decode and write file content
    const content = Buffer.from(fileInfo.content, 'base64').toString('utf8');

    // Verify file checksum before writing
    const actualChecksum = crypto.createHash('sha256').update(content).digest('hex');
    if (actualChecksum !== fileInfo.checksum) {
      throw new Error(`Checksum verification failed for ${fileInfo.path}`);
    }

    fs.writeFileSync(targetPath, content, 'utf8');
    restoredCount++;

    if (bar && typeof bar.increment === 'function') bar.increment();
  }

  return {
    isValid: true,
    filesRestored: restoredCount,
    metadata: decodedData.metadata,
    globalChecksum: decodedData.global_checksum
  };
}

/**
 * Parses a cryptic file and extracts header and encoded data
 * @param {string} content - Raw cryptic file content
 * @returns {object} Object with header and encodedData
 */
function parseCrypticFile(content) {
  const lines = content.split('\n');

  // Validate format
  if (lines[0] !== 'CRYPTIC-SNAPSHOT-V1') {
    throw new Error('Invalid cryptic file format: missing or incorrect version header');
  }

  // Find header end
  let headerEndIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '---HEADER-END---') {
      headerEndIndex = i;
      break;
    }
  }

  if (headerEndIndex === -1) {
    throw new Error('Invalid cryptic file format: missing header end marker');
  }

  // Parse header
  const header = {};
  for (let i = 1; i < headerEndIndex; i++) {
    const line = lines[i];
    const colonIndex = line.indexOf(': ');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 2);

    switch (key) {
      case 'GLOBAL-CHECKSUM':
        header.globalChecksum = value;
        break;
      case 'COMPRESSION-LEVEL':
        header.compressionLevel = parseInt(value, 10);
        break;
      case 'FILE-COUNT':
        header.fileCount = parseInt(value, 10);
        break;
    }
  }

  // Validate required header fields
  if (!header.globalChecksum || !header.compressionLevel || header.fileCount === undefined) {
    throw new Error('Invalid cryptic file format: missing required header fields');
  }

  // Extract encoded data
  const encodedData = lines.slice(headerEndIndex + 1).join('\n').trim();
  if (!encodedData) {
    throw new Error('Invalid cryptic file format: missing encoded data');
  }

  return { header, encodedData };
}

/**
 * Verifies the integrity of decoded data
 * @param {object} data - Decoded data object
 * @throws {Error} If verification fails
 */
function verifyIntegrity(data) {
  if (!data.metadata || !data.files || !data.global_checksum) {
    throw new Error('Invalid data structure: missing required fields');
  }

  // Verify file count
  if (data.files.length !== data.metadata.file_count) {
    throw new Error(`File count mismatch: expected ${data.metadata.file_count}, got ${data.files.length}`);
  }

  // Verify individual file checksums
  for (const fileInfo of data.files) {
    const content = Buffer.from(fileInfo.content, 'base64').toString('utf8');
    const actualChecksum = crypto.createHash('sha256').update(content).digest('hex');

    if (actualChecksum !== fileInfo.checksum) {
      throw new Error(`File checksum mismatch for ${fileInfo.path}: expected ${fileInfo.checksum}, got ${actualChecksum}`);
    }
  }

  // Verify global checksum
  const calculatedGlobalChecksum = calculateGlobalChecksum(data.files);
  if (calculatedGlobalChecksum !== data.global_checksum) {
    throw new Error(`Global checksum verification failed: expected ${data.global_checksum}, got ${calculatedGlobalChecksum}`);
  }
}

/**
 * Verifies consistency between header and decoded data
 * @param {object} header - Parsed header object
 * @param {object} data - Decoded data object
 * @throws {Error} If inconsistency found
 */
function verifyHeaderConsistency(header, data) {
  if (header.fileCount !== data.files.length) {
    throw new Error(`Header file count mismatch: header says ${header.fileCount}, data has ${data.files.length}`);
  }

  if (header.globalChecksum !== data.global_checksum) {
    throw new Error(`Header global checksum mismatch: header says ${header.globalChecksum}, data says ${data.global_checksum}`);
  }

  if (header.compressionLevel !== data.metadata.compression_level) {
    throw new Error(`Header compression level mismatch: header says ${header.compressionLevel}, data says ${data.metadata.compression_level}`);
  }
}

/**
 * Calculates global checksum for file verification
 * @param {object[]} files - Array of file objects
 * @returns {string} SHA-256 hash in hex format
 */
function calculateGlobalChecksum(files) {
  const hashInput = files
    .map(file => `${file.path}:${file.checksum}`)
    .join('\n');

  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Decodes base64 and decompresses gzipped data
 * @param {string} encodedData - Base64 encoded gzipped data
 * @returns {object} Parsed JSON data
 * @throws {Error} If decoding or decompression fails
 */
function decodeAndDecompress(encodedData) {
  try {
    // Decode base64
    const compressedBuffer = Buffer.from(encodedData, 'base64');

    // Decompress gzip
    const decompressedBuffer = zlib.gunzipSync(compressedBuffer);

    // Parse JSON
    const jsonString = decompressedBuffer.toString('utf8');
    return JSON.parse(jsonString);
  } catch (error) {
    if (error.message.includes('incorrect header check')) {
      throw new Error('Invalid compressed data: not a valid gzip stream');
    } else if (error.message.includes('Invalid character')) {
      throw new Error('Invalid base64 encoding');
    } else if (error.message.includes('Unexpected token')) {
      throw new Error('Invalid JSON data after decompression');
    } else {
      throw new Error(`Decoding failed: ${error.message}`);
    }
  }
}

/**
 * Validates cryptic file format without full decoding
 * @param {string} crypticFilePath - Path to cryptic file
 * @returns {object} Basic validation result
 */
function validateCrypticFormat(crypticFilePath) {
  try {
    if (!fs.existsSync(crypticFilePath)) {
      return { isValid: false, error: 'File not found' };
    }

    const content = fs.readFileSync(crypticFilePath, 'utf8');
    const { header, encodedData } = parseCrypticFile(content);

    // Basic format validation passed
    return {
      isValid: true,
      fileCount: header.fileCount,
      compressionLevel: header.compressionLevel,
      globalChecksum: header.globalChecksum,
      hasEncodedData: encodedData.length > 0
    };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
}

module.exports = {
  crypticDecode,
  verifyIntegrity,
  decodeAndDecompress,
  parseCrypticFile,
  validateCrypticFormat,
  calculateGlobalChecksum,
  verifyHeaderConsistency
};