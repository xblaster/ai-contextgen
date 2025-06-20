const fs = require('fs');
const path = require('path');

function listFiles(dir, base, ig, bar) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath);
    if (ig && ig.ignores(relPath.replace(/\\/g, '/'))) {
      continue;
    }
    if (entry.isDirectory()) {
      results = results.concat(listFiles(fullPath, base, ig, bar));
    } else {
      results.push(relPath.replace(/\\/g, '/'));
      if (bar && typeof bar.increment === 'function') {
        bar.increment();
      }
    }
  }
  return results;
}

module.exports = listFiles;
