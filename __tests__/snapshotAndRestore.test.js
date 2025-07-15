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
    const globalHash = crypto.createHash('sha256').update(`file.txt:${hash}\n`).digest('hex');
    expect(md).toContain('# AI-ContextGen Snapshot');
    expect(md).toContain(`(checksum: ${hash})`);
    expect(md).toContain(`Global checksum: ${globalHash}`);
    expect(md).toContain('hello');
  });

  test('restoreMain recreates files from markdown', () => {
    const hash = crypto.createHash('sha256').update('content').digest('hex');
    const globalHash = crypto.createHash('sha256').update(`a.txt:${hash}\n`).digest('hex');
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
    const mdWithChecksum = md + `\nGlobal checksum: ${globalHash}\n`;

    mock({
      '/proj': {
        'snap.md': mdWithChecksum,
      },
      '/out': {},
    });

    restoreMain('/proj/snap.md', '/out');

    expect(fs.readFileSync('/out/a.txt', 'utf8')).toBe('content');
  });

  test('snapshot and restore chain preserves checksum', () => {
    mock({
      '/orig': {
        'a.txt': 'one',
        'b.txt': 'two',
      },
      '/restored': {}
    });

    snapshotMain('/orig', 'snap.md');
    const md1 = fs.readFileSync('/orig/snap.md', 'utf8');
    restoreMain('/orig/snap.md', '/restored');
    snapshotMain('/restored', 'snap2.md');
    const md2 = fs.readFileSync('/restored/snap2.md', 'utf8');
    const regex = /Global checksum: ([a-f0-9]+)/;
    const g1 = md1.match(regex)[1];
    const g2 = md2.match(regex)[1];
    expect(g1).toBe(g2);
  });
});
