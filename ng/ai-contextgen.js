#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const cliProgress = require('cli-progress');

const getIgnoreFilter = require('./src/getIgnoreFilter');
const listFiles = require('./src/listFiles');
const filesToMarkdown = require('./src/filesToMarkdown');
const markdownToFiles = require('./src/markdownToFiles');
const crypticEncoder = require('./src/crypticEncoder');
const crypticDecoder = require('./src/crypticDecoder');

// Create progress bar
function createProgressBar(format) {
  return new cliProgress.SingleBar({
    format: format || '{bar} | {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  }, cliProgress.Presets.shades_classic);
}

// Snapshot command (default)
async function snapshotCommand(options) {
  const inputDir = path.resolve(options.input);
  const outputFile = path.resolve(options.output);

  console.log(`Scanning directory: ${inputDir}`);

  // Create ignore filter
  const ignoreFilter = getIgnoreFilter(inputDir, outputFile);

  // List files with progress
  const scanBar = createProgressBar('Scanning | {bar} | {value} files found');
  scanBar.start(100, 0);

  const files = listFiles(inputDir, ignoreFilter, (count) => {
    scanBar.update(count);
  });

  scanBar.stop();
  console.log(`Found ${files.length} files to process`);

  // Generate markdown with progress
  const genBar = createProgressBar('Generating | {bar} | {percentage}% | {value}/{total} files');
  genBar.start(files.length, 0);

  const result = filesToMarkdown(inputDir, files, (current, total) => {
    genBar.update(current);
  });

  genBar.stop();

  // Write output
  fs.writeFileSync(outputFile, result.markdown, 'utf-8');

  console.log(`Snapshot created: ${outputFile}`);
  console.log(`Files processed: ${result.processedCount}`);
  console.log(`Global checksum: ${result.globalChecksum}`);
}

// Restore command
async function restoreCommand(markdownFile, options) {
  const inputFile = path.resolve(markdownFile);
  const outputDir = path.resolve(options.output);

  console.log(`Restoring from: ${inputFile}`);
  console.log(`Output directory: ${outputDir}`);

  // Read markdown file
  let content;
  try {
    content = fs.readFileSync(inputFile, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  // Create output directory if needed
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Count files for progress bar (rough estimate)
  const fileCount = (content.match(/## `/g) || []).length;

  const restoreBar = createProgressBar('Restoring | {bar} | {percentage}% | {value}/{total} files');
  restoreBar.start(fileCount || 1, 0);

  try {
    const result = markdownToFiles(content, outputDir, (current, total) => {
      restoreBar.setTotal(total);
      restoreBar.update(current);
    });

    restoreBar.stop();

    console.log(`Restored ${result.restoredCount} files`);
    console.log('Checksum verification: PASSED');
  } catch (err) {
    restoreBar.stop();
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Cryptic command
async function crypticCommand(options) {
  const inputDir = path.resolve(options.input);
  const outputFile = path.resolve(options.output);
  const compressionLevel = parseInt(options.compressionLevel, 10);

  console.log(`Scanning directory: ${inputDir}`);
  console.log(`Compression level: ${compressionLevel}`);

  // Create ignore filter
  const ignoreFilter = getIgnoreFilter(inputDir, outputFile);

  // List files with progress
  const scanBar = createProgressBar('Scanning | {bar} | {value} files found');
  scanBar.start(100, 0);

  const files = listFiles(inputDir, ignoreFilter, (count) => {
    scanBar.update(count);
  });

  scanBar.stop();
  console.log(`Found ${files.length} files to process`);

  // Encode with progress
  const encodeBar = createProgressBar('Encoding | {bar} | {percentage}% | {value}/{total} files');
  encodeBar.start(files.length, 0);

  const result = crypticEncoder(inputDir, files, compressionLevel, (current, total) => {
    encodeBar.update(current);
  });

  encodeBar.stop();

  // Write output
  fs.writeFileSync(outputFile, result.output, 'utf-8');

  console.log(`Cryptic snapshot created: ${outputFile}`);
  console.log(`Files processed: ${result.processedCount}`);
  console.log(`Global checksum: ${result.globalChecksum}`);
}

// Decrypt command
async function decryptCommand(crypticFile, options) {
  const inputFile = path.resolve(crypticFile);
  const outputDir = path.resolve(options.output);
  const verifyOnly = options.verifyOnly || false;

  console.log(`Decrypting: ${inputFile}`);
  if (verifyOnly) {
    console.log('Mode: Verify only');
  } else {
    console.log(`Output directory: ${outputDir}`);
  }

  // Read cryptic file
  let content;
  try {
    content = fs.readFileSync(inputFile, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  // Create output directory if needed (unless verify only)
  if (!verifyOnly && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Extract file count from header for progress bar
  const fileCountMatch = content.match(/FILE-COUNT:\s*(\d+)/i);
  const fileCount = fileCountMatch ? parseInt(fileCountMatch[1], 10) : 1;

  const decodeBar = createProgressBar('Decoding | {bar} | {percentage}% | {value}/{total} files');
  decodeBar.start(fileCount, 0);

  try {
    const result = crypticDecoder(content, outputDir, verifyOnly, (current, total) => {
      decodeBar.setTotal(total);
      decodeBar.update(current);
    });

    decodeBar.stop();

    if (verifyOnly) {
      console.log(`Verified ${result.restoredCount} files`);
    } else {
      console.log(`Restored ${result.restoredCount} files`);
    }
    console.log('Checksum verification: PASSED');
  } catch (err) {
    decodeBar.stop();
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Setup CLI
program
  .name('ai-contextgen')
  .description('CLI utility to generate Markdown snapshots of codebases for AI context sharing')
  .version('2.0.0');

// Default snapshot command
program
  .command('snapshot', { isDefault: true })
  .description('Generate a Markdown snapshot of the directory')
  .option('-i, --input <folder>', 'Input directory to scan', '.')
  .option('-o, --output <filename>', 'Output filename', '__aicontextgen.md')
  .action(snapshotCommand);

// Restore command
program
  .command('restore <markdown>')
  .description('Restore files from a Markdown snapshot')
  .option('-o, --output <folder>', 'Target directory', '.')
  .action(restoreCommand);

// Cryptic command
program
  .command('cryptic')
  .description('Generate a compressed, encoded snapshot')
  .option('-i, --input <folder>', 'Input directory to scan', '.')
  .option('-o, --output <filename>', 'Output filename', '__aicontextgen.cryptic')
  .option('-c, --compression-level <level>', 'Gzip compression level (1-9)', '6')
  .action(crypticCommand);

// Decrypt command
program
  .command('decrypt <cryptic-file>')
  .description('Restore or verify a cryptic snapshot')
  .option('-o, --output <folder>', 'Target directory', './decoded')
  .option('-v, --verify-only', 'Verify integrity without writing files')
  .action(decryptCommand);

program.parse();
