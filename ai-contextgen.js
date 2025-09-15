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
const crypticEncoder = require('./src/crypticEncoder');
const crypticDecoder = require('./src/crypticDecoder');
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
  const files = listFiles(startDir, startDir, ig, barList).sort();
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
  const regex = /## `([^`]+)`(?: \(checksum: ([^\)]+)\))?\r?\n\r?\n```[^\n]*\r?\n([\s\S]*?)\r?\n```(?=\r?\n\r?\n###==AICG_FILE==###)/g;
  const files = [...content.matchAll(regex)];
  console.log(`Restoring ${files.length} files to ${outputDir}...`);
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(files.length, 0);
  markdownToFiles(content, outputDir, bar);
  bar.stop();
  console.log('AI-ContextGen: Restoration complete');
}

function crypticMain(startDir, outputFile, compressionLevel) {
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
  console.log(`Found ${totalCount} files to encode cryptically.`);

  console.log(`Scanning files in ${startDir} (skipping per .gitignore, .ai-ignore, .git/, and config)...`);
  const barList = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  barList.start(totalCount, 0);
  const files = listFiles(startDir, startDir, ig, barList).sort();
  barList.stop();

  console.log(`\nGenerating cryptic encoded output for ${files.length} files...`);
  const barEncode = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  barEncode.start(files.length, 0);
  const crypticData = crypticEncoder.crypticEncode(startDir, files, {
    maxSize: MAX_SIZE,
    skipExtensions: SKIP_EXTENSIONS,
    compressionLevel: compressionLevel
  }, barEncode);
  barEncode.stop();

  fs.writeFileSync(path.join(startDir, outputFile), crypticData, 'utf8');
  console.log(`\nAI-ContextGen: Cryptic snapshot saved to ${path.join(startDir, outputFile)}`);
}

async function decryptMain(crypticPath, outputDir, verifyOnly) {
  const crypticFilePath = path.resolve(crypticPath);
  outputDir = path.resolve(outputDir);

  if (!fs.existsSync(crypticFilePath)) {
    console.error(`Error: Cryptic file does not exist: ${crypticFilePath}`);
    process.exit(1);
  }

  try {
    if (verifyOnly) {
      console.log('Verifying cryptic file integrity...');
      const result = await crypticDecoder.crypticDecode(crypticFilePath, outputDir, { verifyOnly: true });
      console.log(`✓ File integrity verified successfully`);
      console.log(`✓ File count: ${result.fileCount}`);
      console.log(`✓ Global checksum: ${result.globalChecksum}`);
      console.log(`✓ Generated: ${result.metadata.generated}`);
      console.log(`✓ Original size: ${(result.metadata.total_size_original / 1024).toFixed(1)} KB`);
      console.log(`✓ Compressed size: ${(result.metadata.total_size_compressed / 1024).toFixed(1)} KB`);
      console.log(`✓ Compression ratio: ${(100 - (result.metadata.total_size_compressed / result.metadata.total_size_original) * 100).toFixed(1)}%`);
    } else {
      console.log(`Decoding cryptic file to ${outputDir}...`);

      // First get file count for progress bar
      const validation = crypticDecoder.validateCrypticFormat(crypticFilePath);
      if (!validation.isValid) {
        console.error(`Error: ${validation.error}`);
        process.exit(1);
      }

      const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
      bar.start(validation.fileCount, 0);

      const result = await crypticDecoder.crypticDecode(crypticFilePath, outputDir, {}, bar);
      bar.stop();

      console.log(`\nAI-ContextGen: Successfully restored ${result.filesRestored} files`);
      console.log(`✓ All checksums verified`);
      console.log(`✓ Compression ratio: ${(100 - (result.metadata.total_size_compressed / result.metadata.total_size_original) * 100).toFixed(1)}%`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
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

program.command('cryptic')
  .description('Create a cryptic base64 encoded snapshot of your project folder')
  .option('-i, --input <folder>', 'Input folder to scan', '.')
  .option('-o, --output <filename>', 'Output cryptic filename', '__aicontextgen.cryptic')
  .option('-c, --compression-level <level>', 'Gzip compression level 1-9', '6')
  .action(opts => {
    const compressionLevel = parseInt(opts.compressionLevel, 10);
    if (isNaN(compressionLevel) || compressionLevel < 1 || compressionLevel > 9) {
      console.error('Error: Compression level must be between 1 and 9');
      process.exit(1);
    }
    crypticMain(opts.input, opts.output, compressionLevel);
  });

program.command('decrypt <cryptic-file>')
  .description('Decode and restore files from a cryptic snapshot')
  .option('-o, --output <folder>', 'Target directory', './decoded')
  .option('-v, --verify-only', 'Only verify integrity without extracting')
  .action((crypticFile, opts) => decryptMain(crypticFile, opts.output, opts.verifyOnly));

program.parse(process.argv);

module.exports = {
  getIgnoreFilter,
  listFiles,
  filesToMarkdown,
  markdownToFiles,
  crypticEncoder,
  crypticDecoder,
  snapshotMain,
  restoreMain,
  crypticMain,
  decryptMain,
};
