import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { FaImage } from 'react-icons/fa';
import { on } from '../utils/eventBus';
import './ImagePreviewStrip.css';

/**
 * Simple hash function for generating stable keys from strings
 */
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
};

export const ImagePreviewStrip = ({ nodeId }) => {
  const { getEdges, getNodes } = useReactFlow();
  const [imageUrls, setImageUrls] = useState([]);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [failedImages, setFailedImages] = useState(new Set());
  const previousUrlsRef = useRef([]);

  /**
   * Extract image URL from a node's data with proper priority order
   * Priority: convertedSrc (base64) > output (generated) > imageUrl > mediaPath
   */
  const extractImageUrl = useCallback((node) => {
    if (!node?.data) return null;

    const { data } = node;

    // Helper to check if a string is a valid image URL/path
    const isValidImageUrl = (str) => {
      if (!str || typeof str !== 'string') return false;
      // Check for data URLs (base64 images)
      if (str.startsWith('data:image/')) return true;
      // Check for HTTP/HTTPS URLs
      if (str.startsWith('http://') || str.startsWith('https://')) return true;
      // Check for local file paths (Windows or Unix style)
      if (str.match(/^[A-Za-z]:[\\/]/) || str.startsWith('/')) return true;
      // Reject if it looks like text content (contains newlines or is very long without URL indicators)
      if (str.includes('\n') || (str.length > 100 && !str.includes('/'))) return false;
      return false;
    };

    // Priority 1: convertedSrc from Media nodes (base64 data URL - most reliable)
    if (data.convertedSrc && typeof data.convertedSrc === 'string') {
      // Ensure it's actually an image
      if (data.mediaType === 'image' || data.convertedSrc.startsWith('data:image/')) {
        return data.convertedSrc;
      }
    }

    // Priority 2: output from generation nodes (Replicate Image, etc.)
    if (data.output && typeof data.output === 'string' && isValidImageUrl(data.output)) {
      return data.output;
    }

    // Priority 3: imageUrl field (used by video nodes and others)
    if (data.imageUrl && typeof data.imageUrl === 'string' && isValidImageUrl(data.imageUrl)) {
      return data.imageUrl;
    }

    // Priority 4: mediaPath from Media nodes (if it's a data URL or valid path)
    if (data.mediaPath && typeof data.mediaPath === 'string') {
      // Only use if it's a data URL or could be a valid image path
      if ((data.mediaPath.startsWith('data:') || data.mediaType === 'image') && isValidImageUrl(data.mediaPath)) {
        return data.mediaPath;
      }
    }

    return null;
  }, []);

  /**
   * Collect image URLs from all connected source nodes
   * Supports multiple input handles: 'in', 'image-in', etc.
   */
  const collectImageUrls = useCallback(() => {
    const edges = getEdges();
    const nodes = getNodes();

    // Find all edges connected to this node's input handles
    // Support common handle names: 'in', 'image-in', 'text-in', etc.
    const connectedEdges = edges.filter(
      edge => edge.target === nodeId &&
              (edge.targetHandle === 'in' ||
               edge.targetHandle === 'image-in' ||
               edge.targetHandle?.includes('in'))
    );

    // Get source nodes and extract image URLs
    const urls = connectedEdges
      .map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        return sourceNode ? extractImageUrl(sourceNode) : null;
      })
      .filter(url => url !== null && url !== '');

    // Only update state if URLs actually changed (avoid unnecessary re-renders)
    const urlsChanged =
      urls.length !== previousUrlsRef.current.length ||
      urls.some((url, index) => url !== previousUrlsRef.current[index]);

    if (urlsChanged) {
      previousUrlsRef.current = urls;
      setImageUrls(urls);
      // Reset failed images when URLs change
      setFailedImages(new Set());
    }
  }, [nodeId, getEdges, getNodes, extractImageUrl]);

  /**
   * Listen for connection changes and node content changes to trigger updates
   */
  useEffect(() => {
    const handleConnectionChange = () => {
      setUpdateTrigger(prev => prev + 1);
    };

    const handleNodeContentChange = (event) => {
      const { sourceId, targetId } = event.detail || {};
      
      // Update if this node is the target, or if a source node changed
      if (targetId === nodeId) {
        setUpdateTrigger(prev => prev + 1);
        return;
      }

      // Check if the changed node is one of our source nodes
      const edges = getEdges();
      const sourceNodeIds = edges
        .filter(edge => edge.target === nodeId)
        .map(edge => edge.source);
      
      if (sourceNodeIds.includes(sourceId)) {
        setUpdateTrigger(prev => prev + 1);
      }
    };

    // Listen for edge and content change events
    const offNodeConnection = on('nodeConnection', handleConnectionChange);
    const offDeleteEdge = on('deleteEdge', handleConnectionChange);
    const offEdgesChange = on('edgesChange', handleConnectionChange);
    const offNodeContentChanged = on('nodeContentChanged', handleNodeContentChange);
    
    return () => {
      offNodeConnection();
      offDeleteEdge();
      offEdgesChange();
      offNodeContentChanged();
    };
  }, [nodeId, getEdges]);

  /**
   * Update image URLs whenever connections or nodes change
   */
  useEffect(() => {
    collectImageUrls();
  }, [collectImageUrls, updateTrigger]);

  /**
   * Initial load
   */
  useEffect(() => {
    collectImageUrls();
  }, []);

  /**
   * Handle image load errors with logging
   */
  const handleImageError = useCallback((url, index) => {
    console.error('Failed to load image preview:', {
      url: url.substring(0, 100) + '...',
      index,
      isDataUrl: url.startsWith('data:'),
      mimeType: url.startsWith('data:') ? url.split(';')[0].split(':')[1] : 'unknown'
    });
    setFailedImages(prev => new Set([...prev, index]));
  }, []);

  /**
   * Handle successful image loads with logging
   */
  const handleImageLoad = useCallback((url, index) => {
    console.log('Successfully loaded image preview:', {
      url: url.substring(0, 100) + '...',
      index,
      mimeType: url.startsWith('data:') ? url.split(';')[0].split(':')[1] : 'unknown'
    });
    // Remove from failed images if it was there
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  /**
   * Generate stable keys for image items based on URL content
   */
  const imageKeys = useMemo(() => {
    return imageUrls.map((url, index) => {
      // Use a hash of the URL for stable keys (prevents unnecessary re-renders)
      const urlHash = url.substring(0, 50) + url.length;
      return `${index}-${urlHash}`;
    });
  }, [imageUrls]);

  // Don't render if no images
  if (imageUrls.length === 0) {
    return null;
  }

  return (
    <div
      className="image-preview-strip"
      role="list"
      aria-label="Connected image previews"
    >
      {imageUrls.map((url, index) => {
        const isFailed = failedImages.has(index);
        const key = imageKeys[index];
        
        return (
          <div
            key={key}
            className="image-preview-item"
            role="listitem"
          >
            {!isFailed ? (
              <img
                src={url}
                alt={`Connected image ${index + 1}`}
                className="image-preview-thumbnail"
                onError={() => handleImageError(url, index)}
                onLoad={() => handleImageLoad(url, index)}
                loading="lazy"
                draggable={false}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#888',
                  userSelect: 'none'
                }}
                role="img"
                aria-label="Failed to load image"
              >
                <FaImage size={20} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ImagePreviewStrip;
