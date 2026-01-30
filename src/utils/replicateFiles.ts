/**
 * Replicate Files API utility functions
 * Handles automatic file uploads and cleanup for media nodes
 */

import { invoke } from '../types/tauri';
import type { ReplicateFileUpload } from '../types/tauri';

// =============================================================================
// Types
// =============================================================================

/** Media type for file uploads */
export type MediaType = 'image' | 'video' | 'audio';

/** Cache info for checking validity */
export interface CacheInfo {
  replicateUrl?: string | null;
  replicateExpiresAt?: string | null;
  uploadedMediaPath?: string | null;
}

/** Upload result from Replicate */
export interface UploadResult {
  id: string;
  url: string;
  contentType: string;
  size: number;
  expiresAt?: string | null;
}

/** Stored file info for a node */
export interface FileInfo {
  fileId: string;
  url: string;
  filePath: string;
}

// =============================================================================
// Content Type Maps
// =============================================================================

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const VIDEO_CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

const AUDIO_CONTENT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Check if a Replicate URL is still valid/accessible
 * @param url - The Replicate URL to check
 * @returns True if URL is still accessible
 */
export async function isReplicateUrlValid(url: string | null | undefined): Promise<boolean> {
  if (!url) return false;

  try {
    // Use HEAD request to check if URL is accessible without downloading
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok; // 200-299 status codes
  } catch (error) {
    console.warn('[ReplicateFiles] URL validation failed:', error);
    return false;
  }
}

/**
 * Check if a cached Replicate upload is still valid
 * @param cacheInfo - Object with cache info
 * @param currentMediaPath - The current media path to compare
 * @param verifyUrl - Whether to make a HEAD request to verify (default: true)
 * @returns True if cache is valid
 */
export async function isCacheValid(
  cacheInfo: CacheInfo | null | undefined,
  currentMediaPath: string | null | undefined,
  verifyUrl = true
): Promise<boolean> {
  const { replicateUrl, replicateExpiresAt, uploadedMediaPath } = cacheInfo || {};

  // No cached URL
  if (!replicateUrl) {
    console.log('[ReplicateFiles] Cache miss: no replicateUrl');
    return false;
  }

  // Media path changed - need to re-upload
  if (uploadedMediaPath && uploadedMediaPath !== currentMediaPath) {
    console.log('[ReplicateFiles] Cache miss: mediaPath changed', {
      uploadedMediaPath,
      currentMediaPath,
    });
    return false;
  }

  // Check expiration (with 5 minute buffer)
  if (replicateExpiresAt) {
    const expiresAt = new Date(replicateExpiresAt).getTime();
    const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
    if (Date.now() > expiresAt - bufferMs) {
      console.log('[ReplicateFiles] Cache miss: URL expired or expiring soon');
      return false;
    }
  }

  // Optionally verify URL is still accessible
  if (verifyUrl) {
    const isValid = await isReplicateUrlValid(replicateUrl);
    if (!isValid) {
      console.log('[ReplicateFiles] Cache miss: URL no longer accessible');
      return false;
    }
  }

  console.log('[ReplicateFiles] Cache hit: using existing replicateUrl');
  return true;
}

// =============================================================================
// Upload Functions
// =============================================================================

/**
 * Get content type for a file based on media type and extension
 */
function getContentType(filePath: string, mediaType: MediaType): string {
  const extension = filePath.toLowerCase().split('.').pop() || '';

  if (mediaType === 'image' || Object.keys(IMAGE_CONTENT_TYPES).includes(extension)) {
    return IMAGE_CONTENT_TYPES[extension] || 'image/png';
  }

  if (mediaType === 'video' || Object.keys(VIDEO_CONTENT_TYPES).includes(extension)) {
    return VIDEO_CONTENT_TYPES[extension] || 'video/mp4';
  }

  if (mediaType === 'audio' || Object.keys(AUDIO_CONTENT_TYPES).includes(extension)) {
    return AUDIO_CONTENT_TYPES[extension] || 'audio/mpeg';
  }

  return 'application/octet-stream';
}

/**
 * Upload a local file to Replicate Files API
 * @param filePath - Local file path
 * @param mediaType - Type of media (image, video, audio)
 * @returns File ID and URL
 */
