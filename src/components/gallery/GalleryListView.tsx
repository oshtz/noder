import React, { MouseEvent, SyntheticEvent, RefObject } from 'react';
import {
  FaChevronLeft,
  FaChevronRight,
  FaSearchMinus,
  FaSearchPlus,
  FaUndo,
  FaDownload,
  FaTrash,
  FaMusic,
  FaPlay,
} from 'react-icons/fa';
import { Output, PanPosition, getFileExtension } from './types';

interface GalleryListViewProps {
  outputs: Output[];
  selectedIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  currentOutput: Output | undefined;
  isCurrentLoading: boolean;
  imageTransition: boolean;
  viewerRef: RefObject<HTMLDivElement | null>;
  zoomLevel: number;
  panPosition: PanPosition;
  isPanning: boolean;
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onDoubleClick: (e: MouseEvent<HTMLDivElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  getDisplaySrc: (output: Output) => string;
  isInfoCollapsed: boolean;
  databaseInitialized: boolean;
  onDeleteOutput: (id: string) => void;
}

export const GalleryListView: React.FC<GalleryListViewProps> = ({
  outputs,
  selectedIndex,
  onPrevious,
  onNext,
  currentOutput,
  isCurrentLoading,
  imageTransition,
  viewerRef,
  zoomLevel,
  panPosition,
  isPanning,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  getDisplaySrc,
  isInfoCollapsed,
  databaseInitialized,
  onDeleteOutput,
}) => {
  return (
    <div className="gallery-main">
      {/* Navigation arrows */}
      <button
        className={`nav-arrow nav-arrow-left ${selectedIndex === 0 ? 'disabled' : ''}`}
        onClick={onPrevious}
        disabled={selectedIndex === 0}
      >
        <FaChevronLeft size={24} />
      </button>

      {/* Viewer */}
      <div
        className={`gallery-viewer ${imageTransition ? 'transitioning' : ''}`}
        ref={viewerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {currentOutput && currentOutput.type === 'image' ? (
          isCurrentLoading ? (
            <div className="loading-skeleton">
              <div className="skeleton-shimmer"></div>
            </div>
          ) : (
            <div
              className={`image-container ${zoomLevel > 1 ? 'zoomed' : ''}`}
              onDoubleClick={onDoubleClick}
              style={{
                transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
              }}
            >
              <img
                src={getDisplaySrc(currentOutput)}
                alt={currentOutput.prompt || 'Generated output'}
                className="gallery-image"
                draggable={false}
                onError={(e: SyntheticEvent<HTMLImageElement>) => {
                  console.error('Failed to load image:', currentOutput.value);
                  e.currentTarget.style.display = 'none';
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
              onError={() => {
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
                onError={() => {
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
            <button onClick={onZoomOut} disabled={zoomLevel <= 1} title="Zoom Out (-)">
              <FaSearchMinus size={16} />
            </button>
            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={onZoomIn} disabled={zoomLevel >= 5} title="Zoom In (+)">
              <FaSearchPlus size={16} />
            </button>
            {zoomLevel > 1 && (
              <button onClick={onResetZoom} title="Reset Zoom">
                <FaUndo size={16} />
              </button>
            )}
          </div>
        )}

        {/* Image counter */}
        <div className="image-counter">
          {selectedIndex + 1} / {outputs.length}
        </div>
      </div>

      <button
        className={`nav-arrow nav-arrow-right ${selectedIndex === outputs.length - 1 ? 'disabled' : ''}`}
        onClick={onNext}
        disabled={selectedIndex === outputs.length - 1}
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
              download={`noder-${currentOutput.type}-${Date.now()}.${getFileExtension(currentOutput.type)}`}
              className="action-button download-button"
              title="Download Output"
              onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                // For data URLs, handle differently
                if (getDisplaySrc(currentOutput).startsWith('data:')) {
                  e.preventDefault();
                  const link = document.createElement('a');
                  link.href = getDisplaySrc(currentOutput);
                  link.download = `noder-${currentOutput.type}-${Date.now()}.${getFileExtension(currentOutput.type)}`;
                  link.click();
                }
              }}
            >
              <FaDownload size={16} />
              Download
            </a>
            {databaseInitialized && currentOutput.id && (
              <button
                onClick={() => onDeleteOutput(currentOutput.id as string)}
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
  );
};
