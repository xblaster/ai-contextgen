const fs = require('fs');
const path = require('path');

function markdownToFiles(markdown, targetDir) {
  const regex = /## `([^`]+)`\n\n```[^\n]*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const rel = match[1];
    const content = match[2];
    const filePath = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

module.exports = markdownToFiles;
