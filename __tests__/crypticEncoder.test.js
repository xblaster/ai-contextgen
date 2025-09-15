const fs = require('fs');
const path = require('path');
const mockFs = require('mock-fs');
const crypto = require('crypto');
const zlib = require('zlib');
const crypticEncoder = require('../src/crypticEncoder');

describe('crypticEncoder', () => {
  beforeEach(() => {
    // Create a mock filesystem
    mockFs({
      '/test-project': {
        'package.json': JSON.stringify({ name: 'test-project', version: '1.0.0' }),
        'src': {
          'index.js': 'console.log("Hello World");',
          'utils.js': 'module.exports = { helper: () => "test" };'
        },
        'README.md': '# Test Project\nThis is a test project.',
        '.gitignore': 'node_modules/\n*.log',
        '.ai-ignore': 'temp/\n*.tmp',
        'binary.png': Buffer.from([0x89, 0x50, 0x4E, 0x47]), // PNG header
        'large-file.txt': 'x'.repeat(2 * 1024 * 1024), // 2MB file
        'temp': {
          'should-ignore.tmp': 'ignored content'
        }
      }
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('crypticEncode', () => {
    test('should create valid cryptic encoded output', async () => {
      const files = ['package.json', 'src/index.js', 'src/utils.js', 'README.md'];
      const options = {
        maxSize: 1024 * 1024,
        skipExtensions: ['.png', '.jpg'],
        compressionLevel: 6
      };

      const result = await crypticEncoder.crypticEncode('/test-project', files, options);

      // Check header format
      const lines = result.split('\n');
      expect(lines[0]).toBe('CRYPTIC-SNAPSHOT-V1');
      expect(lines[1]).toMatch(/^GLOBAL-CHECKSUM: [a-f0-9]{64}$/);
      expect(lines[2]).toBe('COMPRESSION-LEVEL: 6');
      expect(lines[3]).toMatch(/^FILE-COUNT: \d+$/);
      expect(lines[4]).toBe('---HEADER-END---');

      // Check base64 encoded content exists
      expect(lines[5]).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    test('should respect file size limits', async () => {
      const files = ['large-file.txt', 'package.json'];
      const options = {
        maxSize: 1024 * 1024, // 1MB limit
        skipExtensions: [],
        compressionLevel: 6
      };

      const result = await crypticEncoder.crypticEncode('/test-project', files, options);

      // Decode to check content
      const encodedData = result.split('\n').slice(5).join('\n');
      const decompressed = zlib.gunzipSync(Buffer.from(encodedData, 'base64'));
      const data = JSON.parse(decompressed.toString());

      // Should exclude large file but include package.json
      expect(data.files).toHaveLength(1);
      expect(data.files[0].path).toBe('package.json');
    });

    test('should skip binary files', async () => {
      const files = ['binary.png', 'package.json'];
      const options = {
        maxSize: 1024 * 1024,
        skipExtensions: ['.png', '.jpg'],
        compressionLevel: 6
      };

      const result = await crypticEncoder.crypticEncode('/test-project', files, options);

      const encodedData = result.split('\n').slice(5).join('\n');
      const decompressed = zlib.gunzipSync(Buffer.from(encodedData, 'base64'));
      const data = JSON.parse(decompressed.toString());

      // Should exclude binary file
      expect(data.files).toHaveLength(1);
      expect(data.files[0].path).toBe('package.json');
    });

    test('should generate correct checksums', async () => {
      const files = ['package.json'];
      const options = {
        maxSize: 1024 * 1024,
        skipExtensions: [],
        compressionLevel: 6
      };

      const result = await crypticEncoder.crypticEncode('/test-project', files, options);

      const encodedData = result.split('\n').slice(5).join('\n');
      const decompressed = zlib.gunzipSync(Buffer.from(encodedData, 'base64'));
      const data = JSON.parse(decompressed.toString());

      // Verify file checksum
      const fileContent = JSON.stringify({ name: 'test-project', version: '1.0.0' });
      const expectedChecksum = crypto.createHash('sha256').update(fileContent).digest('hex');

      expect(data.files[0].checksum).toBe(expectedChecksum);
      expect(data.global_checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should include metadata', async () => {
      const files = ['package.json', 'src/index.js'];
      const options = {
        maxSize: 1024 * 1024,
        skipExtensions: [],
        compressionLevel: 6
      };

      const result = await crypticEncoder.crypticEncode('/test-project', files, options);

      const encodedData = result.split('\n').slice(5).join('\n');
      const decompressed = zlib.gunzipSync(Buffer.from(encodedData, 'base64'));
      const data = JSON.parse(decompressed.toString());

      expect(data.metadata).toBeDefined();
      expect(data.metadata.version).toBe('1.0');
      expect(data.metadata.file_count).toBe(2);
      expect(data.metadata.compression_level).toBe(6);
      expect(data.metadata.source_directory).toBe('/test-project');
      expect(data.metadata.generated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });

  describe('calculateGlobalHash', () => {
    test('should generate consistent global hash', () => {
      const files = [
        { path: 'file1.js', checksum: 'abc123' },
        { path: 'file2.js', checksum: 'def456' }
      ];

      const hash1 = crypticEncoder.calculateGlobalHash(files);
      const hash2 = crypticEncoder.calculateGlobalHash(files);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should produce different hashes for different file sets', () => {
      const files1 = [{ path: 'file1.js', checksum: 'abc123' }];
      const files2 = [{ path: 'file2.js', checksum: 'def456' }];

      const hash1 = crypticEncoder.calculateGlobalHash(files1);
      const hash2 = crypticEncoder.calculateGlobalHash(files2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('compressAndEncode', () => {
    test('should compress and base64 encode data', () => {
      const testData = { test: 'data', array: [1, 2, 3], nested: { key: 'value' } };
      const compressionLevel = 6;

      const result = crypticEncoder.compressAndEncode(testData, compressionLevel);

      // Should be valid base64
      expect(result).toMatch(/^[A-Za-z0-9+/=]+$/);

      // Should be decompressible
      const decompressed = zlib.gunzipSync(Buffer.from(result, 'base64'));
      const parsed = JSON.parse(decompressed.toString());

      expect(parsed).toEqual(testData);
    });

    test('should achieve compression', () => {
      const largeData = { content: 'A'.repeat(10000) };
      const uncompressedSize = JSON.stringify(largeData).length;

      const compressed = crypticEncoder.compressAndEncode(largeData, 9);
      const compressedSize = Buffer.from(compressed, 'base64').length;

      // Should be significantly smaller
      expect(compressedSize).toBeLessThan(uncompressedSize * 0.5);
    });

    test('should handle different compression levels', () => {
      const testData = { content: 'B'.repeat(5000) };

      const level1 = crypticEncoder.compressAndEncode(testData, 1);
      const level9 = crypticEncoder.compressAndEncode(testData, 9);

      // Higher compression should generally be smaller (though not guaranteed for small data)
      expect(level1).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(level9).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  describe('error handling', () => {
    test('should handle unreadable files gracefully', async () => {
      // Mock a file that can't be read
      mockFs({
        '/test-project': {
          'readable.txt': 'content',
          'unreadable.txt': mockFs.file({
            content: 'content',
            mode: 0o000 // No permissions
          })
        }
      });

      const files = ['readable.txt', 'unreadable.txt'];
      const options = {
        maxSize: 1024 * 1024,
        skipExtensions: [],
        compressionLevel: 6
      };

      const result = await crypticEncoder.crypticEncode('/test-project', files, options);

      const encodedData = result.split('\n').slice(5).join('\n');
      const decompressed = zlib.gunzipSync(Buffer.from(encodedData, 'base64'));
      const data = JSON.parse(decompressed.toString());

      // Should only include the readable file
      expect(data.files).toHaveLength(1);
      expect(data.files[0].path).toBe('readable.txt');
    });

    test('should handle invalid compression level', () => {
      const testData = { test: 'data' };

      expect(() => {
        crypticEncoder.compressAndEncode(testData, 10); // Invalid level
      }).toThrow();
    });
  });
});