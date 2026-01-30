import React, { ChangeEvent } from 'react';
import {
  FaSearch,
  FaImage,
  FaPlay,
  FaMusic,
  FaTh,
  FaList,
  FaQuestion,
  FaInfoCircle,
  FaExpand,
  FaCompress,
  FaTimes,
  FaColumns,
} from 'react-icons/fa';
import { ViewMode, FilterType } from './types';

interface GalleryHeaderProps {
  filteredCount: number;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterType: FilterType;
  onFilterChange: (filter: FilterType) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showShortcuts: boolean;
  onToggleShortcuts: () => void;
  isInfoCollapsed: boolean;
  onToggleInfo: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose?: () => void;
}

export const GalleryHeader: React.FC<GalleryHeaderProps> = ({
  filteredCount,
  totalCount,
  searchQuery,
  onSearchChange,
  filterType,
  onFilterChange,
  viewMode,
  onViewModeChange,
  showShortcuts: _showShortcuts,
  onToggleShortcuts,
  isInfoCollapsed,
  onToggleInfo,
  isFullscreen,
  onToggleFullscreen,
  onClose,
}) => {
  return (
    <div className="gallery-header">
      <div className="header-left">
        <h3>Output Gallery</h3>
        <span className="gallery-badge">
          {filteredCount} of {totalCount} items
        </span>
      </div>
      <div className="header-center">
        {/* Search bar */}
        <div className="search-container">
          <FaSearch size={14} />
          <input
            type="text"
            placeholder="Search by prompt or model..."
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => onSearchChange('')}>
              ×
            </button>
          )}
        </div>

        {/* Filter buttons */}
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => onFilterChange('all')}
            title="Show All"
          >
            All
          </button>
          <button
            className={`filter-btn ${filterType === 'image' ? 'active' : ''}`}
            onClick={() => onFilterChange('image')}
            title="Images Only"
          >
            <FaImage size={14} />
          </button>
          <button
            className={`filter-btn ${filterType === 'video' ? 'active' : ''}`}
            onClick={() => onFilterChange('video')}
            title="Videos Only"
          >
            <FaPlay size={14} />
          </button>
          <button
            className={`filter-btn ${filterType === 'audio' ? 'active' : ''}`}
            onClick={() => onFilterChange('audio')}
            title="Audio Only"
          >
            <FaMusic size={14} />
          </button>
        </div>
      </div>
      <div className="gallery-controls">
        <button
          className={`gallery-button ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => onViewModeChange('grid')}
          title="Grid View (G)"
        >
          <FaTh size={16} />
        </button>
        <button
          className={`gallery-button ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => onViewModeChange('list')}
          title="List View (G)"
        >
          <FaList size={16} />
        </button>
        <button
          className={`gallery-button ${viewMode === 'compare' ? 'active' : ''}`}
          onClick={() => onViewModeChange('compare')}
          title="Compare View (C)"
        >
          <FaColumns size={16} />
        </button>
        <button
          className="gallery-button"
          onClick={onToggleShortcuts}
          title="Keyboard Shortcuts (?)"
        >
          <FaQuestion size={16} />
        </button>
        <button
          className="gallery-button"
          onClick={onToggleInfo}
          title={isInfoCollapsed ? 'Show Info (I)' : 'Hide Info (I)'}
        >
          <FaInfoCircle size={16} />
        </button>
        <button
          className="gallery-button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
        >
          {isFullscreen ? <FaCompress size={16} /> : <FaExpand size={16} />}
        </button>
        {onClose && (
          <button className="gallery-button close-button" onClick={onClose} title="Close Gallery">
            <FaTimes size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
