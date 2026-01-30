import React, { SyntheticEvent } from 'react';
import { FaPlay, FaMusic, FaFileAlt, FaExchangeAlt, FaSpinner, FaPlus } from 'react-icons/fa';
import { Output, CompareTarget, isLocalPath } from './types';

interface GalleryCompareViewProps {
  outputs: Output[];
  compareLeftIndex: number;
  compareRightIndex: number;
  compareTarget: CompareTarget;
  onTargetChange: (target: CompareTarget) => void;
  onCompareSelect: (index: number) => void;
  onSwapSides: () => void;
  getDisplaySrc: (output: Output) => string;
  loadingImages: Record<string, boolean>;
  convertedSrcs: Record<string, string>;
  convertLocalFile: (filePath: string, outputId?: string) => void;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  databaseInitialized: boolean;
}

const renderCompareMedia = (
  output: Output | undefined,
  getDisplaySrc: (output: Output) => string
): React.ReactNode => {
  if (!output) {
    return <div className="compare-placeholder">No output selected</div>;
  }

  if (output.type === 'image') {
    return (
      <img
        src={getDisplaySrc(output)}
        alt={output.prompt || 'Comparison output'}
        className="compare-image"
        onError={(e: SyntheticEvent<HTMLImageElement>) => {
          console.error('Failed to load image:', output.value);
          e.currentTarget.style.display = 'none';
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

const CompareInfoPanel: React.FC<{ output: Output | undefined }> = ({ output }) => {
  if (!output) return null;

  return (
    <div className="compare-info">
      <div className="compare-info-row">
        <span className="compare-info-label">Model</span>
        <span className="compare-info-value">{output.model || 'Unknown'}</span>
      </div>
      {output.prompt && (
        <div className="compare-info-row">
          <span className="compare-info-label">Prompt</span>
          <span className="compare-info-value">{output.prompt}</span>
        </div>
      )}
      {output.timestamp && (
        <div className="compare-info-row">
          <span className="compare-info-label">Created</span>
          <span className="compare-info-value">{new Date(output.timestamp).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
};

export const GalleryCompareView: React.FC<GalleryCompareViewProps> = ({
  outputs,
  compareLeftIndex,
  compareRightIndex,
  compareTarget,
  onTargetChange,
  onCompareSelect,
  onSwapSides,
  getDisplaySrc,
  loadingImages,
  convertedSrcs,
  convertLocalFile,
  hasMore,
  isLoading,
  onLoadMore,
  databaseInitialized,
}) => {
  const compareLeftOutput = outputs[compareLeftIndex] || outputs[0];
  const compareRightOutput = outputs[compareRightIndex] || outputs[1] || outputs[0];
  const compareHasEnough = outputs.length > 1;

  return (
    <div className="gallery-compare">
      <div className="compare-controls">
        <div className="compare-target-toggle">
          <button
            className={`compare-target-button ${compareTarget === 'left' ? 'active' : ''}`}
            onClick={() => onTargetChange('left')}
          >
            Assign Left
          </button>
          <button
            className={`compare-target-button ${compareTarget === 'right' ? 'active' : ''}`}
            onClick={() => onTargetChange('right')}
          >
            Assign Right
          </button>
        </div>
        <button
          className="compare-swap"
          onClick={onSwapSides}
          title="Swap sides"
          disabled={!compareHasEnough}
        >
          <FaExchangeAlt size={14} />
          Swap
        </button>
      </div>

      {!compareHasEnough ? (
        <div className="compare-empty">Add at least two outputs to compare side-by-side.</div>
      ) : (
        <div className="compare-columns">
          <div className="compare-column">
            <div className="compare-column-header">Left</div>
            <div className="compare-viewer">
              {renderCompareMedia(compareLeftOutput, getDisplaySrc)}
            </div>
            <CompareInfoPanel output={compareLeftOutput} />
          </div>
          <div className="compare-column">
            <div className="compare-column-header">Right</div>
            <div className="compare-viewer">
              {renderCompareMedia(compareRightOutput, getDisplaySrc)}
            </div>
            <CompareInfoPanel output={compareRightOutput} />
          </div>
        </div>
      )}

      <div className="compare-thumbnails">
        {outputs.map((output, index) => {
          const selectionClass =
            index === compareLeftIndex
              ? 'selected-left'
              : index === compareRightIndex
                ? 'selected-right'
                : '';
          return (
            <button
              key={output.id || index}
              className={`compare-thumb ${selectionClass}`}
              onClick={() => onCompareSelect(index)}
              title={output.prompt || output.model || `Output ${index + 1}`}
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
        {hasMore && databaseInitialized && (
          <button
            className="compare-thumb load-more"
            onClick={onLoadMore}
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
  );
};
