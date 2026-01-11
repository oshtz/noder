import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  FaSearch, FaImage, FaPlay, FaMusic, FaTh, FaList, FaQuestion, FaInfoCircle,
  FaExpand, FaCompress, FaTimes, FaChevronLeft, FaChevronRight, FaSearchMinus,
  FaSearchPlus, FaUndo, FaDownload, FaTrash, FaSpinner, FaPlus, FaFileAlt,
  FaColumns, FaExchangeAlt
} from 'react-icons/fa';
import './OutputGallery.css';

/**
 * Check if a value is a local file path (not a URL)
 */
const isLocalPath = (value) => {
  if (!value || typeof value !== 'string') return false;
  return !value.startsWith('http://') &&
         !value.startsWith('https://') &&
         !value.startsWith('data:') &&
         (value.match(/^[A-Za-z]:[\\/]/) || value.startsWith('/'));
};

export const OutputGallery = ({ outputs = [], onClose, database = null, onDraggingChange = null, onGalleryDragStart = null, onGalleryDragEnd = null }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [allOutputs, setAllOutputs] = useState(outputs);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [convertedSrcs, setConvertedSrcs] = useState({});
  const [loadingImages, setLoadingImages] = useState({});
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [imageTransition, setImageTransition] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('noder-gallery-view-mode') || 'list';
    } catch {
      return 'list';
    }
  }); // 'list', 'grid', or 'compare'
  const [compareLeftIndex, setCompareLeftIndex] = useState(0);
  const [compareRightIndex, setCompareRightIndex] = useState(1);
  const [compareTarget, setCompareTarget] = useState('left'); // 'left' or 'right'
  const [filterType, setFilterType] = useState('all'); // 'all', 'image', 'video', 'audio', 'text'
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const thumbnailsRef = useRef(null);
  const pendingLoadsRef = useRef(new Set()); // Track pending loads to avoid race conditions
  const convertedSrcsRef = useRef({}); // Mirror of convertedSrcs for synchronous access

  // Persist viewMode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('noder-gallery-view-mode', viewMode);
    } catch (error) {
      console.error('Failed to save gallery view mode:', error);
    }
  }, [viewMode]);
  const viewerRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const gridRef = useRef(null);
  const ITEMS_PER_PAGE = 20;

  const convertLocalFile = useCallback(async (filePath, outputId) => {
    if (!filePath || !isLocalPath(filePath)) return null;

    const cacheKey = outputId || filePath;
    
    // Use refs for synchronous checks to avoid race conditions with stale closures
    // Check if already converted or currently loading
    if (convertedSrcsRef.current[cacheKey]) return convertedSrcsRef.current[cacheKey];
    if (pendingLoadsRef.current.has(cacheKey)) return null;
    
    // Mark as pending immediately using ref (synchronous, no stale closure)
    pendingLoadsRef.current.add(cacheKey);
    setLoadingImages(prev => ({ ...prev, [cacheKey]: true }));

    try {
      const dataUrl = await invoke('read_file_as_base64', { filePath });
      // Update both ref (for synchronous access) and state (for re-render)
      convertedSrcsRef.current[cacheKey] = dataUrl;
      setConvertedSrcs(prev => ({ ...prev, [cacheKey]: dataUrl }));
      setLoadingImages(prev => ({ ...prev, [cacheKey]: false }));
      return dataUrl;
    } catch (error) {
      console.error(`Failed to convert local file: ${filePath}`, error);
      pendingLoadsRef.current.delete(cacheKey); // Allow retry on error
      setLoadingImages(prev => ({ ...prev, [cacheKey]: false }));
      return null;
    }
  }, []);

  const getDisplaySrc = useCallback((output) => {
    const cacheKey = output.id || output.value;
    if (convertedSrcs[cacheKey]) {
      return convertedSrcs[cacheKey];
    }
    return output.value;
  }, [convertedSrcs]);

  // Filter outputs based on type and search
  const filteredOutputs = useMemo(() => {
    let filtered = allOutputs;
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(output => output.type === filterType);
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(output => 
        (output.prompt && output.prompt.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (output.model && output.model.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    return filtered;
  }, [allOutputs, filterType, searchQuery]);

  useEffect(() => {
    if (!filteredOutputs.length) return;
    setCompareLeftIndex(prev => Math.min(prev, filteredOutputs.length - 1));
    setCompareRightIndex(prev => Math.min(prev, filteredOutputs.length - 1));
  }, [filteredOutputs.length]);

  useEffect(() => {
    if (filteredOutputs.length < 2) return;
    if (compareLeftIndex === compareRightIndex) {
      setCompareRightIndex(compareLeftIndex === 0 ? 1 : 0);
    }
  }, [compareLeftIndex, compareRightIndex, filteredOutputs.length]);

  useEffect(() => {
    if (viewMode !== 'compare') return;
    const leftOutput = filteredOutputs[compareLeftIndex];
    const rightOutput = filteredOutputs[compareRightIndex];
    [leftOutput, rightOutput].forEach((output) => {
      if (output && isLocalPath(output.value) && output.type !== 'text') {
        convertLocalFile(output.value, output.id);
      }
    });
  }, [viewMode, compareLeftIndex, compareRightIndex, filteredOutputs, convertLocalFile]);

  // Reset zoom when changing images
  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  // Navigate with transition effect
  const navigateTo = useCallback((index) => {
    if (index < 0 || index >= filteredOutputs.length) return;
    setImageTransition(true);
    // Only switch to list view if we're currently in grid mode
    if (viewMode === 'grid') {
      setViewMode('list');
    }
    setTimeout(() => {
      setSelectedIndex(index);
      resetZoom();
      setImageTransition(false);
      
      // Scroll thumbnail into view
      if (thumbnailsRef.current) {
        const thumbnails = thumbnailsRef.current.children;
        const thumbnail = thumbnails[index];
        if (thumbnail) {
          thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }, 150);
  }, [filteredOutputs.length, resetZoom, viewMode]);

  const handlePrevious = useCallback(() => {
    if (selectedIndex > 0) navigateTo(selectedIndex - 1);
  }, [selectedIndex, navigateTo]);

  const handleNext = useCallback(() => {
    if (selectedIndex < filteredOutputs.length - 1) navigateTo(selectedIndex + 1);
  }, [selectedIndex, filteredOutputs.length, navigateTo]);

  const handleCompareSelect = useCallback((index) => {
    if (compareTarget === 'left') {
      setCompareLeftIndex(index);
      if (filteredOutputs.length > 1 && index === compareRightIndex) {
        setCompareRightIndex(index === 0 ? 1 : 0);
      }
    } else {
      setCompareRightIndex(index);
      if (filteredOutputs.length > 1 && index === compareLeftIndex) {
        setCompareLeftIndex(index === 0 ? 1 : 0);
      }
    }
  }, [compareTarget, compareRightIndex, compareLeftIndex, filteredOutputs.length]);

  const swapCompareSides = useCallback(() => {
    setCompareLeftIndex(compareRightIndex);
    setCompareRightIndex(compareLeftIndex);
  }, [compareLeftIndex, compareRightIndex]);

  const renderCompareMedia = (output) => {
    if (!output) {
      return <div className="compare-placeholder">No output selected</div>;
    }

    if (output.type === 'image') {
      return (
        <img
          src={getDisplaySrc(output)}
          alt={output.prompt || 'Comparison output'}
          className="compare-image"
          onError={(e) => {
            console.error('Failed to load image:', output.value);
            e.target.style.display = 'none';
          }}
        />
      );
    }

    if (output.type === 'video') {
      return (
        <video
          src={getDisplaySrc(output)}
          controls
          className="compare-video"
          onError={() => {
            console.error('Failed to load video:', output.value);
          }}
        />
      );
    }

    if (output.type === 'audio') {
      return (
        <audio
          src={getDisplaySrc(output)}
          controls
          className="compare-audio"
          onError={() => {
            console.error('Failed to load audio:', output.value);
          }}
        />
      );
    }

    return (
      <div className="compare-text">
        <pre>{output.value}</pre>
      </div>
    );
  };

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, 1));
  }, []);

  const handleDoubleClick = useCallback((e) => {
    e.preventDefault();
    if (zoomLevel > 1) {
      resetZoom();
    } else {
      setZoomLevel(2.5);
      // Center zoom on click position
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * -0.5;
      const y = (e.clientY - rect.top - rect.height / 2) * -0.5;
      setPanPosition({ x, y });
    }
  }, [zoomLevel, resetZoom]);

  // Pan controls
  const handleMouseDown = useCallback((e) => {
    if (zoomLevel > 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y };
    }
  }, [zoomLevel, panPosition]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning && zoomLevel > 1) {
      setPanPosition({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    }
  }, [isPanning, zoomLevel]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Thumbnail scroll controls
  const scrollThumbnails = useCallback((direction) => {
    if (thumbnailsRef.current) {
      const scrollAmount = 200;
      thumbnailsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  }, []);

  // Pre-convert visible local files from filtered outputs
  useEffect(() => {
    // Load first batch of filtered outputs (what's actually visible)
    const visibleOutputs = filteredOutputs.slice(0, 20);
    visibleOutputs.forEach(output => {
      if (isLocalPath(output.value) && output.type !== 'text') {
        convertLocalFile(output.value, output.id);
      }
    });
  }, [filteredOutputs, convertLocalFile]);

  // Convert current selection if it's a local file
  useEffect(() => {
    if (filteredOutputs[selectedIndex]) {
      const output = filteredOutputs[selectedIndex];
      if (isLocalPath(output.value) && output.type !== 'text') {
        convertLocalFile(output.value, output.id);
      }
    }
  }, [selectedIndex, filteredOutputs, convertLocalFile]);

  // Keyboard navigation with better UX
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't interfere with text inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcuts) {
          setShowShortcuts(false);
        } else if (searchQuery) {
          setSearchQuery('');
        } else if (zoomLevel > 1) {
          resetZoom();
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else if (viewMode === 'list') {
          setViewMode('grid');
        } else if (onClose) {
          onClose();
        }
      } else if (e.key === 'ArrowLeft' && viewMode === 'list') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight' && viewMode === 'list') {
        e.preventDefault();
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreen(prev => !prev);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setIsInfoCollapsed(prev => !prev);
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setViewMode(prev => prev === 'compare' ? 'list' : 'compare');
      } else if (e.key === '?' || e.key === '/') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      } else if (e.key === 'Home') {
        e.preventDefault();
        navigateTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        navigateTo(filteredOutputs.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, zoomLevel, showShortcuts, searchQuery, viewMode, handlePrevious, handleNext, handleZoomIn, handleZoomOut, resetZoom, onClose, navigateTo, filteredOutputs.length]);

  // Load outputs from database on mount
  useEffect(() => {
    if (database?.isInitialized && allOutputs.length === 0) {
      loadOutputs(0);
    }
  }, [database?.isInitialized]);

  // Update allOutputs when outputs prop changes
  useEffect(() => {
    if (outputs && outputs.length > 0) {
      setAllOutputs(outputs);
    }
  }, [outputs]);

  const loadOutputs = async (page = 0) => {
    if (!database?.isInitialized || isLoading) return;

    setIsLoading(true);
    try {
      const offset = page * ITEMS_PER_PAGE;
      const loadedOutputs = await database.getOutputs({
        limit: ITEMS_PER_PAGE,
        offset
      });

      if (loadedOutputs && loadedOutputs.length > 0) {
        if (page === 0) {
          setAllOutputs(loadedOutputs);
        } else {
          setAllOutputs(prev => [...prev, ...loadedOutputs]);
        }
        setHasMore(loadedOutputs.length === ITEMS_PER_PAGE);
        setCurrentPage(page);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load outputs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadOutputs(currentPage + 1);
    }
  };

  const handleDeleteOutput = async (outputId) => {
    if (!database?.isInitialized || !outputId) return;

    if (!window.confirm('Are you sure you want to delete this output? This action cannot be undone.')) return;

    try {
      await database.deleteOutput(outputId);
      const newOutputs = allOutputs.filter(o => o.id !== outputId);
      setAllOutputs(newOutputs);

      // Adjust selected index if needed
      if (newOutputs.length === 0) {
        setSelectedIndex(0);
      } else if (selectedIndex >= newOutputs.length) {
        setSelectedIndex(newOutputs.length - 1);
      }
    } catch (error) {
      console.error('Failed to delete output:', error);
      alert('Failed to delete output. Please try again.');
    }
  };

  if (!allOutputs || allOutputs.length === 0) {
    return (
      <div className="output-gallery empty">
        <div className="empty-state">
          <div className="empty-icon">
            <FaImage size={80} />
          </div>
          <h3>No Outputs Yet</h3>
          <p>Generated images, videos, and audio will appear here</p>
          <div className="empty-hint">
            <span>Run a generation node to see results</span>
          </div>
        </div>
      </div>
    );
  }

  const currentOutput = filteredOutputs[selectedIndex] || filteredOutputs[0];
  const compareLeftOutput = filteredOutputs[compareLeftIndex] || filteredOutputs[0];
  const compareRightOutput = filteredOutputs[compareRightIndex] || filteredOutputs[1] || filteredOutputs[0];
  const compareHasEnough = filteredOutputs.length > 1;
  const isCurrentLoading = currentOutput ? loadingImages[currentOutput.id || currentOutput.value] : false;

  const galleryContent = (
    <>
      {isFullscreen && <div className="gallery-fullscreen-backdrop" onClick={() => setIsFullscreen(false)} />}
      <div className={`output-gallery ${isFullscreen ? 'fullscreen' : ''} ${isInfoCollapsed ? 'info-collapsed' : ''} ${viewMode === 'grid' ? 'grid-mode' : ''} ${isDragging ? 'dragging' : ''}`}>
        {/* Header */}
        <div className="gallery-header">
          <div className="header-left">
            <h3>Output Gallery</h3>
            <span className="gallery-badge">{filteredOutputs.length} of {allOutputs.length} items</span>
          </div>
          <div className="header-center">
            {/* Search bar */}
            <div className="search-container">
              <FaSearch size={14} />
              <input
                type="text"
                placeholder="Search by prompt or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
              )}
            </div>
            
            {/* Filter buttons */}
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
                title="Show All"
              >
                All
              </button>
              <button
                className={`filter-btn ${filterType === 'image' ? 'active' : ''}`}
                onClick={() => setFilterType('image')}
                title="Images Only"
              >
                <FaImage size={14} />
              </button>
              <button
                className={`filter-btn ${filterType === 'video' ? 'active' : ''}`}
                onClick={() => setFilterType('video')}
                title="Videos Only"
              >
                <FaPlay size={14} />
              </button>
              <button
                className={`filter-btn ${filterType === 'audio' ? 'active' : ''}`}
                onClick={() => setFilterType('audio')}
                title="Audio Only"
              >
                <FaMusic size={14} />
              </button>
            </div>
          </div>
          <div className="gallery-controls">
            <button
              className={`gallery-button ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View (G)"
            >
              <FaTh size={16} />
            </button>
            <button
              className={`gallery-button ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View (G)"
            >
              <FaList size={16} />
            </button>
            <button
              className={`gallery-button ${viewMode === 'compare' ? 'active' : ''}`}
              onClick={() => setViewMode('compare')}
              title="Compare View (C)"
            >
              <FaColumns size={16} />
            </button>
            <button
              className="gallery-button"
              onClick={() => setShowShortcuts(!showShortcuts)}
              title="Keyboard Shortcuts (?)"
            >
              <FaQuestion size={16} />
            </button>
            <button
              className="gallery-button"
              onClick={() => setIsInfoCollapsed(!isInfoCollapsed)}
              title={isInfoCollapsed ? 'Show Info (I)' : 'Hide Info (I)'}
            >
              <FaInfoCircle size={16} />
            </button>
            <button
              className="gallery-button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? <FaCompress size={16} /> : <FaExpand size={16} />}
            </button>
            {onClose && (
              <button
                className="gallery-button close-button"
                onClick={onClose}
                title="Close Gallery"
              >
                <FaTimes size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Keyboard shortcuts popup */}
        {showShortcuts && (
          <div className="shortcuts-popup">
            <div className="shortcuts-header">
              <span>Keyboard Shortcuts</span>
              <button onClick={() => setShowShortcuts(false)}>×</button>
            </div>
            <div className="shortcuts-list">
              <div className="shortcut-item"><kbd>G</kbd><span>Toggle Grid/List View</span></div>
              <div className="shortcut-item"><kbd>C</kbd><span>Toggle Compare View</span></div>
              <div className="shortcut-item"><kbd>←</kbd><span>Previous (List View)</span></div>
              <div className="shortcut-item"><kbd>→</kbd><span>Next (List View)</span></div>
              <div className="shortcut-item"><kbd>+</kbd><span>Zoom In</span></div>
              <div className="shortcut-item"><kbd>-</kbd><span>Zoom Out</span></div>
              <div className="shortcut-item"><kbd>F</kbd><span>Toggle Fullscreen</span></div>
              <div className="shortcut-item"><kbd>I</kbd><span>Toggle Info Panel</span></div>
              <div className="shortcut-item"><kbd>?</kbd><span>Toggle Shortcuts</span></div>
              <div className="shortcut-item"><kbd>Home</kbd><span>First Item</span></div>
              <div className="shortcut-item"><kbd>End</kbd><span>Last Item</span></div>
              <div className="shortcut-item"><kbd>Esc</kbd><span>Back/Reset/Close</span></div>
            </div>
          </div>
        )}

        {/* Main content area */}
        {viewMode === 'grid' ? (
          <div className="gallery-grid" ref={gridRef}>
            {filteredOutputs.map((output, index) => (
              <div
                key={output.id || index}
                className={`grid-item ${hoveredIndex === index ? 'hovered' : ''}`}
                onClick={() => navigateTo(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                draggable={true}
                onDragStart={(e) => {
                  e.stopPropagation();
                  console.log('[Gallery] Starting drag from grid item:', output.type);
                  setIsDragging(true);
                  onDraggingChange && onDraggingChange(true);

                  // Create a drag image from the element itself
                  const img = e.currentTarget.querySelector('img');
                  if (img) {
                    e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
                  }

                  e.dataTransfer.effectAllowed = 'copy';
                  const dragData = {
                    type: 'gallery-output',
                    output: {
                      value: output.value,
                      type: output.type,
                      prompt: output.prompt,
                      model: output.model
                    }
                  };
                  e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                  // Also set as plain text for fallback
                  e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
                  console.log('[Gallery] Drag data set:', dragData);

                  // Notify parent about drag start (for ref-based drop handling)
                  onGalleryDragStart && onGalleryDragStart({
                    value: output.value,
                    type: output.type,
                    prompt: output.prompt,
                    model: output.model
                  }, e.clientX, e.clientY);
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  console.log('[Gallery] Drag ended at:', e.clientX, e.clientY);
                  console.log('[Gallery] Drop effect:', e.dataTransfer.dropEffect);
                  setIsDragging(false);
                  onDraggingChange && onDraggingChange(false);

                  // Notify parent about drag end with position (for ref-based drop handling)
                  onGalleryDragEnd && onGalleryDragEnd(e.clientX, e.clientY);
                }}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                {output.type === 'image' ? (
                  loadingImages[output.id || output.value] || (isLocalPath(output.value) && !convertedSrcs[output.id || output.value]) ? (
                    <div 
                      className="grid-skeleton"
                      ref={(el) => {
                        // Trigger conversion when skeleton becomes visible
                        if (el && isLocalPath(output.value) && !convertedSrcs[output.id || output.value]) {
                          convertLocalFile(output.value, output.id);
                        }
                      }}
                    >
                      <div className="skeleton-shimmer"></div>
                    </div>
                  ) : (
                    <>
                      <img src={getDisplaySrc(output)} alt={output.prompt || `Output ${index + 1}`} />
                      <div className="grid-overlay">
                        <div className="grid-info">
                          {output.prompt && (
                            <div className="grid-prompt">{output.prompt.substring(0, 100)}{output.prompt.length > 100 ? '...' : ''}</div>
                          )}
                          <div className="grid-meta">
                            <span className="type-tag">{output.type}</span>
                            {output.timestamp && (
                              <span className="date-tag">{new Date(output.timestamp).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )
                ) : output.type === 'video' ? (
                  <div className="grid-icon-container video-icon">
                    <FaPlay size={48} />
                    <div className="grid-type-label">Video</div>
                  </div>
                ) : output.type === 'audio' ? (
                  <div className="grid-icon-container audio-icon">
                    <FaMusic size={48} />
                    <div className="grid-type-label">Audio</div>
                  </div>
                ) : (
                  <div className="grid-icon-container text-icon">
                    <FaFileAlt size={48} />
                    <div className="grid-type-label">Text</div>
                  </div>
                )}
              </div>
            ))}
            {hasMore && database?.isInitialized && (
              <div className="grid-item load-more-card" onClick={handleLoadMore}>
                {isLoading ? (
                  <div className="loading-spinner">
                    <FaSpinner size={32} className="spinner-animation" />
                  </div>
                ) : (
                  <>
                    <FaPlus size={32} />
                    <div>Load More</div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : viewMode === 'compare' ? (
          <div className="gallery-compare">
            <div className="compare-controls">
              <div className="compare-target-toggle">
                <button
                  className={`compare-target-button ${compareTarget === 'left' ? 'active' : ''}`}
                  onClick={() => setCompareTarget('left')}
                >
                  Assign Left
                </button>
                <button
                  className={`compare-target-button ${compareTarget === 'right' ? 'active' : ''}`}
                  onClick={() => setCompareTarget('right')}
                >
                  Assign Right
                </button>
              </div>
              <button
                className="compare-swap"
                onClick={swapCompareSides}
                title="Swap sides"
                disabled={!compareHasEnough}
              >
                <FaExchangeAlt size={14} />
                Swap
              </button>
            </div>

            {!compareHasEnough ? (
              <div className="compare-empty">
                Add at least two outputs to compare side-by-side.
              </div>
            ) : (
              <div className="compare-columns">
                <div className="compare-column">
                  <div className="compare-column-header">Left</div>
                  <div className="compare-viewer">
                    {renderCompareMedia(compareLeftOutput)}
                  </div>
                  {compareLeftOutput && (
                    <div className="compare-info">
                      <div className="compare-info-row">
                        <span className="compare-info-label">Model</span>
                        <span className="compare-info-value">{compareLeftOutput.model || 'Unknown'}</span>
                      </div>
                      {compareLeftOutput.prompt && (
                        <div className="compare-info-row">
                          <span className="compare-info-label">Prompt</span>
                          <span className="compare-info-value">{compareLeftOutput.prompt}</span>
                        </div>
                      )}
                      {compareLeftOutput.timestamp && (
                        <div className="compare-info-row">
                          <span className="compare-info-label">Created</span>
                          <span className="compare-info-value">
                            {new Date(compareLeftOutput.timestamp).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="compare-column">
                  <div className="compare-column-header">Right</div>
                  <div className="compare-viewer">
                    {renderCompareMedia(compareRightOutput)}
                  </div>
                  {compareRightOutput && (
                    <div className="compare-info">
                      <div className="compare-info-row">
                        <span className="compare-info-label">Model</span>
                        <span className="compare-info-value">{compareRightOutput.model || 'Unknown'}</span>
                      </div>
                      {compareRightOutput.prompt && (
                        <div className="compare-info-row">
                          <span className="compare-info-label">Prompt</span>
                          <span className="compare-info-value">{compareRightOutput.prompt}</span>
                        </div>
                      )}
                      {compareRightOutput.timestamp && (
                        <div className="compare-info-row">
                          <span className="compare-info-label">Created</span>
                          <span className="compare-info-value">
                            {new Date(compareRightOutput.timestamp).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="compare-thumbnails">
              {filteredOutputs.map((output, index) => {
                const selectionClass = index === compareLeftIndex
                  ? 'selected-left'
                  : index === compareRightIndex
                    ? 'selected-right'
                    : '';
                return (
                  <button
                    key={output.id || index}
                    className={`compare-thumb ${selectionClass}`}
                    onClick={() => handleCompareSelect(index)}
                    title={output.prompt || output.model || `Output ${index + 1}`}
                  >
                    {output.type === 'image' ? (
                      loadingImages[output.id || output.value] || (isLocalPath(output.value) && !convertedSrcs[output.id || output.value]) ? (
                        <div 
                          className="thumbnail-skeleton"
                          ref={(el) => {
                            if (el && isLocalPath(output.value) && !convertedSrcs[output.id || output.value]) {
                              convertLocalFile(output.value, output.id);
                            }
                          }}
                        >
                          <div className="skeleton-shimmer"></div>
                        </div>
                      ) : (
                        <img src={getDisplaySrc(output)} alt={`Output ${index + 1}`} />
                      )
                    ) : output.type === 'video' ? (
                      <FaPlay size={16} />
                    ) : output.type === 'audio' ? (
                      <FaMusic size={16} />
                    ) : (
                      <FaFileAlt size={16} />
                    )}
                    <span className="compare-thumb-index">{index + 1}</span>
                  </button>
                );
              })}
              {hasMore && database?.isInitialized && (
                <button
                  className="compare-thumb load-more"
                  onClick={handleLoadMore}
                  title="Load more outputs"
                >
                  {isLoading ? (
                    <FaSpinner size={16} className="spinner-animation" />
                  ) : (
                    <FaPlus size={16} />
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="gallery-main">
            {/* Navigation arrows */}
            <button
              className={`nav-arrow nav-arrow-left ${selectedIndex === 0 ? 'disabled' : ''}`}
              onClick={handlePrevious}
              disabled={selectedIndex === 0}
            >
              <FaChevronLeft size={24} />
            </button>

            {/* Viewer */}
            <div
              className={`gallery-viewer ${imageTransition ? 'transitioning' : ''}`}
              ref={viewerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {currentOutput && currentOutput.type === 'image' ? (
                isCurrentLoading ? (
                  <div className="loading-skeleton">
                    <div className="skeleton-shimmer"></div>
                  </div>
                ) : (
                  <div
                    className={`image-container ${zoomLevel > 1 ? 'zoomed' : ''}`}
                    onDoubleClick={handleDoubleClick}
                    style={{
                      transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                      cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in'
                    }}
                  >
                    <img
                      src={getDisplaySrc(currentOutput)}
                      alt={currentOutput.prompt || 'Generated output'}
                      className="gallery-image"
                      draggable={false}
                      onError={(e) => {
                        console.error('Failed to load image:', currentOutput.value);
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )
              ) : currentOutput && currentOutput.type === 'video' ? (
                isCurrentLoading ? (
                  <div className="loading-skeleton video-skeleton">
                    <div className="skeleton-shimmer"></div>
                    <FaPlay size={48} />
                  </div>
                ) : (
                  <video
                    src={getDisplaySrc(currentOutput)}
                    controls
                    className="gallery-video"
                    autoPlay
                    loop
                    onError={(e) => {
                      console.error('Failed to load video:', currentOutput.value);
                    }}
                  />
                )
              ) : currentOutput && currentOutput.type === 'audio' ? (
                isCurrentLoading ? (
                  <div className="loading-skeleton audio-skeleton">
                    <div className="skeleton-shimmer"></div>
                  </div>
                ) : (
                  <div className="audio-container">
                    <div className="audio-visualizer">
                      <FaMusic size={64} />
                    </div>
                    <audio
                      src={getDisplaySrc(currentOutput)}
                      controls
                      className="gallery-audio"
                      autoPlay
                      onError={(e) => {
                        console.error('Failed to load audio:', currentOutput.value);
                      }}
                    />
                  </div>
                )
              ) : currentOutput ? (
                <div className="gallery-text">
                  <pre>{currentOutput.value}</pre>
                </div>
              ) : null}

              {/* Zoom controls */}
              {currentOutput && currentOutput.type === 'image' && !isCurrentLoading && (
                <div className="zoom-controls">
                  <button onClick={handleZoomOut} disabled={zoomLevel <= 1} title="Zoom Out (-)">
                    <FaSearchMinus size={16} />
                  </button>
                  <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={handleZoomIn} disabled={zoomLevel >= 5} title="Zoom In (+)">
                    <FaSearchPlus size={16} />
                  </button>
                  {zoomLevel > 1 && (
                    <button onClick={resetZoom} title="Reset Zoom">
                      <FaUndo size={16} />
                    </button>
                  )}
                </div>
              )}

              {/* Image counter */}
              <div className="image-counter">
                {selectedIndex + 1} / {filteredOutputs.length}
              </div>
            </div>

            <button
              className={`nav-arrow nav-arrow-right ${selectedIndex === filteredOutputs.length - 1 ? 'disabled' : ''}`}
              onClick={handleNext}
              disabled={selectedIndex === filteredOutputs.length - 1}
            >
              <FaChevronRight size={24} />
            </button>

            {/* Info panel */}
            {currentOutput && (
              <div className={`gallery-info ${isInfoCollapsed ? 'collapsed' : ''}`}>
                <div className="info-section">
                  <div className="info-row">
                    <span className="info-label">Type</span>
                    <span className="info-value type-badge" data-type={currentOutput.type}>
                      {currentOutput.type || 'unknown'}
                    </span>
                  </div>
                  {currentOutput.prompt && (
                    <div className="info-row">
                      <span className="info-label">Prompt</span>
                      <span className="info-value prompt-text">{currentOutput.prompt}</span>
                    </div>
                  )}
                  {currentOutput.model && (
                    <div className="info-row">
                      <span className="info-label">Model</span>
                      <span className="info-value">{currentOutput.model}</span>
                    </div>
                  )}
                  {currentOutput.timestamp && (
                    <div className="info-row">
                      <span className="info-label">Created</span>
                      <span className="info-value">
                        {new Date(currentOutput.timestamp).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="info-actions">
                  <a
                    href={getDisplaySrc(currentOutput)}
                    download={`noder-${currentOutput.type}-${Date.now()}.${currentOutput.type === 'image' ? 'png' : currentOutput.type === 'video' ? 'mp4' : currentOutput.type === 'audio' ? 'mp3' : 'txt'}`}
                    className="action-button download-button"
                    title="Download Output"
                    onClick={(e) => {
                      // For data URLs, handle differently
                      if (getDisplaySrc(currentOutput).startsWith('data:')) {
                        e.preventDefault();
                        const link = document.createElement('a');
                        link.href = getDisplaySrc(currentOutput);
                        link.download = `noder-${currentOutput.type}-${Date.now()}.${currentOutput.type === 'image' ? 'png' : currentOutput.type === 'video' ? 'mp4' : currentOutput.type === 'audio' ? 'mp3' : 'txt'}`;
                        link.click();
                      }
                    }}
                  >
                    <FaDownload size={16} />
                    Download
                  </a>
                  {database?.isInitialized && currentOutput.id && (
                    <button
                      onClick={() => handleDeleteOutput(currentOutput.id)}
                      className="action-button delete-button"
                      title="Delete"
                    >
                      <FaTrash size={16} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Thumbnails (only in list mode) */}
        {viewMode === 'list' && filteredOutputs.length > 1 && (
          <div className="gallery-thumbnails-container">
            <button
              className="thumbnail-scroll-btn left"
              onClick={() => scrollThumbnails('left')}
            >
              <FaChevronLeft size={16} />
            </button>

            <div className="gallery-thumbnails" ref={thumbnailsRef}>
              {filteredOutputs.map((output, index) => (
                <div
                  key={output.id || index}
                  className={`thumbnail ${index === selectedIndex ? 'active' : ''} ${loadingImages[output.id || output.value] ? 'loading' : ''}`}
                  onClick={() => navigateTo(index)}
                  draggable={true}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    console.log('[Gallery] Starting drag from thumbnail:', output.type);
                    setIsDragging(true);
                    onDraggingChange && onDraggingChange(true);

                    // Create a drag image from the element itself
                    const img = e.currentTarget.querySelector('img');
                    if (img) {
                      e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
                    }

                    e.dataTransfer.effectAllowed = 'copy';
                    const dragData = {
                      type: 'gallery-output',
                      output: {
                        value: output.value,
                        type: output.type,
                        prompt: output.prompt,
                        model: output.model
                      }
                    };
                    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                    // Also set as plain text for fallback
                    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
                    console.log('[Gallery] Drag data set:', dragData);

                    // Notify parent about drag start (for ref-based drop handling)
                    onGalleryDragStart && onGalleryDragStart({
                      value: output.value,
                      type: output.type,
                      prompt: output.prompt,
                      model: output.model
                    }, e.clientX, e.clientY);
                  }}
                  onDragEnd={(e) => {
                    e.stopPropagation();
                    console.log('[Gallery] Drag ended at:', e.clientX, e.clientY);
                    console.log('[Gallery] Drop effect:', e.dataTransfer.dropEffect);
                    setIsDragging(false);
                    onDraggingChange && onDraggingChange(false);

                    // Notify parent about drag end with position (for ref-based drop handling)
                    onGalleryDragEnd && onGalleryDragEnd(e.clientX, e.clientY);
                  }}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  {output.type === 'image' ? (
                    loadingImages[output.id || output.value] || (isLocalPath(output.value) && !convertedSrcs[output.id || output.value]) ? (
                      <div 
                        className="thumbnail-skeleton"
                        ref={(el) => {
                          // Trigger conversion when skeleton becomes visible
                          if (el && isLocalPath(output.value) && !convertedSrcs[output.id || output.value]) {
                            convertLocalFile(output.value, output.id);
                          }
                        }}
                      >
                        <div className="skeleton-shimmer"></div>
                      </div>
                    ) : (
                      <img src={getDisplaySrc(output)} alt={`Output ${index + 1}`} />
                    )
                  ) : output.type === 'video' ? (
                    <div className="thumbnail-video">
                      <FaPlay size={20} />
                    </div>
                  ) : output.type === 'audio' ? (
                    <div className="thumbnail-audio">
                      <FaMusic size={20} />
                    </div>
                  ) : (
                    <div className="thumbnail-text">
                      <FaFileAlt size={20} />
                    </div>
                  )}
                </div>
              ))}
              {hasMore && database?.isInitialized && (
                <div
                  className="thumbnail load-more"
                  onClick={handleLoadMore}
                  title="Load more outputs"
                >
                  {isLoading ? (
                    <div className="loading-spinner">
                      <FaSpinner size={20} className="spinner-animation" />
                    </div>
                  ) : (
                    <FaPlus size={20} />
                  )}
                </div>
              )}
            </div>

            <button
              className="thumbnail-scroll-btn right"
              onClick={() => scrollThumbnails('right')}
            >
              <FaChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );

  if (isFullscreen) {
    return createPortal(galleryContent, document.body);
  }

  return galleryContent;
};

export default OutputGallery;
