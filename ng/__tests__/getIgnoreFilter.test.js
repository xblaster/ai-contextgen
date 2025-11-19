const mockFs = require('mock-fs');
const getIgnoreFilter = require('../src/getIgnoreFilter');

describe('getIgnoreFilter', () => {
  afterEach(() => {
    mockFs.restore();
  });

  test('should always ignore .git directory', () => {
    mockFs({
      '/project': {}
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    expect(filter.ignores('.git/')).toBe(true);
    expect(filter.ignores('.git/config')).toBe(true);
  });

  test('should ignore the output filename', () => {
    mockFs({
      '/project': {}
    });

    const filter = getIgnoreFilter('/project', '/project/output.md');
    expect(filter.ignores('output.md')).toBe(true);
  });

  test('should respect .gitignore patterns', () => {
    mockFs({
      '/project': {
        '.gitignore': 'node_modules/\n*.log'
      }
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    expect(filter.ignores('node_modules/')).toBe(true);
    expect(filter.ignores('node_modules/package.json')).toBe(true);
    expect(filter.ignores('error.log')).toBe(true);
    expect(filter.ignores('src/index.js')).toBe(false);
  });

  test('should respect .ai-ignore patterns', () => {
    mockFs({
      '/project': {
        '.ai-ignore': 'secret/\n*.env'
      }
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    expect(filter.ignores('secret/')).toBe(true);
    expect(filter.ignores('secret/keys.json')).toBe(true);
    expect(filter.ignores('.env')).toBe(true);
    expect(filter.ignores('src/index.js')).toBe(false);
  });

  test('should combine .gitignore and .ai-ignore patterns', () => {
    mockFs({
      '/project': {
        '.gitignore': 'node_modules/',
        '.ai-ignore': 'secret/'
      }
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    expect(filter.ignores('node_modules/')).toBe(true);
    expect(filter.ignores('secret/')).toBe(true);
  });

  test('should handle missing ignore files gracefully', () => {
    mockFs({
      '/project': {}
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    expect(filter.ignores('.git/')).toBe(true);
    expect(filter.ignores('src/index.js')).toBe(false);
  });
});
