const mock = require('mock-fs');
const fs = require('fs');
const markdownToFiles = require('../src/markdownToFiles');

describe('markdownToFiles', () => {
  afterEach(() => mock.restore());

  test('creates directories and overwrites files from markdown snapshot', () => {
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '---',
      '',
      '## `a.txt`',
      '',
      '```txt',
      'new content',
      '```',
      '',
      '---',
      '',
      '## `sub/b.txt`',
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
});
