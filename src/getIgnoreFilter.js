const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

function getIgnoreFilter(baseDir, outputFilename) {
  const ig = ignore();
  const gitignorePath = path.join(baseDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    ig.add(content.split(/\r?\n/));
  }
  const aiIgnorePath = path.join(baseDir, '.ai-ignore');
  if (fs.existsSync(aiIgnorePath)) {
    const content = fs.readFileSync(aiIgnorePath, 'utf8');
    ig.add(content.split(/\r?\n/));
  }
  ig.add('.git/');
  if (outputFilename) {
    ig.add(outputFilename);
  }
  return ig;
}

module.exports = getIgnoreFilter;
