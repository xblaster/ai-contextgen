const mock = require('mock-fs');
const fs = require('fs');
const { snapshotMain, restoreMain } = require('../ai-contextgen');

jest.mock('cli-progress', () => {
  return {
    SingleBar: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      increment: jest.fn(),
    })),
    Presets: { shades_classic: {} },
  };
});

describe('snapshotMain and restoreMain', () => {
  afterEach(() => mock.restore());

  test('snapshotMain creates markdown snapshot', () => {
    mock({
      '/project': {
        'file.txt': 'hello',
      },
    });

    snapshotMain('/project', 'out.md');

    const md = fs.readFileSync('/project/out.md', 'utf8');
    expect(md).toContain('# AI-ContextGen Snapshot');
    expect(md).toContain('`file.txt`');
    expect(md).toContain('hello');
  });

  test('restoreMain recreates files from markdown', () => {
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
      '',
    ].join('\n');

    mock({
      '/proj': {
        'snap.md': md,
      },
      '/out': {},
    });

    restoreMain('/proj/snap.md', '/out');

    expect(fs.readFileSync('/out/a.txt', 'utf8')).toBe('content');
  });
});
