const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Restores files from a Markdown snapshot
 * @param {string} markdownContent - The Markdown snapshot content
 * @param {string} outputDir - Output directory for restored files
 * @param {Function} [onProgress] - Optional progress callback (current, total)
 * @returns {Object} { restoredCount: number, files: string[] }
 */
function markdownToFiles(markdownContent, outputDir, onProgress) {
  // Normalize line endings for consistent parsing
  const content = markdownContent.replace(/\r\n/g, '\n');

  // Extract global checksum from footer
  const globalChecksumMatch = content.match(/Global checksum:\s*([a-f0-9]{64})/i);
  if (!globalChecksumMatch) {
    throw new Error('Invalid snapshot: missing global checksum');
  }
  const expectedGlobalChecksum = globalChecksumMatch[1];

  // Regex to match file blocks
  // Matches: ## `path` (checksum: hash)\n\n```lang\ncontent\n```
  const fileBlockRegex = /## `([^`]+)` \(checksum: ([a-f0-9]{64})\)\n\n```[^\n]*\n([\s\S]*?)\n```/g;

  const files = [];
  const checksumParts = [];
  let match;

  // Find all file blocks
  while ((match = fileBlockRegex.exec(content)) !== null) {
    const filePath = match[1];
    const expectedChecksum = match[2];
    const fileContent = match[3];

    files.push({
      path: filePath,
      content: fileContent,
      checksum: expectedChecksum
    });
  }

  if (files.length === 0) {
    throw new Error('Invalid snapshot: no files found');
  }

  // Verify and write files
  const restoredFiles = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Calculate checksum of content
    const actualChecksum = crypto.createHash('sha256')
      .update(file.content)
      .digest('hex');

    // Verify individual file checksum
    if (actualChecksum !== file.checksum) {
      throw new Error(`Checksum mismatch for file: ${file.path}`);
    }

    checksumParts.push(`${file.path}:${file.checksum}`);

    // Create directory structure
    const fullPath = path.join(outputDir, file.path);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(fullPath, file.content, 'utf-8');
    restoredFiles.push(file.path);

    if (onProgress) {
      onProgress(i + 1, files.length);
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
    files: restoredFiles
  };
}

module.exports = markdownToFiles;