export async function uploadFileToReplicate(
  filePath: string,
  mediaType: MediaType = 'image'
): Promise<UploadResult> {
  try {
    const extension = filePath.toLowerCase().split('.').pop() || '';
    const contentType = getContentType(filePath, mediaType);

    // Extract filename from path
    const filename = filePath.split(/[\\/]/).pop() || `upload.${extension}`;

    console.log(`[ReplicateFiles] Uploading file: ${filename} (${contentType})`);

    const response: ReplicateFileUpload = await invoke('replicate_upload_file', {
      filePath,
      filename,
      contentType,
    });

    console.log(`[ReplicateFiles] File uploaded successfully:`, response);
    console.log(`[ReplicateFiles] Extracted URL for use:`, response.urls.get);

    return {
      id: response.id,
      url: response.urls.get,
      contentType: response.content_type,
      size: response.size,
      expiresAt: response.expires_at,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[ReplicateFiles] Upload failed:', err);
    throw new Error(`Failed to upload file to Replicate: ${err.message}`);
  }
}

/**
 * Delete a file from Replicate Files API
 * @param fileId - Replicate file ID
 */
export async function deleteFileFromReplicate(fileId: string | null | undefined): Promise<void> {
  if (!fileId) {
    console.warn('[ReplicateFiles] No file ID provided for deletion');
    return;
  }

  try {
    console.log(`[ReplicateFiles] Deleting file: ${fileId}`);
    await invoke('replicate_delete_file', { fileId });
    console.log(`[ReplicateFiles] File deleted successfully: ${fileId}`);
  } catch (error) {
    // Don't throw on delete errors - just log them
    // Files may already be deleted or expired
    console.warn(`[ReplicateFiles] Failed to delete file ${fileId}:`, error);
  }
}

/**
 * Check if a file path should be uploaded to Replicate
 * @param filePath - Local file path
 * @returns True if file should be uploaded
 */
export function shouldUploadFile(filePath: string | null | undefined): boolean {
  if (!filePath) return false;

  // Don't upload if it's already a URL
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return false;
  }

  // Don't upload if it's a data URL
  if (filePath.startsWith('data:')) {
    return false;
  }

  // Upload local file paths
  return true;
}

// =============================================================================
// File Manager Class
// =============================================================================

/**
 * Manage file lifecycle - upload when needed, cleanup when done
 */
export class ReplicateFileManager {
  private uploadedFiles: Map<string, FileInfo>;

  constructor() {
    this.uploadedFiles = new Map();
  }

  /**
   * Upload a file for a node if needed
   * @param nodeId - Node ID
   * @param filePath - Local file path
   * @param mediaType - Media type
   * @returns File URL
   */
  async ensureUploaded(nodeId: string, filePath: string, mediaType: MediaType): Promise<string> {
    // Check if already uploaded for this node
    const existing = this.uploadedFiles.get(nodeId);
    if (existing && existing.filePath === filePath) {
      console.log(`[ReplicateFiles] Using cached upload for node ${nodeId}`);
      return existing.url;
    }

    // Check if should upload
    if (!shouldUploadFile(filePath)) {
      console.log(`[ReplicateFiles] File doesn't need upload: ${filePath}`);
      return filePath;
    }

    // Upload new file
    console.log(`[ReplicateFiles] Uploading file for node ${nodeId}`);
    const result = await uploadFileToReplicate(filePath, mediaType);

    // Clean up old file if exists
    if (existing && existing.fileId) {
      await deleteFileFromReplicate(existing.fileId);
    }

    // Store new file info
    this.uploadedFiles.set(nodeId, {
      fileId: result.id,
      url: result.url,
      filePath,
    });

    return result.url;
  }

  /**
   * Clean up uploaded file for a node
   * @param nodeId - Node ID
   */
  async cleanup(nodeId: string): Promise<void> {
    const fileInfo = this.uploadedFiles.get(nodeId);
    if (fileInfo && fileInfo.fileId) {
      await deleteFileFromReplicate(fileInfo.fileId);
      this.uploadedFiles.delete(nodeId);
    }
  }

  /**
   * Clean up all uploaded files
   */
  async cleanupAll(): Promise<void> {
    const deletePromises = Array.from(this.uploadedFiles.values())
      .filter((info) => info.fileId)
      .map((info) => deleteFileFromReplicate(info.fileId));

    await Promise.allSettled(deletePromises);
    this.uploadedFiles.clear();
  }

  /**
   * Get uploaded file info for a node
   * @param nodeId - Node ID
   * @returns File info or null
   */
  getFileInfo(nodeId: string): FileInfo | null {
    return this.uploadedFiles.get(nodeId) || null;
  }
}

// =============================================================================
// Global Instance
// =============================================================================

/** Global file manager instance */
export const globalFileManager = new ReplicateFileManager();
