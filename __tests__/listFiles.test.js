const mock = require('mock-fs');
const listFiles = require('../src/listFiles');
const ignore = require('ignore');

describe('listFiles', () => {
  afterEach(() => mock.restore());

  test('returns files not ignored', () => {
    mock({
      '/project': {
        'keep.txt': 'a',
        'skip.log': 'b',
        'dir': {
          'deep.js': 'c'
        }
      }
    });

    const ig = ignore().add('skip.log');
    const bar = { increment: jest.fn() };
    const files = listFiles('/project', '/project', ig, bar);

    expect(files.sort()).toEqual(['dir/deep.js', 'keep.txt']);
    expect(bar.increment).toHaveBeenCalledTimes(2);
  });
});
