const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

/**
 * Decodes a cryptic snapshot and optionally restores files
 * @param {string} crypticContent - The cryptic snapshot content
 * @param {string} outputDir - Output directory for restored files
 * @param {boolean} [verifyOnly=false] - If true, only verify integrity without writing
 * @param {Function} [onProgress] - Optional progress callback (current, total)
 * @returns {Object} { restoredCount: number, files: string[], verified: boolean }
 */
function crypticDecoder(crypticContent, outputDir, verifyOnly = false, onProgress) {
  // Parse header
  const headerEndIndex = crypticContent.indexOf('---HEADER-END---');
  if (headerEndIndex === -1) {
    throw new Error('Invalid cryptic file: missing header end marker');
  }

  const headerSection = crypticContent.substring(0, headerEndIndex);
  const dataSection = crypticContent.substring(headerEndIndex + '---HEADER-END---'.length).trim();

  // Validate version
  if (!headerSection.startsWith('CRYPTIC-SNAPSHOT-V1')) {
    throw new Error('Invalid cryptic file: unsupported version');
  }

  // Extract header values
  const globalChecksumMatch = headerSection.match(/GLOBAL-CHECKSUM:\s*([a-f0-9]{64})/i);
  if (!globalChecksumMatch) {
    throw new Error('Invalid cryptic file: missing global checksum');
  }
  const expectedGlobalChecksum = globalChecksumMatch[1];

  const fileCountMatch = headerSection.match(/FILE-COUNT:\s*(\d+)/i);
  const expectedFileCount = fileCountMatch ? parseInt(fileCountMatch[1], 10) : null;

  // Decode Base64
  let compressed;
  try {
    compressed = Buffer.from(dataSection, 'base64');
  } catch (err) {
    throw new Error('Invalid cryptic file: failed to decode base64 data');
  }

  // Decompress gzip
  let jsonString;
  try {
    jsonString = zlib.gunzipSync(compressed).toString('utf-8');
  } catch (err) {
    throw new Error('Invalid cryptic file: failed to decompress data');
  }

  // Parse JSON
  let payload;
  try {
    payload = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Invalid cryptic file: failed to parse JSON payload');
  }

  if (!payload.files || !Array.isArray(payload.files)) {
    throw new Error('Invalid cryptic file: missing files array');
  }

  // Validate file count
  if (expectedFileCount !== null && payload.files.length !== expectedFileCount) {
    throw new Error(`Invalid cryptic file: expected ${expectedFileCount} files, found ${payload.files.length}`);
  }

  const restoredFiles = [];
  const checksumParts = [];

  for (let i = 0; i < payload.files.length; i++) {
    const file = payload.files[i];

    // Decode content from Base64
    let content;
    try {
      content = Buffer.from(file.content, 'base64').toString('utf-8');
    } catch (err) {
      throw new Error(`Failed to decode content for file: ${file.path}`);
    }

    // Verify checksum
    const actualChecksum = crypto.createHash('sha256').update(content).digest('hex');
    if (actualChecksum !== file.checksum) {
      throw new Error(`Checksum mismatch for file: ${file.path}`);
    }

    checksumParts.push(`${file.path}:${file.checksum}`);

    if (!verifyOnly) {
      // Create directory structure
      const fullPath = path.join(outputDir, file.path);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    restoredFiles.push(file.path);

    if (onProgress) {
      onProgress(i + 1, payload.files.length);
    }
  }

  // Verify global checksum
  const actualGlobalChecksum = crypto.createHash('sha256')
    .update(checksumParts.join('\n'))
    .digest('hex');

  if (actualGlobalChecksum !== expectedGlobalChecksum) {
    throw new Error('Global checksum mismatch: snapshot may be corrupted');
  }

  return {
    restoredCount: restoredFiles.length,
    files: restoredFiles,
    verified: true
  };
}

module.exports = crypticDecoder;
