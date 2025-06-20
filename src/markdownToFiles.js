const fs = require('fs');
const path = require('path');

function markdownToFiles(markdown, targetDir, bar) {
  const regex = /## `([^`]+)`\r?\n\r?\n```[^\n]*\r?\n([\s\S]*?)\r?\n```/g;
  const matches = [...markdown.matchAll(regex)];
  for (const match of matches) {
    const rel = match[1];
    const content = match[2];
    const filePath = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    if (bar && typeof bar.increment === 'function') bar.increment();
  }
  return matches.length;
}

module.exports = markdownToFiles;
