const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

/**
 * Creates an ignore filter based on .gitignore, .ai-ignore, and default patterns
 * @param {string} baseDir - Base directory to look for ignore files
 * @param {string} outputFilename - Output filename to ignore
 * @returns {Object} Ignore filter instance
 */
function getIgnoreFilter(baseDir, outputFilename) {
  const ig = ignore();

  // Always ignore .git directory
  ig.add('.git/');

  // Ignore the output filename
  if (outputFilename) {
    const relativePath = path.relative(baseDir, outputFilename);
    if (relativePath && !relativePath.startsWith('..')) {
      ig.add(relativePath);
    } else {
      ig.add(path.basename(outputFilename));
    }
  }

  // Load .gitignore if present
  const gitignorePath = path.join(baseDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    } catch (err) {
      // Silently ignore read errors
    }
  }

  // Load .ai-ignore if present
  const aiIgnorePath = path.join(baseDir, '.ai-ignore');
  if (fs.existsSync(aiIgnorePath)) {
    try {
      const aiIgnoreContent = fs.readFileSync(aiIgnorePath, 'utf-8');
      ig.add(aiIgnoreContent);
    } catch (err) {
      // Silently ignore read errors
    }
  }

  return ig;
}

module.exports = getIgnoreFilter;
