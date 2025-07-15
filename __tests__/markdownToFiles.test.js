const mock = require('mock-fs');
const fs = require('fs');
const markdownToFiles = require('../src/markdownToFiles');
const crypto = require('crypto');

describe('markdownToFiles', () => {
  afterEach(() => mock.restore());

  test('creates directories and overwrites files from markdown snapshot', () => {
    const hashA = crypto.createHash('sha256').update('new content').digest('hex');
    const hashB = crypto.createHash('sha256').update('hello').digest('hex');
    const globalHash = crypto.createHash('sha256');
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '###==AICG_FILE==###',
      '',
      `## \`a.txt\` (checksum: ${hashA})`,
      '',
      '```txt',
      'new content',
      '```',
      '',
      '###==AICG_FILE==###',
      '',
      `## \`sub/b.txt\` (checksum: ${hashB})`,
      '',
      '```txt',
      'hello',
      '```',
      '',
      '###==AICG_FILE==###',
      ''
    ].join('\n');
    globalHash.update(`a.txt:${hashA}\n`);
    globalHash.update(`sub/b.txt:${hashB}\n`);
    const overall = globalHash.digest('hex');
    const mdWithChecksum = md + `\nGlobal checksum: ${overall}\n`;

    mock({
      '/out': {
        'a.txt': 'old'
      }
    });

    markdownToFiles(mdWithChecksum, '/out');

    expect(fs.readFileSync('/out/a.txt', 'utf8')).toBe('new content');
    expect(fs.readFileSync('/out/sub/b.txt', 'utf8')).toBe('hello');
  });

  test('handles CRLF line endings', () => {
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '###==AICG_FILE==###',
      '',
      '## `a.txt`',
      '',
      '```txt',
      'content',
      '```',
      '',
      '###==AICG_FILE==###',
      ''
    ].join('\r\n');

    mock({ '/out': {} });
    markdownToFiles(md, '/out');
    expect(fs.readFileSync('/out/a.txt', 'utf8')).toBe('content');
  });

  test('restores with checksum despite CRLF conversion', () => {
    const content = 'line1\nline2';
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '###==AICG_FILE==###',
      '',
      `## \`a.txt\` (checksum: ${hash})`,
      '',
      '```txt',
      content,
      '```',
      '',
      '###==AICG_FILE==###',
      '',
    ].join('\n');
    const globalHash = crypto
      .createHash('sha256')
      .update(`a.txt:${hash}\n`)
      .digest('hex');
    const mdLF = md + `\nGlobal checksum: ${globalHash}\n`;
    const mdCRLF = mdLF.replace(/\n/g, '\r\n');

    mock({ '/out': {} });
    markdownToFiles(mdCRLF, '/out');
    expect(fs.readFileSync('/out/a.txt', 'utf8')).toBe(content.replace(/\n/g, '\r\n'));
  });

  test('throws error on checksum mismatch', () => {
    const hash = crypto.createHash('sha256').update('good').digest('hex');
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '###==AICG_FILE==###',
      '',
      `## \`a.txt\` (checksum: ${hash})`,
      '',
      '```txt',
      'bad',
      '```',
      '',
      '###==AICG_FILE==###',
      ''
    ].join('\n');
    const globalHash = crypto.createHash('sha256').update(`a.txt:${hash}\n`).digest('hex');
    const mdWithChecksum = md + `\nGlobal checksum: ${globalHash}\n`;

    mock({ '/out': {} });
    expect(() => markdownToFiles(mdWithChecksum, '/out')).toThrow('Checksum mismatch');
  });

  test('throws error on global checksum mismatch', () => {
    const hash = crypto.createHash('sha256').update('content').digest('hex');
    const badGlobal = 'deadbeef';
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '###==AICG_FILE==###',
      '',
      `## \`a.txt\` (checksum: ${hash})`,
      '',
      '```txt',
      'content',
      '```',
      '',
      '###==AICG_FILE==###',
      ''
    ].join('\n');
    const mdWithChecksum = md + `\nGlobal checksum: ${badGlobal}\n`;

    mock({ '/out': {} });
    expect(() => markdownToFiles(mdWithChecksum, '/out')).toThrow('Global checksum mismatch');
  });

  test('restores file containing triple backticks', () => {
    const content = 'line1\n```\ncode\n```\nline2';
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const globalHash = crypto
      .createHash('sha256')
      .update(`a.md:${hash}\n`)
      .digest('hex');
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '###==AICG_FILE==###',
      '',
      `## \`a.md\` (checksum: ${hash})`,
      '',
      '```md',
      content,
      '```',
      '',
      '###==AICG_FILE==###',
      ''
    ].join('\n');
    const mdWithChecksum = md + `\nGlobal checksum: ${globalHash}\n`;

    mock({ '/out': {} });
    markdownToFiles(mdWithChecksum, '/out');
    expect(fs.readFileSync('/out/a.md', 'utf8')).toBe(content);
  });
});
