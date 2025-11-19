const fs = require('fs');
const path = require('path');

/**
 * Recursively lists all files in a directory, respecting ignore patterns
 * @param {string} baseDir - Base directory to scan
 * @param {Object} ignoreFilter - Ignore filter instance from getIgnoreFilter
 * @param {Function} [onProgress] - Optional progress callback (currentCount)
 * @returns {string[]} Array of relative file paths
 */
function listFiles(baseDir, ignoreFilter, onProgress) {
  const files = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      // Skip directories we can't read
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      // Check if path should be ignored
      if (ignoreFilter.ignores(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Check directory with trailing slash
        if (!ignoreFilter.ignores(relativePath + '/')) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        files.push(relativePath);
        if (onProgress) {
          onProgress(files.length);
        }
      }
    }
  }

  walk(baseDir);
  return files;
}

module.exports = listFiles;
