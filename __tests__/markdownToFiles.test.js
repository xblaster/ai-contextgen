const mock = require('mock-fs');
const fs = require('fs');
const markdownToFiles = require('../src/markdownToFiles');
const crypto = require('crypto');

describe('markdownToFiles', () => {
  afterEach(() => mock.restore());

  test('creates directories and overwrites files from markdown snapshot', () => {
    const hashA = crypto.createHash('sha256').update('new content').digest('hex');
    const hashB = crypto.createHash('sha256').update('hello').digest('hex');
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '---',
      '',
      `## \`a.txt\` (checksum: ${hashA})`,
      '',
      '```txt',
      'new content',
      '```',
      '',
      '---',
      '',
      `## \`sub/b.txt\` (checksum: ${hashB})`,
      '',
      '```txt',
      'hello',
      '```',
      ''
    ].join('\n');

    mock({
      '/out': {
        'a.txt': 'old'
      }
    });

    markdownToFiles(md, '/out');

    expect(fs.readFileSync('/out/a.txt', 'utf8')).toBe('new content');
    expect(fs.readFileSync('/out/sub/b.txt', 'utf8')).toBe('hello');
  });

  test('handles CRLF line endings', () => {
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '---',
      '',
      '## `a.txt`',
      '',
      '```txt',
      'content',
      '```',
      '',
      '---',
      ''
    ].join('\r\n');

    mock({ '/out': {} });
    markdownToFiles(md, '/out');
    expect(fs.readFileSync('/out/a.txt', 'utf8')).toBe('content');
  });

  test('throws error on checksum mismatch', () => {
    const hash = crypto.createHash('sha256').update('good').digest('hex');
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '---',
      '',
      `## \`a.txt\` (checksum: ${hash})`,
      '',
      '```txt',
      'bad',
      '```',
      '',
      '---',
      ''
    ].join('\n');

    mock({ '/out': {} });
    expect(() => markdownToFiles(md, '/out')).toThrow('Checksum mismatch');
  });
});
