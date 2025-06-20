const mock = require('mock-fs');
const filesToMarkdown = require('../src/filesToMarkdown');

describe('filesToMarkdown', () => {
  afterEach(() => mock.restore());

  test('generates markdown and skips large and unsupported files', () => {
    mock({
      '/project': {
        'a.txt': 'hello',
        'b.png': 'binary',
        'c.txt': new Array(1024 * 1024 + 1).join('x')
      }
    });

    const bar = { increment: jest.fn() };
    const md = filesToMarkdown('/project', ['a.txt', 'b.png', 'c.txt'], {
      maxSize: 1024,
      skipExtensions: ['.png']
    }, bar);

    expect(md).toContain('```txt\nhello');
    expect(md).toMatch(/\(Skipped: extension `\.png` not supported\)/);
    expect(md).toMatch(/\(Skipped: file too large/);
    expect(bar.increment).toHaveBeenCalledTimes(3);
  });
});
