const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function markdownToFiles(markdown, targetDir, bar) {
  const regex = /## `([^`]+)`(?: \(checksum: ([^\)]+)\))?\r?\n\r?\n```[^\n]*\r?\n([\s\S]*?)\r?\n```(?=\r?\n\r?\n###==AICG_FILE==###)/g;
  const matches = [...markdown.matchAll(regex)];
  const globalMatch = markdown.match(/Global checksum: ([a-f0-9]+)/);
  const expectedGlobal = globalMatch ? globalMatch[1] : null;
  const globalHash = crypto.createHash('sha256');
  for (const match of matches) {
    const rel = match[1];
    const checksum = match[2];
    const content = match[3];
    const rawHash = crypto.createHash('sha256').update(content).digest('hex');
    const normalizedHash = crypto
      .createHash('sha256')
      .update(content.replace(/\r\n/g, '\n'))
      .digest('hex');
    if (
      checksum &&
      rawHash !== checksum &&
      normalizedHash !== checksum
    ) {
      throw new Error(`Checksum mismatch for ${rel}`);
    }
    const hashForGlobal = checksum || rawHash;
    globalHash.update(`${rel}:${hashForGlobal}\n`);
    const filePath = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    if (bar && typeof bar.increment === 'function') bar.increment();
  }
  if (expectedGlobal) {
    const computed = globalHash.digest('hex');
    if (computed !== expectedGlobal) {
      throw new Error('Global checksum mismatch');
    }
  }
  return matches.length;
}

module.exports = markdownToFiles;
