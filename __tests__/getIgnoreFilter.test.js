const mock = require('mock-fs');
const fs = require('fs');
const path = require('path');
const getIgnoreFilter = require('../src/getIgnoreFilter');

describe('getIgnoreFilter', () => {
  afterEach(() => mock.restore());

  test('loads ignore patterns from .gitignore and .ai-ignore and adds defaults', () => {
    mock({
      '/project/.gitignore': 'node_modules\nignored.txt',
      '/project/.ai-ignore': 'ai-ignored.txt',
    });

    const ig = getIgnoreFilter('/project', '__output.md');

    expect(ig.ignores('node_modules/foo.js')).toBe(true);
    expect(ig.ignores('ignored.txt')).toBe(true);
    expect(ig.ignores('ai-ignored.txt')).toBe(true);
    expect(ig.ignores('.git/config')).toBe(true);
    expect(ig.ignores('__output.md')).toBe(true);
    expect(ig.ignores('src/index.js')).toBe(false);
  });
});
