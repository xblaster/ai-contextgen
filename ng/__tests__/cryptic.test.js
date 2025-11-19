const mockFs = require('mock-fs');
const fs = require('fs');
const crypticEncoder = require('../src/crypticEncoder');
const crypticDecoder = require('../src/crypticDecoder');

describe('crypticEncoder', () => {
  afterEach(() => {
    mockFs.restore();
  });

  test('should generate valid cryptic output with header', () => {
    mockFs({
      '/project': {
        'index.js': 'console.log("hello");'
      }
    });

    const result = crypticEncoder('/project', ['index.js']);

    expect(result.output).toContain('CRYPTIC-SNAPSHOT-V1');
    expect(result.output).toContain('GLOBAL-CHECKSUM:');
    expect(result.output).toContain('COMPRESSION-LEVEL: 6');
    expect(result.output).toContain('FILE-COUNT: 1');
    expect(result.output).toContain('---HEADER-END---');
  });

  test('should generate global checksum', () => {
    mockFs({
      '/project': {
        'index.js': 'console.log("hello");'
      }
    });

    const result = crypticEncoder('/project', ['index.js']);

    expect(result.globalChecksum).toBeDefined();
    expect(result.globalChecksum).toMatch(/^[a-f0-9]{64}$/);
  });

  test('should respect compression level', () => {
    mockFs({
      '/project': {
        'index.js': 'a'.repeat(1000)
      }
    });

    const result1 = crypticEncoder('/project', ['index.js'], 1);
    const result9 = crypticEncoder('/project', ['index.js'], 9);

    expect(result1.output).toContain('COMPRESSION-LEVEL: 1');
    expect(result9.output).toContain('COMPRESSION-LEVEL: 9');
    // Higher compression should produce smaller output
    expect(result9.output.length).toBeLessThan(result1.output.length);
  });

  test('should skip binary files', () => {
    mockFs({
      '/project': {
        'image.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        'index.js': 'code'
      }
    });

    const result = crypticEncoder('/project', ['image.png', 'index.js']);

    expect(result.processedCount).toBe(1);
    expect(result.output).toContain('FILE-COUNT: 1');
  });

  test('should skip files larger than 1MB', () => {
    mockFs({
      '/project': {
        'large.js': 'x'.repeat(1024 * 1024 + 1),
        'small.js': 'small'
      }
    });

    const result = crypticEncoder('/project', ['large.js', 'small.js']);

    expect(result.processedCount).toBe(1);
  });

  test('should call progress callback', () => {
    mockFs({
      '/project': {
        'file1.js': 'a',
        'file2.js': 'b'
      }
    });

    const progressCalls = [];
    crypticEncoder('/project', ['file1.js', 'file2.js'], 6, (current, total) => {
      progressCalls.push({ current, total });
    });

    expect(progressCalls).toHaveLength(2);
  });
});

