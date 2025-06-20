#!/usr/bin/env node
/*
 * AI-ContextGen
 * Generates a Markdown snapshot of your codebase or restores files
 * from a snapshot. Respects .gitignore and .ai-ignore and skips large
 * or binary files.
 */

const fs = require('fs');
const path = require('path');
const getIgnoreFilter = require('./src/getIgnoreFilter');
const listFiles = require('./src/listFiles');
const filesToMarkdown = require('./src/filesToMarkdown');
const markdownToFiles = require('./src/markdownToFiles');
const { Command } = require('commander');
const cliProgress = require('cli-progress');

const MAX_SIZE = 1024 * 1024; // 1MB
const SKIP_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.ico', '.exe', '.dll', '.zip', '.tar', '.gz',
  '.mp4', '.mp3', '.ogg', '.mov', '.pdf', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf'
];

function snapshotMain(startDir, outputFile) {
  startDir = path.resolve(startDir);
  if (!fs.existsSync(startDir) || !fs.statSync(startDir).isDirectory()) {
    console.error(`Error: Input folder does not exist or is not a directory: ${startDir}`);
    process.exit(1);
  }

  const ig = getIgnoreFilter(startDir, outputFile);
  let totalCount = 0;
  function countEntries(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(startDir, fullPath);
      if (ig.ignores(relPath.replace(/\\/g, '/'))) continue;
      if (entry.isDirectory()) {
        countEntries(fullPath);
      } else {
        totalCount++;
      }
    }
  }
  countEntries(startDir);
  console.log(`Found ${totalCount} files to snapshot.`);

  console.log(`Scanning files in ${startDir} (skipping per .gitignore, .ai-ignore, .git/, and config)...`);
  const barList = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  barList.start(totalCount, 0);
  const files = listFiles(startDir, startDir, ig, barList);
  barList.stop();

  console.log(`\nGenerating markdown output for ${files.length} files...`);
  const barRead = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  barRead.start(files.length, 0);
  const markdown = filesToMarkdown(startDir, files, { maxSize: MAX_SIZE, skipExtensions: SKIP_EXTENSIONS }, barRead);
  barRead.stop();

  fs.writeFileSync(path.join(startDir, outputFile), markdown, 'utf8');
  console.log(`\nAI-ContextGen: Snapshot saved to ${path.join(startDir, outputFile)}`);
}

function restoreMain(markdownPath, outputDir) {
  const mdPath = path.resolve(markdownPath);
  outputDir = path.resolve(outputDir);
  if (!fs.existsSync(mdPath)) {
    console.error(`Error: Markdown file does not exist: ${mdPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(mdPath, 'utf8');
  const regex = /## `([^`]+)`\r?\n\r?\n```[^\n]*\r?\n([\s\S]*?)\r?\n```/g;
  const files = [...content.matchAll(regex)];
  console.log(`Restoring ${files.length} files to ${outputDir}...`);
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(files.length, 0);
  markdownToFiles(content, outputDir, bar);
  bar.stop();
  console.log('AI-ContextGen: Restoration complete');
}

const program = new Command();
program
  .name('ai-contextgen')
  .description('Generate or restore project snapshots');

program.command('snapshot', { isDefault: true })
  .description('Create a Markdown snapshot of your project folder')
  .option('-i, --input <folder>', 'Input folder to scan', '.')
  .option('-o, --output <filename>', 'Output markdown filename', '__aicontextgen.md')
  .action(opts => snapshotMain(opts.input, opts.output));

program.command('restore <markdown>')
  .description('Recreate files from a Markdown snapshot')
  .option('-o, --output <folder>', 'Target folder', '.')
  .action((markdown, opts) => restoreMain(markdown, opts.output));

program.parse(process.argv);

module.exports = {
  getIgnoreFilter,
  listFiles,
  filesToMarkdown,
  markdownToFiles,
  snapshotMain,
  restoreMain,
};
