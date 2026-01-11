import React, { useState, useEffect } from 'react';
import { FaMusic } from 'react-icons/fa';
import BaseNode from '../../components/BaseNode';
import { NodeSettingsPopover } from '../../components/NodeSettingsPopover';
import { SchemaForm } from '../../components/SchemaForm';
import NodeSettingsClipboard from '../../components/NodeSettingsClipboard';
import { HANDLE_TYPES } from '../../constants/handleTypes';
import { invoke } from '@tauri-apps/api/core';
import { getNodeSchema, parseNodeData } from '../nodeSchemas';
import { uploadFileToReplicate, deleteFileFromReplicate, shouldUploadFile, isCacheValid } from '../../utils/replicateFiles';
import { on, emit } from '../../utils/eventBus';

export const NODE_TYPE = 'media';
const definition = getNodeSchema(NODE_TYPE);
const handles = definition?.handles || [];

const MediaNode = ({ id, data, selected }) => {
  const [formState, setFormState] = useState(() => parseNodeData(definition, data));
  const [mediaPath, setMediaPath] = useState(data.mediaPath || '');
  const [mediaType, setMediaType] = useState(data.mediaType || 'image');
  const [convertedSrc, setConvertedSrc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replicateFileId, setReplicateFileId] = useState(data.replicateFileId || null);
  const [replicateUrl, setReplicateUrl] = useState(data.replicateUrl || null);
  const [replicateExpiresAt, setReplicateExpiresAt] = useState(data.replicateExpiresAt || null);
  const [uploadedMediaPath, setUploadedMediaPath] = useState(data.uploadedMediaPath || null);
  const [uploadStatus, setUploadStatus] = useState(data.replicateUrl ? 'uploaded' : 'idle'); // idle, uploading, uploaded, error

  // Sync local state with data prop when it changes (e.g., from gallery drag-drop)
  useEffect(() => {
    if (data.mediaPath && data.mediaPath !== mediaPath) {
      console.log('[MediaNode] Syncing mediaPath from data prop:', data.mediaPath);
      setMediaPath(data.mediaPath);
    }
    if (data.mediaType && data.mediaType !== mediaType) {
      console.log('[MediaNode] Syncing mediaType from data prop:', data.mediaType);
      setMediaType(data.mediaType);
    }
  }, [data.mediaPath, data.mediaType]);

  // Check if a path is a URL
  const isUrl = (path) => {
    return path && (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:'));
  };

  // Load file as base64 for local preview, or use URL directly
  useEffect(() => {
    if (mediaPath) {
      // If it's a URL, use it directly
      if (isUrl(mediaPath)) {
        console.log('[MediaNode] Using URL directly:', mediaPath);
        setConvertedSrc(mediaPath);
        data.convertedSrc = mediaPath;
        setLoading(false);
        setError('');
        return;
      }

      // Otherwise, load local file as base64
      setLoading(true);
      setError('');
      invoke('read_file_as_base64', { filePath: mediaPath })
        .then((dataUrl) => {
          setConvertedSrc(dataUrl);
          data.convertedSrc = dataUrl;
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error loading media file:', err);
          setError('Failed to load media file');
          setLoading(false);
        });
    }
  }, [mediaPath, data]);

  // Auto-upload to Replicate when file changes (respects autoUpload setting)
  // Skips upload if we have a valid cached URL for the same file
  useEffect(() => {
    if (!mediaPath || !shouldUploadFile(mediaPath) || formState.autoUpload !== 'true') {
      return;
    }

    const uploadFile = async () => {
      try {
        // Check if we have a valid cached URL for this file
        const cacheInfo = {
          replicateUrl: data.replicateUrl || replicateUrl,
          replicateExpiresAt: data.replicateExpiresAt || replicateExpiresAt,
          uploadedMediaPath: data.uploadedMediaPath || uploadedMediaPath
        };

        const cacheValid = await isCacheValid(cacheInfo, mediaPath);

        if (cacheValid) {
          console.log(`[MediaNode] Using cached Replicate URL for node ${id}`);
          // Ensure local state matches cached data
          if (data.replicateUrl && data.replicateUrl !== replicateUrl) {
            setReplicateUrl(data.replicateUrl);
          }
          if (data.replicateFileId && data.replicateFileId !== replicateFileId) {
            setReplicateFileId(data.replicateFileId);
          }
          setUploadStatus('uploaded');
          return;
        }

        setUploadStatus('uploading');
        console.log(`[MediaNode] Auto-uploading file for node ${id}`);

        // Delete old file if exists
        if (replicateFileId) {
          await deleteFileFromReplicate(replicateFileId);
        }

        // Upload new file
        const result = await uploadFileToReplicate(mediaPath, mediaType);

        setReplicateFileId(result.id);
        setReplicateUrl(result.url);
        setReplicateExpiresAt(result.expiresAt);
        setUploadedMediaPath(mediaPath);
        setUploadStatus('uploaded');

        // Store in node data and update parent state
        data.replicateFileId = result.id;
        data.replicateUrl = result.url;
        data.replicateExpiresAt = result.expiresAt;
        data.uploadedMediaPath = mediaPath;

        // Emit event to update the node in parent state
        emit('nodeDataUpdated', {
          nodeId: id,
          updates: {
            replicateFileId: result.id,
            replicateUrl: result.url,
            replicateExpiresAt: result.expiresAt,
            uploadedMediaPath: mediaPath
          }
        });

        console.log(`[MediaNode] File uploaded successfully for node ${id}:`, result.url);
      } catch (err) {
        console.error(`[MediaNode] Failed to upload file for node ${id}:`, err);
        setUploadStatus('error');
        setError('Failed to upload to Replicate');
      }
    };

    uploadFile();
  }, [mediaPath, mediaType, id, formState.autoUpload]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (replicateFileId) {
        console.log(`[MediaNode] Cleaning up file for node ${id}`);
        deleteFileFromReplicate(replicateFileId).catch(err => {
          console.warn(`[MediaNode] Cleanup failed for node ${id}:`, err);
        });
      }
    };
  }, [replicateFileId, id]);

  // Listen for content changes from upload
  useEffect(() => {
    const handleContentChange = (event) => {
      if (event.detail.targetId === id) {
        const { type, value } = event.detail.content;
        setMediaType(type);
        setMediaPath(value);
        data.mediaType = type;
        data.mediaPath = value;
        
        // Reset Replicate state when new file is loaded
        setReplicateFileId(null);
        setReplicateUrl(null);
        setReplicateExpiresAt(null);
        setUploadedMediaPath(null);
        setUploadStatus('idle');
      }
    };

    const offNodeContentChanged = on('nodeContentChanged', handleContentChange);
    return () => offNodeContentChanged();
  }, [id, data]);

  // Use static handles from schema - no dynamic changes needed
  const staticHandles = handles;

  const renderMedia = () => {
    const showUploadBadge = formState.showUploadStatus === 'true';
    const shouldAutoPlay = formState.autoPlay === 'true';
    const shouldLoop = formState.loop === 'true';
    const imageFit = formState.objectFit || 'contain';

    if (loading) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#888',
          fontSize: '14px',
          gap: '8px'
        }}>
          <div>Loading media...</div>
          {uploadStatus === 'uploading' && showUploadBadge && (
            <div style={{ fontSize: '12px', opacity: 0.7 }}>
              Uploading to Replicate...
            </div>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#f44336',
          fontSize: '14px'
        }}>
          {error}
        </div>
      );
    }

    if (!convertedSrc) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#888',
          fontSize: '14px'
        }}>
          No media loaded
        </div>
      );
    }

    switch (mediaType) {
      case 'image':
        return (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img
              src={convertedSrc}
              alt="Uploaded media"
              style={{
                width: '100%',
                height: '100%',
                objectFit: imageFit,
                borderRadius: '8px'
              }}
            />
            {showUploadBadge && uploadStatus === 'uploaded' && replicateUrl && (
              <div style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#4ade80',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>✓</span>
                <span>Uploaded</span>
              </div>
            )}
            {showUploadBadge && uploadStatus === 'uploading' && (
              <div style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fbbf24',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px'
              }}>
                Uploading...
              </div>
            )}
          </div>
        );
      case 'video':
        return (
          <video
            src={convertedSrc}
            controls
            autoPlay={shouldAutoPlay}
            loop={shouldLoop}
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: imageFit,
              display: 'block',
              borderRadius: '8px'
            }}
          />
        );
      case 'audio':
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '10px'
          }}>
            <div style={{
              color: HANDLE_TYPES.AUDIO.color
            }}>
              <FaMusic size={48} />
            </div>
            <audio
              src={convertedSrc}
              controls
              autoPlay={shouldAutoPlay}
              loop={shouldLoop}
              style={{
                width: '90%',
                maxWidth: '300px'
              }}
            />
          </div>
        );
      default:
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#888'
          }}>
            Unsupported media type
          </div>
        );
    }
  };

  return (
    <>
      <BaseNode
        id={id}
        data={{
          ...data,
          title: data.title || 'Media',
          metadata: mediaType ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1) : 'Media'
        }}
        selected={selected}
        handles={staticHandles}
        onSettingsClick={() => {}}
        contentStyle={{
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden'
        }}
        dragHandleStyle={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '16px',
          minHeight: 0,
          padding: 0,
          zIndex: 2
        }}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {renderMedia()}
        </div>
      </BaseNode>

      <NodeSettingsPopover
        isOpen={selected}
        onClose={() => {}}
        title="Media Settings"
        renderToPortal={true}
      >
        <NodeSettingsClipboard
          nodeType={NODE_TYPE}
          values={formState}
          onApply={(next) => {
            setFormState(next);
            Object.assign(data, next);
          }}
        />
        <SchemaForm
          definition={definition}
          values={formState}
          onChange={(next) => {
            setFormState(next);
            Object.assign(data, next);
          }}
        />
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(100, 100, 100, 0.1)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--text-color)',
          opacity: 0.8
        }}>
          <div style={{ marginBottom: '8px', fontWeight: 500 }}>Upload Status:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>File: {mediaPath ? mediaPath.split(/[/\\]/).pop() : 'No file loaded'}</div>
            {replicateUrl && (
              <div style={{ color: '#4ade80' }}>
                ✓ Uploaded to Replicate
              </div>
            )}
            {uploadStatus === 'uploading' && (
              <div style={{ color: '#fbbf24' }}>
                ⟳ Uploading...
              </div>
            )}
            {uploadStatus === 'error' && (
              <div style={{ color: '#ef4444' }}>
                ✗ Upload failed
              </div>
            )}
          </div>
        </div>
      </NodeSettingsPopover>
    </>
  );
};

export const createNode = ({ id, position, handleRemoveNode }) => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  data: {
    title: 'Media',
    onRemove: handleRemoveNode,
    mediaPath: '',
    mediaType: 'image',
    replicateFileId: null,
    replicateUrl: null,
    replicateExpiresAt: null,
    uploadedMediaPath: null,
    handles,
    ...definition.defaults
  },
  style: { width: 300, height: 300 }
});

export default MediaNode;
