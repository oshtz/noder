import React from 'react';

interface GalleryShortcutsProps {
  onClose: () => void;
}

export const GalleryShortcuts: React.FC<GalleryShortcutsProps> = ({ onClose }) => {
  return (
    <div className="shortcuts-popup">
      <div className="shortcuts-header">
        <span>Keyboard Shortcuts</span>
        <button onClick={onClose}>×</button>
      </div>
      <div className="shortcuts-list">
        <div className="shortcut-item">
          <kbd>G</kbd>
          <span>Toggle Grid/List View</span>
        </div>
        <div className="shortcut-item">
          <kbd>C</kbd>
          <span>Toggle Compare View</span>
        </div>
        <div className="shortcut-item">
          <kbd>←</kbd>
          <span>Previous (List View)</span>
        </div>
        <div className="shortcut-item">
          <kbd>→</kbd>
          <span>Next (List View)</span>
        </div>
        <div className="shortcut-item">
          <kbd>+</kbd>
          <span>Zoom In</span>
        </div>
        <div className="shortcut-item">
          <kbd>-</kbd>
          <span>Zoom Out</span>
        </div>
        <div className="shortcut-item">
          <kbd>F</kbd>
          <span>Toggle Fullscreen</span>
        </div>
        <div className="shortcut-item">
          <kbd>I</kbd>
          <span>Toggle Info Panel</span>
        </div>
        <div className="shortcut-item">
          <kbd>?</kbd>
          <span>Toggle Shortcuts</span>
        </div>
        <div className="shortcut-item">
          <kbd>Home</kbd>
          <span>First Item</span>
        </div>
        <div className="shortcut-item">
          <kbd>End</kbd>
          <span>Last Item</span>
        </div>
        <div className="shortcut-item">
          <kbd>Esc</kbd>
          <span>Back/Reset/Close</span>
        </div>
      </div>
    </div>
  );
};
