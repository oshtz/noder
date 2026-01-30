/**
 * Tests for replicateFiles utility
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  isReplicateUrlValid,
  isCacheValid,
  uploadFileToReplicate,
  deleteFileFromReplicate,
  shouldUploadFile,
  ReplicateFileManager,
  type CacheInfo,
} from './replicateFiles';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('replicateFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('isReplicateUrlValid', () => {
    it('should return false for null/undefined URL', async () => {
      expect(await isReplicateUrlValid(null)).toBe(false);
      expect(await isReplicateUrlValid(undefined)).toBe(false);
      expect(await isReplicateUrlValid('')).toBe(false);
    });

    it('should return true for accessible URLs', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await isReplicateUrlValid('https://example.com/file.png');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/file.png', { method: 'HEAD' });
    });

    it('should return false for inaccessible URLs', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await isReplicateUrlValid('https://example.com/404.png');

      expect(result).toBe(false);
    });

    it('should return false on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await isReplicateUrlValid('https://example.com/file.png');

      expect(result).toBe(false);
    });
  });

  describe('isCacheValid', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return false when cacheInfo is null/undefined', async () => {
      expect(await isCacheValid(null, '/path/to/file.png', false)).toBe(false);
      expect(await isCacheValid(undefined, '/path/to/file.png', false)).toBe(false);
    });

    it('should return false when replicateUrl is missing', async () => {
      const cacheInfo: CacheInfo = {};

      expect(await isCacheValid(cacheInfo, '/path/to/file.png', false)).toBe(false);
    });

    it('should return false when media path changed', async () => {
      const cacheInfo: CacheInfo = {
        replicateUrl: 'https://replicate.com/file.png',
        uploadedMediaPath: '/old/path.png',
      };

      expect(await isCacheValid(cacheInfo, '/new/path.png', false)).toBe(false);
    });

    it('should return false when URL is expired', async () => {
      const cacheInfo: CacheInfo = {
        replicateUrl: 'https://replicate.com/file.png',
        replicateExpiresAt: '2024-01-15T11:50:00Z', // 10 minutes ago
        uploadedMediaPath: '/path/to/file.png',
      };

      expect(await isCacheValid(cacheInfo, '/path/to/file.png', false)).toBe(false);
    });

    it('should return false when URL expires within 5 minute buffer', async () => {
      const cacheInfo: CacheInfo = {
        replicateUrl: 'https://replicate.com/file.png',
        replicateExpiresAt: '2024-01-15T12:03:00Z', // 3 minutes from now
        uploadedMediaPath: '/path/to/file.png',
      };

      expect(await isCacheValid(cacheInfo, '/path/to/file.png', false)).toBe(false);
    });

    it('should return true when cache is valid (without URL verification)', async () => {
      const cacheInfo: CacheInfo = {
        replicateUrl: 'https://replicate.com/file.png',
        replicateExpiresAt: '2024-01-15T13:00:00Z', // 1 hour from now
        uploadedMediaPath: '/path/to/file.png',
      };

      expect(await isCacheValid(cacheInfo, '/path/to/file.png', false)).toBe(true);
    });

    it('should verify URL when verifyUrl is true', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const cacheInfo: CacheInfo = {
        replicateUrl: 'https://replicate.com/file.png',
        replicateExpiresAt: '2024-01-15T13:00:00Z',
        uploadedMediaPath: '/path/to/file.png',
      };

      expect(await isCacheValid(cacheInfo, '/path/to/file.png', true)).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://replicate.com/file.png', { method: 'HEAD' });
    });

    it('should return false if URL verification fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const cacheInfo: CacheInfo = {
        replicateUrl: 'https://replicate.com/file.png',
        replicateExpiresAt: '2024-01-15T13:00:00Z',
        uploadedMediaPath: '/path/to/file.png',
      };

      expect(await isCacheValid(cacheInfo, '/path/to/file.png', true)).toBe(false);
    });
  });

  describe('uploadFileToReplicate', () => {
    it('should upload file and return result', async () => {
      const mockResponse = {
        id: 'file-123',
        name: 'image.png',
        content_type: 'image/png',
        size: 1024,
        urls: { get: 'https://replicate.com/files/file-123' },
        created_at: '2024-01-15T12:00:00Z',
        expires_at: '2024-01-16T12:00:00Z',
      };

      (invoke as Mock).mockResolvedValueOnce(mockResponse);

      const result = await uploadFileToReplicate('/path/to/image.png', 'image');

      expect(invoke).toHaveBeenCalledWith('replicate_upload_file', {
        filePath: '/path/to/image.png',
        filename: 'image.png',
        contentType: 'image/png',
      });
      expect(result).toEqual({
        id: 'file-123',
        url: 'https://replicate.com/files/file-123',
        contentType: 'image/png',
        size: 1024,
        expiresAt: '2024-01-16T12:00:00Z',
      });
    });

    it('should detect content type from extension', async () => {
      const mockResponse = {
        id: 'file-123',
        urls: { get: 'https://example.com' },
        content_type: 'video/mp4',
        size: 1024,
      };

      (invoke as Mock).mockResolvedValueOnce(mockResponse);

      await uploadFileToReplicate('/path/to/video.mp4', 'video');

      expect(invoke).toHaveBeenCalledWith('replicate_upload_file', {
        filePath: '/path/to/video.mp4',
        filename: 'video.mp4',
        contentType: 'video/mp4',
      });
    });

    it('should handle jpg extension', async () => {
      const mockResponse = {
        id: 'file-123',
        urls: { get: 'https://example.com' },
        content_type: 'image/jpeg',
        size: 1024,
      };

      (invoke as Mock).mockResolvedValueOnce(mockResponse);

      await uploadFileToReplicate('/path/to/photo.jpg', 'image');

      expect(invoke).toHaveBeenCalledWith('replicate_upload_file', {
        filePath: '/path/to/photo.jpg',
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });
    });

    it('should handle audio files', async () => {
      const mockResponse = {
        id: 'file-123',
        urls: { get: 'https://example.com' },
        content_type: 'audio/mpeg',
        size: 1024,
      };

      (invoke as Mock).mockResolvedValueOnce(mockResponse);

      await uploadFileToReplicate('/path/to/audio.mp3', 'audio');

      expect(invoke).toHaveBeenCalledWith('replicate_upload_file', {
        filePath: '/path/to/audio.mp3',
        filename: 'audio.mp3',
        contentType: 'audio/mpeg',
      });
    });

    it('should throw on upload failure', async () => {
      (invoke as Mock).mockRejectedValueOnce(new Error('Upload failed'));

      await expect(uploadFileToReplicate('/path/to/file.png', 'image')).rejects.toThrow(
        'Failed to upload file to Replicate: Upload failed'
      );
    });
  });

  describe('deleteFileFromReplicate', () => {
    it('should delete file by ID', async () => {
      (invoke as Mock).mockResolvedValueOnce(undefined);

      await deleteFileFromReplicate('file-123');

      expect(invoke).toHaveBeenCalledWith('replicate_delete_file', { fileId: 'file-123' });
    });

    it('should not throw on null/undefined file ID', async () => {
      await expect(deleteFileFromReplicate(null)).resolves.toBeUndefined();
      await expect(deleteFileFromReplicate(undefined)).resolves.toBeUndefined();
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should not throw on delete error', async () => {
      (invoke as Mock).mockRejectedValueOnce(new Error('Delete failed'));

      await expect(deleteFileFromReplicate('file-123')).resolves.toBeUndefined();
    });
  });

  describe('shouldUploadFile', () => {
    it('should return false for null/undefined/empty path', () => {
      expect(shouldUploadFile(null)).toBe(false);
      expect(shouldUploadFile(undefined)).toBe(false);
      expect(shouldUploadFile('')).toBe(false);
    });

    it('should return false for http URLs', () => {
      expect(shouldUploadFile('http://example.com/file.png')).toBe(false);
    });

    it('should return false for https URLs', () => {
      expect(shouldUploadFile('https://example.com/file.png')).toBe(false);
    });

    it('should return false for data URLs', () => {
      expect(shouldUploadFile('data:image/png;base64,abc123')).toBe(false);
    });

    it('should return true for local file paths', () => {
      expect(shouldUploadFile('/path/to/file.png')).toBe(true);
      expect(shouldUploadFile('C:\\Users\\file.png')).toBe(true);
      expect(shouldUploadFile('./relative/path.png')).toBe(true);
    });
  });

  describe('ReplicateFileManager', () => {
    describe('ensureUploaded', () => {
      it('should upload file and cache result', async () => {
        const manager = new ReplicateFileManager();
        const mockResponse = {
          id: 'file-123',
          urls: { get: 'https://replicate.com/file-123' },
          content_type: 'image/png',
          size: 1024,
        };

        (invoke as Mock).mockResolvedValueOnce(mockResponse);

        const url = await manager.ensureUploaded('node-1', '/path/to/file.png', 'image');

        expect(url).toBe('https://replicate.com/file-123');
        expect(manager.getFileInfo('node-1')).toEqual({
          fileId: 'file-123',
          url: 'https://replicate.com/file-123',
          filePath: '/path/to/file.png',
        });
      });

      it('should return cached URL for same node and path', async () => {
        const manager = new ReplicateFileManager();
        const mockResponse = {
          id: 'file-123',
          urls: { get: 'https://replicate.com/file-123' },
          content_type: 'image/png',
          size: 1024,
        };

        (invoke as Mock).mockResolvedValueOnce(mockResponse);

        await manager.ensureUploaded('node-1', '/path/to/file.png', 'image');
        vi.clearAllMocks();

        const url2 = await manager.ensureUploaded('node-1', '/path/to/file.png', 'image');

        expect(invoke).not.toHaveBeenCalled(); // Should use cache
        expect(url2).toBe('https://replicate.com/file-123');
      });

      it('should re-upload when file path changes', async () => {
        const manager = new ReplicateFileManager();
        const mockResponse1 = {
          id: 'file-123',
          urls: { get: 'https://replicate.com/file-123' },
          content_type: 'image/png',
          size: 1024,
        };
        const mockResponse2 = {
          id: 'file-456',
          urls: { get: 'https://replicate.com/file-456' },
          content_type: 'image/png',
          size: 2048,
        };

        // First upload
        (invoke as Mock).mockResolvedValue(mockResponse1);
        await manager.ensureUploaded('node-1', '/path/to/file1.png', 'image');

        // Verify first file info
        expect(manager.getFileInfo('node-1')?.fileId).toBe('file-123');

        // Setup for second upload + delete - note: upload happens BEFORE delete in the code
        let callCount = 0;
        (invoke as Mock).mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve(mockResponse2); // upload
          return Promise.resolve(undefined); // delete
        });

        const url2 = await manager.ensureUploaded('node-1', '/path/to/file2.png', 'image');

        expect(url2).toBe('https://replicate.com/file-456');
        expect(manager.getFileInfo('node-1')?.fileId).toBe('file-456');
      });

      it('should not upload URLs', async () => {
        const manager = new ReplicateFileManager();
        const url = await manager.ensureUploaded('node-1', 'https://example.com/file.png', 'image');

        expect(url).toBe('https://example.com/file.png');
        expect(invoke).not.toHaveBeenCalled();
      });
    });

    describe('cleanup', () => {
      it('should delete file for node', async () => {
        const manager = new ReplicateFileManager();
        const mockResponse = {
          id: 'file-123',
          urls: { get: 'https://replicate.com/file-123' },
          content_type: 'image/png',
          size: 1024,
        };

        (invoke as Mock).mockResolvedValueOnce(mockResponse);
        await manager.ensureUploaded('node-1', '/path/to/file.png', 'image');

        // Setup for delete
        (invoke as Mock).mockResolvedValueOnce(undefined);
        await manager.cleanup('node-1');

        expect(manager.getFileInfo('node-1')).toBeNull();
      });

      it('should handle non-existent node gracefully', async () => {
        const manager = new ReplicateFileManager();
        await expect(manager.cleanup('non-existent')).resolves.toBeUndefined();
      });
    });

    describe('cleanupAll', () => {
      it('should delete all uploaded files', async () => {
        const manager = new ReplicateFileManager();
        const mockResponse1 = {
          id: 'file-1',
          urls: { get: 'https://replicate.com/file-1' },
          content_type: 'image/png',
          size: 1024,
        };
        const mockResponse2 = {
          id: 'file-2',
          urls: { get: 'https://replicate.com/file-2' },
          content_type: 'image/png',
          size: 1024,
        };

        // Use mockImplementation to handle sequence
        let uploadCount = 0;
        (invoke as Mock).mockImplementation(() => {
          uploadCount++;
          if (uploadCount === 1) return Promise.resolve(mockResponse1);
          if (uploadCount === 2) return Promise.resolve(mockResponse2);
          return Promise.resolve(undefined); // deletions
        });

        await manager.ensureUploaded('node-1', '/path/file1.png', 'image');
        await manager.ensureUploaded('node-2', '/path/file2.png', 'image');

        await manager.cleanupAll();

        expect(manager.getFileInfo('node-1')).toBeNull();
        expect(manager.getFileInfo('node-2')).toBeNull();
      });
    });

    describe('getFileInfo', () => {
      it('should return null for unknown node', () => {
        const manager = new ReplicateFileManager();
        expect(manager.getFileInfo('unknown')).toBeNull();
      });
    });
  });
});
