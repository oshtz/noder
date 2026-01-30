import React from 'react';
import { FaImage } from 'react-icons/fa';

export const GalleryEmptyState: React.FC = () => {
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
};
