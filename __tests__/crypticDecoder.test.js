const fs = require('fs');
const path = require('path');
const mockFs = require('mock-fs');
const crypto = require('crypto');
const zlib = require('zlib');
const crypticDecoder = require('../src/crypticDecoder');

describe('crypticDecoder', () => {
  const validCrypticFile = `CRYPTIC-SNAPSHOT-V1
GLOBAL-CHECKSUM: a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
COMPRESSION-LEVEL: 6
FILE-COUNT: 2
---HEADER-END---
H4sIAAAAAAAAA6tWyk5NzCvJzE61UspLLSqpjM8sS8wpTbFSMDAyMDQ0NDC0UkrMS8nPTbVSSsyDCAMZOafmpOZllqQChZCqTJCCNVCBkmlRZUllqpVSQWZBUT4qV6uyWlYjAAAA//8DAP//4xpx/wAAAA==`;

  beforeEach(() => {
    mockFs({
      '/test-input': {
        'valid.cryptic': validCrypticFile,
        'invalid-header.cryptic': 'INVALID-HEADER\nrest of content',
        'corrupted.cryptic': validCrypticFile.replace('A6tW', 'XXXX'), // Corrupt base64
        'empty.cryptic': ''
      },
      '/test-output': {}
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('crypticDecode', () => {
    test('should decode valid cryptic file', async () => {
      // Create a simple valid cryptic file manually
      const testData = {
        metadata: {
          version: '1.0',
          generated: '2025-01-15T10:30:00.000Z',
          source_directory: '/test-project',
          file_count: 2,
          compression_level: 6
        },
        files: [
          {
            path: 'test.txt',
            checksum: crypto.createHash('sha256').update('Hello World').digest('hex'),
            size: 11,
            content: Buffer.from('Hello World').toString('base64')
          },
          {
            path: 'src/app.js',
            checksum: crypto.createHash('sha256').update('console.log("test");').digest('hex'),
            size: 18,
            content: Buffer.from('console.log("test");').toString('base64')
          }
        ],
        global_checksum: 'calculated-global-hash'
      };

      // Calculate real global checksum
      testData.global_checksum = crypto.createHash('sha256')
        .update(testData.files.map(f => `${f.path}:${f.checksum}`).join('\n'))
        .digest('hex');

      const compressed = zlib.gzipSync(JSON.stringify(testData));
      const encoded = compressed.toString('base64');

      const validFile = `CRYPTIC-SNAPSHOT-V1
GLOBAL-CHECKSUM: ${testData.global_checksum}
COMPRESSION-LEVEL: 6
FILE-COUNT: 2
---HEADER-END---
${encoded}`;

      mockFs({
        '/test-input/test.cryptic': validFile,
        '/test-output': {}
      });

      await crypticDecoder.crypticDecode('/test-input/test.cryptic', '/test-output');

      // Check files were created
      expect(fs.existsSync('/test-output/test.txt')).toBe(true);
      expect(fs.existsSync('/test-output/src/app.js')).toBe(true);

      // Check content
      expect(fs.readFileSync('/test-output/test.txt', 'utf8')).toBe('Hello World');
      expect(fs.readFileSync('/test-output/src/app.js', 'utf8')).toBe('console.log("test");');
    });

    test('should create directories as needed', async () => {
      const testData = {
        metadata: {
          version: '1.0',
          generated: '2025-01-15T10:30:00.000Z',
          source_directory: '/test-project',
          file_count: 1,
          compression_level: 6
        },
        files: [
          {
            path: 'deep/nested/folder/file.txt',
            checksum: crypto.createHash('sha256').update('content').digest('hex'),
            size: 7,
            content: Buffer.from('content').toString('base64')
          }
        ],
        global_checksum: 'placeholder'
      };

      testData.global_checksum = crypto.createHash('sha256')
        .update(testData.files.map(f => `${f.path}:${f.checksum}`).join('\n'))
        .digest('hex');

      const compressed = zlib.gzipSync(JSON.stringify(testData));
      const encoded = compressed.toString('base64');

      const validFile = `CRYPTIC-SNAPSHOT-V1
GLOBAL-CHECKSUM: ${testData.global_checksum}
COMPRESSION-LEVEL: 6
FILE-COUNT: 1
---HEADER-END---
${encoded}`;

      mockFs({
        '/test-input/nested.cryptic': validFile,
        '/test-output': {}
      });

      await crypticDecoder.crypticDecode('/test-input/nested.cryptic', '/test-output');

      expect(fs.existsSync('/test-output/deep/nested/folder/file.txt')).toBe(true);
      expect(fs.readFileSync('/test-output/deep/nested/folder/file.txt', 'utf8')).toBe('content');
    });

    test('should verify checksums during decode', async () => {
      const testData = {
        metadata: {
          version: '1.0',
          generated: '2025-01-15T10:30:00.000Z',
          source_directory: '/test-project',
          file_count: 1,
          compression_level: 6
        },
        files: [
          {
            path: 'test.txt',
            checksum: 'invalid-checksum', // Wrong checksum
            size: 11,
            content: Buffer.from('Hello World').toString('base64')
          }
        ],
        global_checksum: 'invalid-global-checksum'
      };

      const compressed = zlib.gzipSync(JSON.stringify(testData));
      const encoded = compressed.toString('base64');

      const invalidFile = `CRYPTIC-SNAPSHOT-V1
GLOBAL-CHECKSUM: invalid-global-checksum
COMPRESSION-LEVEL: 6
FILE-COUNT: 1
---HEADER-END---
${encoded}`;

      mockFs({
        '/test-input/invalid.cryptic': invalidFile,
        '/test-output': {}
      });

      await expect(
        crypticDecoder.crypticDecode('/test-input/invalid.cryptic', '/test-output')
      ).rejects.toThrow('File checksum mismatch');
    });
  });

  describe('verifyIntegrity', () => {
    test('should pass for valid data', () => {
      const validData = {
        metadata: { file_count: 2 },
        files: [
          {
            path: 'file1.txt',
            checksum: crypto.createHash('sha256').update('content1').digest('hex'),
            content: Buffer.from('content1').toString('base64')
          },
          {
            path: 'file2.txt',
            checksum: crypto.createHash('sha256').update('content2').digest('hex'),
            content: Buffer.from('content2').toString('base64')
          }
        ],
        global_checksum: crypto.createHash('sha256')
          .update([
            `file1.txt:${crypto.createHash('sha256').update('content1').digest('hex')}`,
            `file2.txt:${crypto.createHash('sha256').update('content2').digest('hex')}`
          ].join('\n'))
          .digest('hex')
      };

      expect(() => {
        crypticDecoder.verifyIntegrity(validData);
      }).not.toThrow();
    });

    test('should fail for mismatched file checksum', () => {
      const invalidData = {
        metadata: { file_count: 1 },
        files: [
          {
            path: 'file1.txt',
            checksum: 'wrong-checksum',
            content: Buffer.from('content1').toString('base64')
          }
        ],
        global_checksum: 'some-hash'
      };

      expect(() => {
        crypticDecoder.verifyIntegrity(invalidData);
      }).toThrow('File checksum mismatch for file1.txt');
    });

    test('should fail for mismatched global checksum', () => {
      const validFileChecksum = crypto.createHash('sha256').update('content1').digest('hex');
      const invalidData = {
        metadata: { file_count: 1 },
        files: [
          {
            path: 'file1.txt',
            checksum: validFileChecksum,
            content: Buffer.from('content1').toString('base64')
          }
        ],
        global_checksum: 'wrong-global-hash'
      };

      expect(() => {
        crypticDecoder.verifyIntegrity(invalidData);
      }).toThrow('Global checksum verification failed');
    });

    test('should fail for mismatched file count', () => {
      const invalidData = {
        metadata: { file_count: 5 }, // Says 5 but only has 1 file
        files: [
          {
            path: 'file1.txt',
            checksum: crypto.createHash('sha256').update('content1').digest('hex'),
            content: Buffer.from('content1').toString('base64')
          }
        ],
        global_checksum: 'some-hash'
      };

      expect(() => {
        crypticDecoder.verifyIntegrity(invalidData);
      }).toThrow('File count mismatch');
    });
  });

  describe('decodeAndDecompress', () => {
    test('should decode and decompress valid data', () => {
      const testData = { test: 'content', number: 42 };
      const compressed = zlib.gzipSync(JSON.stringify(testData));
      const encoded = compressed.toString('base64');

      const result = crypticDecoder.decodeAndDecompress(encoded);

      expect(result).toEqual(testData);
    });

    test('should handle malformed base64', () => {
      expect(() => {
        crypticDecoder.decodeAndDecompress('invalid-base64!@#');
      }).toThrow();
    });

    test('should handle non-gzipped data', () => {
      const invalidData = Buffer.from('not gzipped').toString('base64');

      expect(() => {
        crypticDecoder.decodeAndDecompress(invalidData);
      }).toThrow();
    });
  });

  describe('format validation', () => {
    test('should validate header format', async () => {
      mockFs({
        '/test-input/invalid-format.cryptic': 'WRONG-HEADER\ndata',
        '/test-output': {}
      });

      await expect(
        crypticDecoder.crypticDecode('/test-input/invalid-format.cryptic', '/test-output')
      ).rejects.toThrow('Invalid cryptic file format');
    });

    test('should validate header completeness', async () => {
      mockFs({
        '/test-input/incomplete.cryptic': `CRYPTIC-SNAPSHOT-V1
GLOBAL-CHECKSUM: abc123
COMPRESSION-LEVEL: 6
// Missing FILE-COUNT and ---HEADER-END---
base64data`,
        '/test-output': {}
      });

      await expect(
        crypticDecoder.crypticDecode('/test-input/incomplete.cryptic', '/test-output')
      ).rejects.toThrow('Invalid cryptic file format');
    });

    test('should handle missing files', async () => {
      await expect(
        crypticDecoder.crypticDecode('/nonexistent/file.cryptic', '/test-output')
      ).rejects.toThrow();
    });
  });

  describe('verify-only mode', () => {
    test('should verify without extracting files', async () => {
      const testData = {
        metadata: {
          version: '1.0',
          generated: '2025-01-15T10:30:00.000Z',
          source_directory: '/test-project',
          file_count: 1,
          compression_level: 6
        },
        files: [
          {
            path: 'test.txt',
            checksum: crypto.createHash('sha256').update('Hello').digest('hex'),
            size: 5,
            content: Buffer.from('Hello').toString('base64')
          }
        ],
        global_checksum: 'placeholder'
      };

      testData.global_checksum = crypto.createHash('sha256')
        .update(testData.files.map(f => `${f.path}:${f.checksum}`).join('\n'))
        .digest('hex');

      const compressed = zlib.gzipSync(JSON.stringify(testData));
      const encoded = compressed.toString('base64');

      const validFile = `CRYPTIC-SNAPSHOT-V1
GLOBAL-CHECKSUM: ${testData.global_checksum}
COMPRESSION-LEVEL: 6
FILE-COUNT: 1
---HEADER-END---
${encoded}`;

      mockFs({
        '/test-input/verify.cryptic': validFile,
        '/test-output': {}
      });

      const result = await crypticDecoder.crypticDecode('/test-input/verify.cryptic', '/test-output', { verifyOnly: true });

      // Should return verification result without creating files
      expect(result.isValid).toBe(true);
      expect(result.fileCount).toBe(1);
      expect(fs.existsSync('/test-output/test.txt')).toBe(false); // No files created
    });
  });
});