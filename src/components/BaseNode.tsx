import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  CSSProperties,
  KeyboardEvent,
  ChangeEvent,
  MouseEvent,
} from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import { IoIosAddCircle } from 'react-icons/io';
import { FaTrash } from 'react-icons/fa';
import { getHandleColor, HandleDataType } from '../constants/handleTypes';
import { NodeSettingsPopover } from './NodeSettingsPopover';
import { emit } from '../utils/eventBus';
import '@reactflow/node-resizer/dist/style.css';

// =============================================================================
// Types
// =============================================================================

interface HandleDefinition {
  id: string;
  type: 'input' | 'output' | 'target' | 'source';
  position: Position;
  dataType?: HandleDataType;
  style?: CSSProperties;
}

interface NodeData {
  title?: string;
  customTitle?: string | null;
  metadata?: string;
  lastRunDurationMs?: number;
  executionOrder?: number;
  onRemove?: (id: string) => void;
  onMetadataClick?: () => void;
  [key: string]: unknown;
}

interface BaseNodeProps {
  id: string;
  data: NodeData;
  selected?: boolean;
  children?: ReactNode;
  handles?: HandleDefinition[];
  className?: string;
  onSettingsClick?: () => void;
  contentStyle?: CSSProperties;
  dragHandleStyle?: CSSProperties;
}

// =============================================================================
// Helper Functions
// =============================================================================

const formatDuration = (ms: number): string => {
  if (!ms || Number.isNaN(ms)) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
};

// =============================================================================
// BaseNode Component
// =============================================================================

const BaseNode: React.FC<BaseNodeProps> = ({
  id,
  data,
  selected = false,
  children,
  handles = [],
  className = '',
  onSettingsClick,
  contentStyle = {},
  dragHandleStyle = {},
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleDoubleClick = useCallback(
    (e: MouseEvent<HTMLSpanElement>): void => {
      e.stopPropagation();
      setEditedTitle(data.customTitle || data.title || '');
      setIsEditingTitle(true);
    },
    [data.customTitle, data.title]
  );

  const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    setEditedTitle(e.target.value);
  }, []);

  const handleTitleBlur = useCallback((): void => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== data.title) {
      emit('nodeDataUpdated', { nodeId: id, updates: { customTitle: trimmedTitle } });
    } else if (!trimmedTitle || trimmedTitle === data.title) {
      // Clear custom title if empty or same as default
      emit('nodeDataUpdated', { nodeId: id, updates: { customTitle: null } });
    }
    setIsEditingTitle(false);
  }, [editedTitle, data.title, id]);

  const handleTitleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  }, []);

  const moveNodeOrder = (direction: 'up' | 'down'): void => {
    // Dispatch a custom event to move the node's execution order
    emit('moveNodeOrder', { nodeId: id, direction });
  };

  const handleRemove = (): void => {
    if (data.onRemove) {
      console.log('Removing node:', id);
      data.onRemove(id);
    } else {
      console.warn('No onRemove handler provided for node:', id);
    }
  };

  return (
    <div
      className="base-node-container"
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Extended Hover Area - invisible padding around node to detect hover near handles */}
      <div
        style={{
          position: 'absolute',
          top: '-24px',
          left: '-24px',
          right: '-24px',
          bottom: '-24px',
          pointerEvents: 'auto',
          zIndex: -1,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Floating Header Above Node */}
      <div
        className="node-floating-header"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            className="node-floating-title-input nodrag"
            value={editedTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
          />
        ) : (
          <span
            className="node-floating-title"
            onDoubleClick={handleTitleDoubleClick}
            title="Double-click to rename"
          >
            {data.customTitle || data.title}
          </span>
        )}
        <div className="node-floating-meta">
          {data.metadata && (
            <span
              className="node-floating-metadata nodrag"
              onClick={(e: MouseEvent<HTMLSpanElement>) => {
                e.preventDefault();
                e.stopPropagation();
                if (data.onMetadataClick) {
                  data.onMetadataClick();
                }
              }}
              style={{ cursor: data.onMetadataClick ? 'pointer' : 'default' }}
              title={data.onMetadataClick ? 'Click to change model' : ''}
            >
              {data.metadata}
            </span>
          )}
          {data.lastRunDurationMs && (
            <span className="node-floating-timer nodrag" title="Last execution time">
              {formatDuration(data.lastRunDurationMs)}
            </span>
          )}
        </div>
      </div>

      <div
        ref={nodeRef}
        className={`resizable-node${className ? ' ' + className : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <NodeResizer
          minWidth={150}
          minHeight={60}
          isVisible={selected}
          lineStyle={{ borderWidth: 1 }}
          handleStyle={{ width: 8, height: 8 }}
          keepAspectRatio={false}
        />

        {/* Drag Handle Bar */}
        <div
          className="custom-drag-handle"
          style={{ minHeight: '8px', padding: '4px', ...dragHandleStyle }}
        ></div>

        {/* Node Content */}
        <div
          className="node-content nodrag"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            ...contentStyle,
          }}
        >
          {children}
        </div>

        {/* Render Handles - Positioned outside node */}
        {handles.map((handle) => {
          // Calculate offset to position handles outside the node
          const isInput = handle.type === 'input' || handle.type === 'target';
          const isOutput = handle.type === 'output' || handle.type === 'source';

          // Position handles outside the node boundary
          let offsetStyle: CSSProperties = {};
          if (handle.position === Position.Left) {
            offsetStyle = { left: '-20px' };
          } else if (handle.position === Position.Right) {
            offsetStyle = { right: '-20px' };
          } else if (handle.position === Position.Top) {
            offsetStyle = { top: '-20px' };
          } else if (handle.position === Position.Bottom) {
            offsetStyle = { bottom: '-20px' };
          }

          return (
            <Handle
              key={handle.id}
              type={isInput ? 'target' : isOutput ? 'source' : (handle.type as 'target' | 'source')}
              position={handle.position}
              id={handle.id}
              style={{
                color: getHandleColor(handle.dataType),
                width: 32,
                height: 32,
                border: 'none',
                background: 'transparent',
                transition: 'opacity 0.2s ease-in-out',
                opacity: isHovered || selected ? 1 : 0,
                ...offsetStyle,
                ...handle.style, // Apply custom positioning
              }}
            >
              <IoIosAddCircle
                className="handle-icon"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '28px',
                  color: 'white',
                  pointerEvents: 'none',
                }}
              />
            </Handle>
          );
        })}
      </div>

      {/* Settings Popover - Render to portal when selected */}
      {!onSettingsClick && selected && (
        <NodeSettingsPopover
          isOpen={true}
          onClose={() => {}}
          title={`${data.title} Settings`}
          renderToPortal={true}
        >
          <div className="node-settings-content">
            <div className="settings-section">
              <label>Execution Order</label>
              <div className="execution-order-display">{data.executionOrder || '?'}</div>
              <div className="order-controls-vertical">
                <button
                  onClick={(e: MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    moveNodeOrder('up');
                  }}
                  className="order-button-large"
                  title="Move Earlier in Execution Order"
                >
                  ↑ Move Up
                </button>
                <button
                  onClick={(e: MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    moveNodeOrder('down');
                  }}
                  className="order-button-large"
                  title="Move Later in Execution Order"
                >
                  ↓ Move Down
                </button>
              </div>
            </div>
            <div className="settings-section">
              <button
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemove();
                }}
                className="delete-button-large"
                title="Remove node"
              >
                <FaTrash style={{ marginRight: '6px' }} /> Delete Node
              </button>
            </div>
          </div>
        </NodeSettingsPopover>
      )}
    </div>
  );
};

export default BaseNode;
