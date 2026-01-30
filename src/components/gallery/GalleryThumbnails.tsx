import React, { DragEvent, RefObject } from 'react';
import {
  FaChevronLeft,
  FaChevronRight,
  FaPlay,
  FaMusic,
  FaFileAlt,
  FaSpinner,
  FaPlus,
} from 'react-icons/fa';
import { Output, isLocalPath } from './types';

interface GalleryThumbnailsProps {
  outputs: Output[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  thumbnailsRef: RefObject<HTMLDivElement | null>;
  onScrollLeft: () => void;
  onScrollRight: () => void;
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

export const GalleryThumbnails: React.FC<GalleryThumbnailsProps> = ({
  outputs,
  selectedIndex,
  onSelect,
  thumbnailsRef,
  onScrollLeft,
  onScrollRight,
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
  if (outputs.length <= 1) return null;

  return (
    <div className="gallery-thumbnails-container">
      <button className="thumbnail-scroll-btn left" onClick={onScrollLeft}>
        <FaChevronLeft size={16} />
      </button>

      <div className="gallery-thumbnails" ref={thumbnailsRef}>
        {outputs.map((output, index) => (
          <div
            key={output.id || index}
            className={`thumbnail ${index === selectedIndex ? 'active' : ''} ${loadingImages[output.id || output.value] ? 'loading' : ''}`}
            onClick={() => onSelect(index)}
            draggable={true}
            onDragStart={(e) => onDragStart(e, output)}
            onDragEnd={onDragEnd}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            {output.type === 'image' ? (
              loadingImages[output.id || output.value] ||
              (isLocalPath(output.value) && !convertedSrcs[output.id || output.value]) ? (
                <div
                  className="thumbnail-skeleton"
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
        {hasMore && databaseInitialized && (
          <div className="thumbnail load-more" onClick={onLoadMore} title="Load more outputs">
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

      <button className="thumbnail-scroll-btn right" onClick={onScrollRight}>
        <FaChevronRight size={16} />
      </button>
    </div>
  );
};
