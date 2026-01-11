import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { NodeResizer } from '@reactflow/node-resizer';
import { FiTrash2, FiEdit2 } from 'react-icons/fi';
import { emit } from '../../utils/eventBus';
import '@reactflow/node-resizer/dist/style.css';

export const NODE_TYPE = 'group';

// Predefined color palette that works well with most themes
const GROUP_COLORS = [
  { name: 'Default', value: 'var(--primary-color)' },
  { name: 'Red', value: '#e85d5d' },
  { name: 'Orange', value: '#e8935d' },
  { name: 'Yellow', value: '#e8d45d' },
  { name: 'Green', value: '#5de87a' },
  { name: 'Teal', value: '#5dd8e8' },
  { name: 'Blue', value: '#5d8ae8' },
  { name: 'Purple', value: '#9b5de8' },
  { name: 'Pink', value: '#e85dba' },
  { name: 'Gray', value: '#888888' },
];

/**
 * GroupNode - Container node for grouping other nodes together
 * 
 * Features:
 * - Resizable container
 * - Editable label/name (double-click to edit)
 * - Color picker for organization
 */
const GroupNode = memo(({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef(null);
  const colorPickerRef = useRef(null);
  
  const label = data?.label || 'Group';
  const color = data?.color || 'var(--primary-color)';
  const childCount = data?.childCount || 0;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
    };
    
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);
  
  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    data?.onRemove?.(id);
  }, [id, data]);

  const handleLabelDoubleClick = useCallback((e) => {
    e.stopPropagation();
    setEditValue(label);
    setIsEditing(true);
  }, [label]);

  const handleLabelChange = useCallback((e) => {
    setEditValue(e.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== label) {
      emit('nodeDataUpdated', { nodeId: id, updates: { label: trimmedValue } });
    }
    setIsEditing(false);
  }, [editValue, label, id]);

  const handleLabelKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }, []);

  const handleColorClick = useCallback((e) => {
    e.stopPropagation();
    setShowColorPicker(!showColorPicker);
  }, [showColorPicker]);

  const handleColorSelect = useCallback((newColor) => {
    emit('nodeDataUpdated', { nodeId: id, updates: { color: newColor } });
    setShowColorPicker(false);
  }, [id]);

  // Get the actual color value for the indicator
  const getColorValue = (c) => {
    if (c.startsWith('var(')) {
      return c; // CSS variable, will be resolved by browser
    }
    return c;
  };

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={100}
        isVisible={selected}
        lineClassName="group-node-resizer-line"
        handleClassName="group-node-resizer-handle"
      />
      <div
        className={`group-node ${selected ? 'selected' : ''}`}
        style={{
          '--group-color': color,
        }}
      >
        <div className="group-node-header">
          {/* Color indicator / picker trigger */}
          <div className="group-node-color-wrapper" ref={colorPickerRef}>
            <button
              className="group-node-color-btn"
              onClick={handleColorClick}
              title="Change group color"
              style={{ backgroundColor: getColorValue(color) }}
            />
            {showColorPicker && (
              <div className="group-node-color-picker">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c.name}
                    className={`group-node-color-option ${color === c.value ? 'active' : ''}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => handleColorSelect(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Editable label */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="group-node-label-input"
              value={editValue}
              onChange={handleLabelChange}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span 
              className="group-node-label"
              onDoubleClick={handleLabelDoubleClick}
              title="Double-click to rename"
            >
              {label}
            </span>
          )}
          
          <div className="group-node-actions">
            <button
              className="group-node-action-btn"
              onClick={handleLabelDoubleClick}
              title="Rename group"
            >
              <FiEdit2 size={12} />
            </button>
            <button
              className="group-node-action-btn group-node-delete-btn"
              onClick={handleDelete}
              title="Delete group"
            >
              <FiTrash2 size={12} />
            </button>
          </div>

          {childCount > 0 && (
            <span className="group-node-count">{childCount}</span>
          )}
        </div>
        <div className="group-node-content">
          {/* Child nodes are rendered by React Flow using parentNode */}
        </div>
      </div>
    </>
  );
});

GroupNode.displayName = 'GroupNode';

/**
 * Create a new group node
 */
export const createNode = ({ id, position, data = {} }) => ({
  id,
  type: NODE_TYPE,
  position,
  data: {
    label: data.label || 'Group',
    color: data.color || 'var(--primary-color)',
    childCount: 0,
    ...data
  },
  style: {
    width: data.width || 400,
    height: data.height || 300,
    zIndex: -1 // Groups should be behind other nodes
  },
  // Allow other nodes to be dropped inside
  selectable: true,
  draggable: true
});

export default GroupNode;
