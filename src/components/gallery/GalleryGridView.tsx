import React, { DragEvent, RefObject } from 'react';
import { FaPlay, FaMusic, FaFileAlt, FaSpinner, FaPlus } from 'react-icons/fa';
import { Output, isLocalPath } from './types';

interface GalleryGridViewProps {
  outputs: Output[];
  gridRef: RefObject<HTMLDivElement | null>;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
  onSelect: (index: number) => void;
  isDragging: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>, output: Output) => void;
  onDragEnd: (e: DragEvent<HTMLDivElement>) => void;
  loadingImages: Record<string, boolean>;
  convertedSrcs: Record<string, string>;
  getDisplaySrc: (output: Output) => string;
  convertLocalFile: (filePath: string, outputId?: string) => void;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  databaseInitialized: boolean;
}

export const GalleryGridView: React.FC<GalleryGridViewProps> = ({
  outputs,
  gridRef,
  hoveredIndex,
  onHover,
  onSelect,
  isDragging,
  onDragStart,
  onDragEnd,
  loadingImages,
  convertedSrcs,
  getDisplaySrc,
  convertLocalFile,
  hasMore,
  isLoading,
  onLoadMore,
  databaseInitialized,
}) => {
  return (
    <div className="gallery-grid" ref={gridRef}>
      {outputs.map((output, index) => (
        <div
          key={output.id || index}
          className={`grid-item ${hoveredIndex === index ? 'hovered' : ''}`}
          onClick={() => onSelect(index)}
          onMouseEnter={() => onHover(index)}
          onMouseLeave={() => onHover(null)}
          draggable={true}
          onDragStart={(e) => onDragStart(e, output)}
          onDragEnd={onDragEnd}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          {output.type === 'image' ? (
            loadingImages[output.id || output.value] ||
            (isLocalPath(output.value) && !convertedSrcs[output.id || output.value]) ? (
              <div
                className="grid-skeleton"
                ref={(el) => {
                  if (
                    el &&
                    isLocalPath(output.value) &&
                    !convertedSrcs[output.id || output.value]
                  ) {
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
                      <div className="grid-prompt">
                        {output.prompt.substring(0, 100)}
                        {output.prompt.length > 100 ? '...' : ''}
                      </div>
                    )}
                    <div className="grid-meta">
                      <span className="type-tag">{output.type}</span>
                      {output.timestamp && (
                        <span className="date-tag">
                          {new Date(output.timestamp).toLocaleDateString()}
                        </span>
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
      {hasMore && databaseInitialized && (
        <div className="grid-item load-more-card" onClick={onLoadMore}>
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
  );
};
