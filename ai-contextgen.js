#!/usr/bin/env node
/*
 * AI-ContextGen
 * Automatically generates a Markdown snapshot of your codebase,
 * respecting .gitignore and .ai-ignore, ALWAYS skipping .git directory, and skipping large/binary files.
 *
 * Usage:
 *   node AI-ContextGen.js --input ./folder --output snapshot.md
 */

const fs = require('fs');
const path = require('path');
const getIgnoreFilter = require('./src/getIgnoreFilter');
const listFiles = require('./src/listFiles');
const filesToMarkdown = require('./src/filesToMarkdown');
const { Command } = require('commander');
const cliProgress = require('cli-progress');

const program = new Command();

program
  .option('-i, --input <folder>', 'Input folder to scan', '.')
  .option('-o, --output <filename>', 'Output markdown filename', '__aicontextgen.md')
  .description('Generate a Markdown snapshot of your project folder for AI context, respecting .gitignore, .ai-ignore and skipping large/binary files.')
  .parse(process.argv);

// Show help if no args given
if (process.argv.length <= 2) {
  program.help();
}

const options = program.opts();
const START_DIR = path.resolve(options.input);
const OUTPUT_FILENAME = options.output;
const MAX_SIZE = 1024 * 1024; // 1MB

const SKIP_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.ico', '.exe', '.dll', '.zip', '.tar', '.gz',
  '.mp4', '.mp3', '.ogg', '.mov', '.pdf', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf'
];

async function main() {
  try {
    if (!fs.existsSync(START_DIR) || !fs.statSync(START_DIR).isDirectory()) {
      console.error(`Error: Input folder does not exist or is not a directory: ${START_DIR}`);
      process.exit(1);
    }

  const ig = getIgnoreFilter(START_DIR, OUTPUT_FILENAME);

    // First, count total entries to process for progress bar
    let totalCount = 0;
    function countEntries(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(START_DIR, fullPath);
        if (ig.ignores(relPath.replace(/\\/g, '/'))) continue;
        if (entry.isDirectory()) {
          countEntries(fullPath);
        } else {
          totalCount++;
        }
      }
    }
    countEntries(START_DIR);

    console.log(`Scanning files in ${START_DIR} (skipping per .gitignore, .ai-ignore, .git/, and config)...`);
    const barList = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    barList.start(totalCount, 0);
    const files = listFiles(START_DIR, START_DIR, ig, barList);
    barList.stop();

    console.log(`\nGenerating markdown output for ${files.length} files...`);
    const barRead = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    barRead.start(files.length, 0);
    const markdown = filesToMarkdown(START_DIR, files, { maxSize: MAX_SIZE, skipExtensions: SKIP_EXTENSIONS }, barRead);
    barRead.stop();

    fs.writeFileSync(path.join(START_DIR, OUTPUT_FILENAME), markdown, 'utf8');
    console.log(`\nAI-ContextGen: Snapshot saved to ${path.join(START_DIR, OUTPUT_FILENAME)}`);

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getIgnoreFilter,
  listFiles,
  filesToMarkdown,
};
