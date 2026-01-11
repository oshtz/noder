import React, { useState, useRef, useEffect } from 'react';
import { Panel } from 'reactflow';
import { 
  FaUndo, 
  FaRedo, 
  FaSitemap, 
  FaLayerGroup, 
  FaObjectUngroup,
  FaChevronDown
} from 'react-icons/fa';

/**
 * EditorToolbar - A floating toolbar with undo/redo, layout, and grouping controls
 */
const EditorToolbar = ({
  // Undo/Redo
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  // Auto Layout
  onAutoLayout,
  // Grouping
  onGroupSelected,
  onUngroupSelected,
  hasSelection,
  hasGroupSelected
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const layoutMenuRef = useRef(null);

  // Close layout menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target)) {
        setShowLayoutMenu(false);
      }
    };
    
    if (showLayoutMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLayoutMenu]);

  const layoutOptions = [
    { id: 'TB', label: 'Top to Bottom', icon: '↓' },
    { id: 'BT', label: 'Bottom to Top', icon: '↑' },
    { id: 'LR', label: 'Left to Right', icon: '→' },
    { id: 'RL', label: 'Right to Left', icon: '←' }
  ];

  const handleLayoutSelect = (direction) => {
    onAutoLayout?.(direction);
    setShowLayoutMenu(false);
  };

  return (
    <Panel position="top-center" className="editor-toolbar">
      <div className="editor-toolbar-inner">
        {/* Undo/Redo Group */}
        <div className="toolbar-group">
          <button
            className="toolbar-button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <FaUndo />
          </button>
          <button
            className="toolbar-button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <FaRedo />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Auto Layout Group */}
        <div className="toolbar-group" ref={layoutMenuRef}>
          <button
            className="toolbar-button toolbar-button-with-dropdown"
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
            title="Auto Layout"
            aria-label="Auto Layout"
            aria-expanded={showLayoutMenu}
          >
            <FaSitemap />
            <FaChevronDown className="dropdown-icon" />
          </button>
          
          {showLayoutMenu && (
            <div className="toolbar-dropdown">
              <div className="toolbar-dropdown-header">Auto Layout</div>
              {layoutOptions.map((option) => (
                <button
                  key={option.id}
                  className="toolbar-dropdown-item"
                  onClick={() => handleLayoutSelect(option.id)}
                >
                  <span className="dropdown-item-icon">{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        {/* Grouping Group */}
        <div className="toolbar-group">
          <button
            className="toolbar-button"
            onClick={onGroupSelected}
            disabled={!hasSelection}
            title="Group Selected (Ctrl+G)"
            aria-label="Group Selected Nodes"
          >
            <FaLayerGroup />
          </button>
          <button
            className="toolbar-button"
            onClick={onUngroupSelected}
            disabled={!hasGroupSelected}
            title="Ungroup (Ctrl+Shift+G)"
            aria-label="Ungroup Selected"
          >
            <FaObjectUngroup />
          </button>
        </div>
      </div>
    </Panel>
  );
};

export default EditorToolbar;
