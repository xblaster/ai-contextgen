const mock = require('mock-fs');
const fs = require('fs');
const { snapshotMain, restoreMain } = require('../ai-contextgen');
const crypto = require('crypto');

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
    const hash = crypto.createHash('sha256').update('hello').digest('hex');
    expect(md).toContain('# AI-ContextGen Snapshot');
    expect(md).toContain(`(checksum: ${hash})`);
    expect(md).toContain('hello');
  });

  test('restoreMain recreates files from markdown', () => {
    const hash = crypto.createHash('sha256').update('content').digest('hex');
    const md = [
      '# AI-ContextGen Snapshot',
      '',
      '---',
      '',
      `## \`a.txt\` (checksum: ${hash})`,
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
