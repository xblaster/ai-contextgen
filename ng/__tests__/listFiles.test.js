const mockFs = require('mock-fs');
const listFiles = require('../src/listFiles');
const getIgnoreFilter = require('../src/getIgnoreFilter');

describe('listFiles', () => {
  afterEach(() => {
    mockFs.restore();
  });

  test('should list all files in a directory', () => {
    mockFs({
      '/project': {
        'index.js': 'console.log("hello");',
        'package.json': '{}',
        'src': {
          'app.js': 'export default {};'
        }
      }
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    const files = listFiles('/project', filter);

    expect(files).toContain('index.js');
    expect(files).toContain('package.json');
    expect(files).toContain('src/app.js');
  });

  test('should recursively scan subdirectories', () => {
    mockFs({
      '/project': {
        'src': {
          'components': {
            'Button.js': 'export default Button;'
          },
          'utils': {
            'helpers.js': 'export const helper = () => {};'
          }
        }
      }
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    const files = listFiles('/project', filter);

    expect(files).toContain('src/components/Button.js');
    expect(files).toContain('src/utils/helpers.js');
  });

  test('should respect ignore patterns', () => {
    mockFs({
      '/project': {
        '.gitignore': 'node_modules/',
        'index.js': 'console.log("hello");',
        'node_modules': {
          'package': {
            'index.js': 'module.exports = {};'
          }
        }
      }
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    const files = listFiles('/project', filter);

    expect(files).toContain('index.js');
    expect(files).not.toContain('node_modules/package/index.js');
  });

  test('should call progress callback', () => {
    mockFs({
      '/project': {
        'file1.js': 'a',
        'file2.js': 'b',
        'file3.js': 'c'
      }
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    const progressCounts = [];

    listFiles('/project', filter, (count) => {
      progressCounts.push(count);
    });

    expect(progressCounts).toEqual([1, 2, 3]);
  });

  test('should handle empty directories', () => {
    mockFs({
      '/project': {
        'empty': {}
      }
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    const files = listFiles('/project', filter);

    expect(files).toEqual([]);
  });

  test('should use forward slashes in paths', () => {
    mockFs({
      '/project': {
        'src': {
          'index.js': 'code'
        }
      }
    });

    const filter = getIgnoreFilter('/project', 'output.md');
    const files = listFiles('/project', filter);

    expect(files[0]).toBe('src/index.js');
    expect(files[0]).not.toContain('\\');
  });
});
