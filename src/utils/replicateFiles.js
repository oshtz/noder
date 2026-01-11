/**
 * Replicate Files API utility functions
 * Handles automatic file uploads and cleanup for media nodes
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Check if a Replicate URL is still valid/accessible
 * @param {string} url - The Replicate URL to check
 * @returns {Promise<boolean>} True if URL is still accessible
 */
export async function isReplicateUrlValid(url) {
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
 * @param {Object} cacheInfo - Object with { replicateUrl, replicateExpiresAt, uploadedMediaPath }
 * @param {string} currentMediaPath - The current media path to compare
 * @param {boolean} verifyUrl - Whether to make a HEAD request to verify (default: true)
 * @returns {Promise<boolean>} True if cache is valid
 */
export async function isCacheValid(cacheInfo, currentMediaPath, verifyUrl = true) {
  const { replicateUrl, replicateExpiresAt, uploadedMediaPath } = cacheInfo || {};

  // No cached URL
  if (!replicateUrl) {
    console.log('[ReplicateFiles] Cache miss: no replicateUrl');
    return false;
  }

  // Media path changed - need to re-upload
  if (uploadedMediaPath && uploadedMediaPath !== currentMediaPath) {
    console.log('[ReplicateFiles] Cache miss: mediaPath changed', { uploadedMediaPath, currentMediaPath });
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

/**
 * Upload a local file to Replicate Files API
 * @param {string} filePath - Local file path
 * @param {string} mediaType - Type of media (image, video, audio)
 * @returns {Promise<{id: string, url: string}>} File ID and URL
 */
export async function uploadFileToReplicate(filePath, mediaType = 'image') {
  try {
    // Determine content type based on media type and extension
    const extension = filePath.toLowerCase().split('.').pop();
    let contentType = 'application/octet-stream';
    
    if (mediaType === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
      const typeMap = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp'
      };
      contentType = typeMap[extension] || 'image/png';
    } else if (mediaType === 'video' || ['mp4', 'webm', 'mov'].includes(extension)) {
      const typeMap = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime'
      };
      contentType = typeMap[extension] || 'video/mp4';
    } else if (mediaType === 'audio' || ['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
      const typeMap = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac'
      };
      contentType = typeMap[extension] || 'audio/mpeg';
    }

    // Extract filename from path
    const filename = filePath.split(/[\\/]/).pop() || `upload.${extension}`;

    console.log(`[ReplicateFiles] Uploading file: ${filename} (${contentType})`);

    const response = await invoke('replicate_upload_file', {
      filePath,
      filename,
      contentType
    });

    console.log(`[ReplicateFiles] File uploaded successfully:`, response);
    console.log(`[ReplicateFiles] Extracted URL for use:`, response.urls.get);

    return {
      id: response.id,
      url: response.urls.get,
      contentType: response.content_type,
      size: response.size,
      expiresAt: response.expires_at
    };
  } catch (error) {
    console.error('[ReplicateFiles] Upload failed:', error);
    throw new Error(`Failed to upload file to Replicate: ${error.message || error}`);
  }
}

/**
 * Delete a file from Replicate Files API
 * @param {string} fileId - Replicate file ID
 * @returns {Promise<void>}
 */
export async function deleteFileFromReplicate(fileId) {
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
 * @param {string} filePath - Local file path
 * @returns {boolean} True if file should be uploaded
 */
export function shouldUploadFile(filePath) {
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

/**
 * Manage file lifecycle - upload when needed, cleanup when done
 */
export class ReplicateFileManager {
  constructor() {
    this.uploadedFiles = new Map(); // nodeId -> { fileId, url, filePath }
  }

  /**
   * Upload a file for a node if needed
   * @param {string} nodeId - Node ID
   * @param {string} filePath - Local file path
   * @param {string} mediaType - Media type
   * @returns {Promise<string>} File URL
   */
  async ensureUploaded(nodeId, filePath, mediaType) {
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
      filePath
    });

    return result.url;
  }

  /**
   * Clean up uploaded file for a node
   * @param {string} nodeId - Node ID
   */
  async cleanup(nodeId) {
    const fileInfo = this.uploadedFiles.get(nodeId);
    if (fileInfo && fileInfo.fileId) {
      await deleteFileFromReplicate(fileInfo.fileId);
      this.uploadedFiles.delete(nodeId);
    }
  }

  /**
   * Clean up all uploaded files
   */
  async cleanupAll() {
    const deletePromises = Array.from(this.uploadedFiles.values())
      .filter(info => info.fileId)
      .map(info => deleteFileFromReplicate(info.fileId));
    
    await Promise.allSettled(deletePromises);
    this.uploadedFiles.clear();
  }

  /**
   * Get uploaded file info for a node
   * @param {string} nodeId - Node ID
   * @returns {Object|null} File info or null
   */
  getFileInfo(nodeId) {
    return this.uploadedFiles.get(nodeId) || null;
  }
}

// Global file manager instance
export const globalFileManager = new ReplicateFileManager();