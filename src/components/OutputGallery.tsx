import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  MouseEvent,
  DragEvent,
} from 'react';
import { createPortal } from 'react-dom';
import './OutputGallery.css';

import {
  GalleryHeader,
  GalleryShortcuts,
  GalleryGridView,
  GalleryCompareView,
  GalleryListView,
  GalleryThumbnails,
  GalleryEmptyState,
  Output,
  ViewMode,
  FilterType,
  CompareTarget,
  PanPosition,
  Database,
  DragData,
  isLocalPath,
} from './gallery';

import { useLocalFileConverter } from '../hooks/gallery';

interface OutputGalleryProps {
  outputs?: Output[];
  onClose?: () => void;
  database?: Database | null;
  onDraggingChange?: (isDragging: boolean) => void;
  onGalleryDragStart?: (data: DragData, x: number, y: number) => void;
  onGalleryDragEnd?: (x: number, y: number) => void;
}

const ITEMS_PER_PAGE = 20;

export const OutputGallery: React.FC<OutputGalleryProps> = ({
  outputs = [],
  onClose,
  database = null,
  onDraggingChange = null,
  onGalleryDragStart = null,
  onGalleryDragEnd = null,
}) => {
  // Core state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [allOutputs, setAllOutputs] = useState<Output[]>(outputs);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // UI state
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [imageTransition, setImageTransition] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('noder-gallery-view-mode') as ViewMode) || 'list';
    } catch {
      return 'list';
    }
  });

  // Compare state
  const [compareLeftIndex, setCompareLeftIndex] = useState(0);
  const [compareRightIndex, setCompareRightIndex] = useState(1);
  const [compareTarget, setCompareTarget] = useState<CompareTarget>('left');

  // Filter/search state
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Zoom/pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panPosition, setPanPosition] = useState<PanPosition>({ x: 0, y: 0 });

  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<PanPosition>({ x: 0, y: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  // Use file converter hook
  const { convertedSrcs, loadingImages, convertLocalFile, getDisplaySrc } = useLocalFileConverter();

  // Persist viewMode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('noder-gallery-view-mode', viewMode);
    } catch (error) {
      console.error('Failed to save gallery view mode:', error);
    }
  }, [viewMode]);

  // Filter outputs based on type and search
  const filteredOutputs = useMemo(() => {
    let filtered = allOutputs;

    if (filterType !== 'all') {
      filtered = filtered.filter((output) => output.type === filterType);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (output) =>
          (output.prompt && output.prompt.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (output.model && output.model.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    return filtered;
  }, [allOutputs, filterType, searchQuery]);

  // Keep compare indices in bounds
  useEffect(() => {
    if (!filteredOutputs.length) return;
    setCompareLeftIndex((prev) => Math.min(prev, filteredOutputs.length - 1));
    setCompareRightIndex((prev) => Math.min(prev, filteredOutputs.length - 1));
  }, [filteredOutputs.length]);

  useEffect(() => {
    if (filteredOutputs.length < 2) return;
    if (compareLeftIndex === compareRightIndex) {
      setCompareRightIndex(compareLeftIndex === 0 ? 1 : 0);
    }
  }, [compareLeftIndex, compareRightIndex, filteredOutputs.length]);

  // Pre-convert local files for compare view
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

  // Reset zoom
  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  // Navigate with transition effect
  const navigateTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= filteredOutputs.length) return;
      setImageTransition(true);
      if (viewMode === 'grid') {
        setViewMode('list');
      }
      setTimeout(() => {
        setSelectedIndex(index);
        resetZoom();
        setImageTransition(false);

        if (thumbnailsRef.current) {
          const thumbnails = thumbnailsRef.current.children;
          const thumbnail = thumbnails[index] as HTMLElement | undefined;
          if (thumbnail) {
            thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      }, 150);
    },
    [filteredOutputs.length, resetZoom, viewMode]
  );

  const handlePrevious = useCallback(() => {
    if (selectedIndex > 0) navigateTo(selectedIndex - 1);
  }, [selectedIndex, navigateTo]);

  const handleNext = useCallback(() => {
    if (selectedIndex < filteredOutputs.length - 1) navigateTo(selectedIndex + 1);
  }, [selectedIndex, filteredOutputs.length, navigateTo]);

  // Compare handlers
  const handleCompareSelect = useCallback(
    (index: number) => {
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
    },
    [compareTarget, compareRightIndex, compareLeftIndex, filteredOutputs.length]
  );

  const swapCompareSides = useCallback(() => {
    setCompareLeftIndex(compareRightIndex);
    setCompareRightIndex(compareLeftIndex);
  }, [compareLeftIndex, compareRightIndex]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev * 1.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev / 1.5, 1));
  }, []);

  const handleDoubleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (zoomLevel > 1) {
        resetZoom();
      } else {
        setZoomLevel(2.5);
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * -0.5;
        const y = (e.clientY - rect.top - rect.height / 2) * -0.5;
        setPanPosition({ x, y });
      }
    },
    [zoomLevel, resetZoom]
  );

  // Pan controls
  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (zoomLevel > 1) {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y };
      }
    },
    [zoomLevel, panPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isPanning && zoomLevel > 1) {
        setPanPosition({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
      }
    },
    [isPanning, zoomLevel]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Thumbnail scroll
  const scrollThumbnails = useCallback((direction: 'left' | 'right') => {
    if (thumbnailsRef.current) {
      const scrollAmount = 200;
      thumbnailsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  }, []);

  // Pre-convert visible local files
  useEffect(() => {
    const visibleOutputs = filteredOutputs.slice(0, 20);
    visibleOutputs.forEach((output) => {
      if (isLocalPath(output.value) && output.type !== 'text') {
        convertLocalFile(output.value, output.id);
      }
    });
  }, [filteredOutputs, convertLocalFile]);

  // Convert current selection
  useEffect(() => {
    if (filteredOutputs[selectedIndex]) {
      const output = filteredOutputs[selectedIndex];
      if (isLocalPath(output.value) && output.type !== 'text') {
        convertLocalFile(output.value, output.id);
      }
    }
  }, [selectedIndex, filteredOutputs, convertLocalFile]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcuts) setShowShortcuts(false);
        else if (searchQuery) setSearchQuery('');
        else if (zoomLevel > 1) resetZoom();
        else if (isFullscreen) setIsFullscreen(false);
        else if (viewMode === 'list') setViewMode('grid');
        else if (onClose) onClose();
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
        setIsFullscreen((prev) => !prev);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setIsInfoCollapsed((prev) => !prev);
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setViewMode((prev) => (prev === 'compare' ? 'list' : 'compare'));
      } else if (e.key === '?' || e.key === '/') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
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
  }, [
    isFullscreen,
    zoomLevel,
    showShortcuts,
    searchQuery,
    viewMode,
    handlePrevious,
    handleNext,
    handleZoomIn,
    handleZoomOut,
    resetZoom,
    onClose,
    navigateTo,
    filteredOutputs.length,
  ]);

  // Load outputs from database
  const loadOutputs = useCallback(
    async (page: number = 0): Promise<void> => {
      if (!database?.isInitialized || isLoading) return;

      setIsLoading(true);
      try {
        const offset = page * ITEMS_PER_PAGE;
        const loadedOutputs = await database.getOutputs({ limit: ITEMS_PER_PAGE, offset });

        if (loadedOutputs && loadedOutputs.length > 0) {
          if (page === 0) {
            setAllOutputs(loadedOutputs);
          } else {
            setAllOutputs((prev) => [...prev, ...loadedOutputs]);
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
    },
    [database, isLoading]
  );

  useEffect(() => {
    if (database?.isInitialized && allOutputs.length === 0) {
      loadOutputs(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database?.isInitialized]);

  useEffect(() => {
    if (outputs && outputs.length > 0) {
      setAllOutputs(outputs);
    }
  }, [outputs]);

  const handleLoadMore = useCallback((): void => {
    if (hasMore && !isLoading) {
      loadOutputs(currentPage + 1);
    }
  }, [hasMore, isLoading, loadOutputs, currentPage]);

  const handleDeleteOutput = useCallback(
    async (outputId: string): Promise<void> => {
      if (!database?.isInitialized || !outputId) return;

      if (
        !window.confirm(
          'Are you sure you want to delete this output? This action cannot be undone.'
        )
      ) {
        return;
      }

      try {
        await database.deleteOutput(outputId);
        const newOutputs = allOutputs.filter((o) => o.id !== outputId);
        setAllOutputs(newOutputs);

        if (newOutputs.length === 0) {
          setSelectedIndex(0);
        } else if (selectedIndex >= newOutputs.length) {
          setSelectedIndex(newOutputs.length - 1);
        }
      } catch (error) {
        console.error('Failed to delete output:', error);
        alert('Failed to delete output. Please try again.');
      }
    },
    [database, allOutputs, selectedIndex]
  );

  // Drag handlers
  const handleGridItemDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, output: Output): void => {
      e.stopPropagation();
      setIsDragging(true);
      onDraggingChange?.(true);

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
          model: output.model,
        },
      };
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.setData('text/plain', JSON.stringify(dragData));

      onGalleryDragStart?.(
        { value: output.value, type: output.type, prompt: output.prompt, model: output.model },
        e.clientX,
        e.clientY
      );
    },
    [onDraggingChange, onGalleryDragStart]
  );

  const handleGridItemDragEnd = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.stopPropagation();
      setIsDragging(false);
      onDraggingChange?.(false);
      onGalleryDragEnd?.(e.clientX, e.clientY);
    },
    [onDraggingChange, onGalleryDragEnd]
  );

  // Empty state
  if (!allOutputs || allOutputs.length === 0) {
    return <GalleryEmptyState />;
  }

  const currentOutput = filteredOutputs[selectedIndex] || filteredOutputs[0];
  const isCurrentLoading = currentOutput
    ? !!loadingImages[currentOutput.id || currentOutput.value]
    : false;

  const galleryContent = (
    <>
      {isFullscreen && (
        <div className="gallery-fullscreen-backdrop" onClick={() => setIsFullscreen(false)} />
      )}
      <div
        className={`output-gallery ${isFullscreen ? 'fullscreen' : ''} ${isInfoCollapsed ? 'info-collapsed' : ''} ${viewMode === 'grid' ? 'grid-mode' : ''} ${isDragging ? 'dragging' : ''}`}
      >
        <GalleryHeader
          filteredCount={filteredOutputs.length}
          totalCount={allOutputs.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onFilterChange={setFilterType}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showShortcuts={showShortcuts}
          onToggleShortcuts={() => setShowShortcuts(!showShortcuts)}
          isInfoCollapsed={isInfoCollapsed}
          onToggleInfo={() => setIsInfoCollapsed(!isInfoCollapsed)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          onClose={onClose}
        />

        {showShortcuts && <GalleryShortcuts onClose={() => setShowShortcuts(false)} />}

        {viewMode === 'grid' ? (
          <GalleryGridView
            outputs={filteredOutputs}
            gridRef={gridRef}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
            onSelect={navigateTo}
            isDragging={isDragging}
            onDragStart={handleGridItemDragStart}
            onDragEnd={handleGridItemDragEnd}
            loadingImages={loadingImages}
            convertedSrcs={convertedSrcs}
            getDisplaySrc={getDisplaySrc}
            convertLocalFile={convertLocalFile}
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={handleLoadMore}
            databaseInitialized={database?.isInitialized || false}
          />
        ) : viewMode === 'compare' ? (
          <GalleryCompareView
            outputs={filteredOutputs}
            compareLeftIndex={compareLeftIndex}
            compareRightIndex={compareRightIndex}
            compareTarget={compareTarget}
            onTargetChange={setCompareTarget}
            onCompareSelect={handleCompareSelect}
            onSwapSides={swapCompareSides}
            getDisplaySrc={getDisplaySrc}
            loadingImages={loadingImages}
            convertedSrcs={convertedSrcs}
            convertLocalFile={convertLocalFile}
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={handleLoadMore}
            databaseInitialized={database?.isInitialized || false}
          />
        ) : (
          <GalleryListView
            outputs={filteredOutputs}
            selectedIndex={selectedIndex}
            onPrevious={handlePrevious}
            onNext={handleNext}
            currentOutput={currentOutput}
            isCurrentLoading={isCurrentLoading}
            imageTransition={imageTransition}
            viewerRef={viewerRef}
            zoomLevel={zoomLevel}
            panPosition={panPosition}
            isPanning={isPanning}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={resetZoom}
            getDisplaySrc={getDisplaySrc}
            isInfoCollapsed={isInfoCollapsed}
            databaseInitialized={database?.isInitialized || false}
            onDeleteOutput={handleDeleteOutput}
          />
        )}

        {viewMode === 'list' && (
          <GalleryThumbnails
            outputs={filteredOutputs}
            selectedIndex={selectedIndex}
            onSelect={navigateTo}
            thumbnailsRef={thumbnailsRef}
            onScrollLeft={() => scrollThumbnails('left')}
            onScrollRight={() => scrollThumbnails('right')}
            isDragging={isDragging}
            onDragStart={handleGridItemDragStart}
            onDragEnd={handleGridItemDragEnd}
            loadingImages={loadingImages}
            convertedSrcs={convertedSrcs}
            getDisplaySrc={getDisplaySrc}
            convertLocalFile={convertLocalFile}
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={handleLoadMore}
            databaseInitialized={database?.isInitialized || false}
          />
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
