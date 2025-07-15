const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function markdownToFiles(markdown, targetDir, bar) {
  const regex = /## `([^`]+)`(?: \(checksum: ([^\)]+)\))?\r?\n\r?\n```[^\n]*\r?\n([\s\S]*?)\r?\n```/g;
  const matches = [...markdown.matchAll(regex)];
  for (const match of matches) {
    const rel = match[1];
    const checksum = match[2];
    const content = match[3];
    if (checksum) {
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      if (hash !== checksum) {
        throw new Error(`Checksum mismatch for ${rel}`);
      }
    }
    const filePath = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    if (bar && typeof bar.increment === 'function') bar.increment();
  }
  return matches.length;
}

module.exports = markdownToFiles;