describe('crypticDecoder', () => {
  afterEach(() => {
    mockFs.restore();
  });

  test('should decode and restore files', () => {
    mockFs({
      '/project': {
        'index.js': 'console.log("hello");'
      },
      '/output': {}
    });

    const encoded = crypticEncoder('/project', ['index.js']);
    const result = crypticDecoder(encoded.output, '/output');

    expect(result.restoredCount).toBe(1);
    expect(result.files).toContain('index.js');
    expect(fs.readFileSync('/output/index.js', 'utf-8')).toBe('console.log("hello");');
  });

  test('should verify without writing files', () => {
    mockFs({
      '/project': {
        'index.js': 'console.log("hello");'
      },
      '/output': {}
    });

    const encoded = crypticEncoder('/project', ['index.js']);
    const result = crypticDecoder(encoded.output, '/output', true);

    expect(result.verified).toBe(true);
    expect(result.restoredCount).toBe(1);
    expect(fs.existsSync('/output/index.js')).toBe(false);
  });

  test('should create directory structure', () => {
    mockFs({
      '/project': {
        'src': {
          'utils': {
            'helpers.js': 'export const helper = () => {};'
          }
        }
      },
      '/output': {}
    });

    const encoded = crypticEncoder('/project', ['src/utils/helpers.js']);
    crypticDecoder(encoded.output, '/output');

    expect(fs.existsSync('/output/src/utils')).toBe(true);
  });

  test('should throw error on invalid version', () => {
    const invalidCryptic = 'CRYPTIC-SNAPSHOT-V99\n---HEADER-END---\ndata';

    expect(() => {
      crypticDecoder(invalidCryptic, '/output');
    }).toThrow('unsupported version');
  });

  test('should throw error on missing header end', () => {
    const invalidCryptic = 'CRYPTIC-SNAPSHOT-V1\nno header end';

    expect(() => {
      crypticDecoder(invalidCryptic, '/output');
    }).toThrow('missing header end marker');
  });

  test('should throw error on checksum mismatch', () => {
    mockFs({
      '/project': {
        'index.js': 'original content'
      },
      '/output': {}
    });

    const encoded = crypticEncoder('/project', ['index.js']);
    // Corrupt the global checksum in header
    const corrupted = encoded.output.replace(/GLOBAL-CHECKSUM: [a-f0-9]+/, 'GLOBAL-CHECKSUM: 0000000000000000000000000000000000000000000000000000000000000000');

    expect(() => {
      crypticDecoder(corrupted, '/output');
    }).toThrow('Global checksum mismatch');
  });

  test('should call progress callback', () => {
    mockFs({
      '/project': {
        'file1.js': 'a',
        'file2.js': 'b'
      },
      '/output': {}
    });

    const encoded = crypticEncoder('/project', ['file1.js', 'file2.js']);

    const progressCalls = [];
    crypticDecoder(encoded.output, '/output', false, (current, total) => {
      progressCalls.push({ current, total });
    });

    expect(progressCalls).toHaveLength(2);
  });
});

describe('cryptic round-trip', () => {
  afterEach(() => {
    mockFs.restore();
  });

  test('should preserve file content exactly', () => {
    const testContent = 'function test() {\n  return "hello world";\n}\n';
    mockFs({
      '/project': {
        'test.js': testContent
      },
      '/output': {}
    });

    const encoded = crypticEncoder('/project', ['test.js']);
    crypticDecoder(encoded.output, '/output');

    const restored = fs.readFileSync('/output/test.js', 'utf-8');
    expect(restored).toBe(testContent);
  });

  test('should preserve multiple files', () => {
    mockFs({
      '/project': {
        'file1.js': 'content1',
        'file2.js': 'content2',
        'src': {
          'nested.js': 'nested content'
        }
      },
      '/output': {}
    });

    const encoded = crypticEncoder('/project', ['file1.js', 'file2.js', 'src/nested.js']);
    const result = crypticDecoder(encoded.output, '/output');

    expect(result.restoredCount).toBe(3);
    expect(fs.readFileSync('/output/file1.js', 'utf-8')).toBe('content1');
    expect(fs.readFileSync('/output/file2.js', 'utf-8')).toBe('content2');
    expect(fs.readFileSync('/output/src/nested.js', 'utf-8')).toBe('nested content');
  });

  test('should handle special characters', () => {
    const specialContent = 'const str = "Hello\\nWorld\\t\\u2603";';
    mockFs({
      '/project': {
        'special.js': specialContent
      },
      '/output': {}
    });

    const encoded = crypticEncoder('/project', ['special.js']);
    crypticDecoder(encoded.output, '/output');

    expect(fs.readFileSync('/output/special.js', 'utf-8')).toBe(specialContent);
  });

  test('should handle empty files', () => {
    mockFs({
      '/project': {
        'empty.js': ''
      },
      '/output': {}
    });

    const encoded = crypticEncoder('/project', ['empty.js']);
    crypticDecoder(encoded.output, '/output');

    expect(fs.readFileSync('/output/empty.js', 'utf-8')).toBe('');
  });
});
