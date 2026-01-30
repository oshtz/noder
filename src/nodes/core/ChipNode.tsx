import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
  KeyboardEvent,
  CSSProperties,
} from 'react';
import { Position, Handle, useEdges, Edge } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import { IoIosAddCircle } from 'react-icons/io';
import { HANDLE_TYPES, HandleDataType } from '../../constants/handleTypes';
import { emit, on } from '../../utils/eventBus';
import '@reactflow/node-resizer/dist/style.css';

// =============================================================================
// Types
// =============================================================================

interface HandleDefinition {
  id: string;
  type: 'source' | 'target';
  position: Position;
  dataType: HandleDataType;
  style?: CSSProperties;
}

interface ChipNodeData {
  title: string;
  onRemove: (id: string) => void;
  handles: HandleDefinition[];
  content: string;
  chipId: string;
}

interface ChipNodeProps {
  id: string;
  data: ChipNodeData;
  selected?: boolean;
}

interface CreateNodeParams {
  id: string;
  handleRemoveNode: (id: string) => void;
  position?: { x: number; y: number };
}

interface ChipPayload {
  type: string;
  value: string;
  chipId: string;
  isChip: boolean;
}

interface ContentPayload {
  type: string;
  value?: string;
}

interface NodeContentChangedEvent {
  detail: {
    targetId?: string;
    targetHandle?: string;
    content?: ContentPayload;
  };
}

// =============================================================================
// Constants
// =============================================================================

export const NODE_TYPE = 'chip';

const handles: HandleDefinition[] = [
  {
    id: 'in',
    type: 'target',
    position: Position.Left,
    dataType: HANDLE_TYPES.TEXT.dataType,
    style: { top: '50%' },
  },
  {
    id: 'out',
    type: 'source',
    position: Position.Right,
    dataType: HANDLE_TYPES.TEXT.dataType,
    style: { top: '50%' },
  },
];

// =============================================================================
// Node Factory
// =============================================================================

export const createNode = ({
  id,
  handleRemoveNode,
  position,
}: CreateNodeParams): {
  id: string;
  type: string;
  position: { x: number; y: number };
  style: { width: number; height: number };
  data: ChipNodeData;
} => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  style: { width: 160, height: 60 },
  data: {
    title: 'Chip',
    onRemove: handleRemoveNode,
    handles,
    content: '',
    chipId: '',
  },
});

// =============================================================================
// ChipNode Component
// =============================================================================

const ChipNode: React.FC<ChipNodeProps> = ({ id, data, selected = false }) => {
  const edges = useEdges();
  const [content, setContent] = useState(data.content || '');
  const [chipId, setChipId] = useState(data.chipId || '');
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingChipId, setIsEditingChipId] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const chipIdInputRef = useRef<HTMLInputElement>(null);

  // Generate default chipId from node id if not set
  const effectiveChipId =
    chipId ||
    id
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 8)
      .toUpperCase();

  // Define dispatchOutput with useCallback so it can be used in effects
  const dispatchOutput = useCallback(
    (value: string, chipIdValue: string): void => {
      const outgoing = edges.filter(
        (edge: Edge) => edge.source === id && edge.sourceHandle === 'out'
      );

      const payload: ChipPayload = {
        type: HANDLE_TYPES.TEXT.type,
        value,
        chipId: chipIdValue,
        isChip: true,
      };

      outgoing.forEach((edge: Edge) => {
        emit('nodeContentChanged', {
          sourceId: id,
          targetId: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          content: payload,
        });
      });

      // Emit global chip update for any listeners
      emit('chipUpdated', {
        nodeId: id,
        chipId: chipIdValue,
        content: value,
      });
    },
    [edges, id]
  );

  // Focus chip ID input when editing
  useEffect(() => {
    if (isEditingChipId && chipIdInputRef.current) {
      chipIdInputRef.current.focus();
      chipIdInputRef.current.select();
    }
  }, [isEditingChipId]);

  // Dispatch output when content or chipId changes
  useEffect(() => {
    (data as ChipNodeData).content = content;
    (data as ChipNodeData).chipId = effectiveChipId;
    dispatchOutput(content, effectiveChipId);
  }, [content, effectiveChipId, dispatchOutput, data]);

  // Sync with external data changes
  useEffect(() => {
    if (data.content !== undefined && data.content !== content) {
      setContent(data.content || '');
      if (inputRef.current && inputRef.current.innerText !== data.content) {
        inputRef.current.innerText = data.content || '';
      }
    }
    if (data.chipId !== undefined && data.chipId !== chipId) {
      setChipId(data.chipId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.content, data.chipId]);

  // Set initial content on mount
  useEffect(() => {
    if (inputRef.current && content) {
      inputRef.current.innerText = content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for input from connected nodes
  useEffect(() => {
    const handleNodeContentChanged = (event: NodeContentChangedEvent): void => {
      const { targetId, targetHandle, content: contentPayload } = event.detail;

      if (targetId !== id) return;
      if (targetHandle && targetHandle !== 'in') return;
      if (contentPayload?.type !== HANDLE_TYPES.TEXT.type) return;

      const nextValue = String(contentPayload.value ?? '');
      if (nextValue === content) return;

      setContent(nextValue);
      (data as ChipNodeData).content = nextValue;

      if (inputRef.current && inputRef.current.innerText !== nextValue) {
        inputRef.current.innerText = nextValue;
      }
    };

    const off = on('nodeContentChanged', handleNodeContentChanged as (event: unknown) => void);
    return () => off();
  }, [content, data, id]);

  // Listen for edge changes to dispatch when newly connected
  useEffect(() => {
    const handleEdgesChange = (): void => {
      // Re-dispatch current value to any connected nodes
      dispatchOutput(content, effectiveChipId);
    };

    const off = on('edgesChange', handleEdgesChange);
    return () => off();
  }, [content, effectiveChipId, dispatchOutput]);

  // Also dispatch on mount after a short delay to handle initial connections
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatchOutput(content, effectiveChipId);
    }, 100);
    return () => clearTimeout(timer);
  }, [dispatchOutput, content, effectiveChipId]);

  const handleChipIdChange = (e: ChangeEvent<HTMLInputElement>): void => {
    // Sanitize as user types - only allow alphanumeric and underscore
    const sanitized = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    setChipId(sanitized);
  };

  const handleChipIdBlur = (): void => {
    setIsEditingChipId(false);
  };

  const handleChipIdKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      chipIdInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setIsEditingChipId(false);
    }
  };

  const placeholderText = `__${effectiveChipId}__`;

  return (
    <div
      className="chip-node"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--node-bg, #1a1a2e)',
        border: selected
          ? '2px solid var(--primary-color, #6366f1)'
          : '1px solid var(--border-color, #333)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <NodeResizer
        minWidth={100}
        minHeight={40}
        isVisible={selected}
        lineStyle={{ borderWidth: 1 }}
        handleStyle={{ width: 8, height: 8 }}
      />

      {/* Chip ID Badge */}
      <div
        className="chip-id-badge nodrag"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditingChipId(true);
        }}
        style={{
          position: 'absolute',
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--primary-color, #6366f1)',
          color: 'white',
          fontSize: '10px',
          fontFamily: 'monospace',
          padding: '2px 8px',
          borderRadius: '6px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          zIndex: 10,
          minWidth: '60px',
          textAlign: 'center',
        }}
        title="Click to edit chip ID"
      >
        {isEditingChipId ? (
          <input
            ref={chipIdInputRef}
            type="text"
            value={chipId}
            onChange={handleChipIdChange}
            onBlur={handleChipIdBlur}
            onKeyDown={handleChipIdKeyDown}
            placeholder={effectiveChipId}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '10px',
              fontFamily: 'monospace',
              width: '80px',
              textAlign: 'center',
              outline: 'none',
            }}
          />
        ) : (
          placeholderText
        )}
      </div>

      {/* Content Input */}
      <div
        ref={inputRef}
        className="chip-input nodrag"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => setContent((e.currentTarget as HTMLDivElement).innerText || '')}
        data-placeholder="value..."
        style={{
          width: 'calc(100% - 24px)',
          height: 'calc(100% - 24px)',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-color, #fff)',
          fontSize: '14px',
          fontWeight: '500',
          outline: 'none',
          textAlign: 'center',
          overflow: 'hidden',
          wordWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{
          width: 32,
          height: 32,
          border: 'none',
          background: 'transparent',
          left: '-45px',
          transition: 'opacity 0.2s ease-in-out',
          opacity: isHovered || selected ? 1 : 0,
        }}
      >
        <IoIosAddCircle
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '30px',
            color: 'white',
            pointerEvents: 'none',
          }}
        />
      </Handle>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          width: 32,
          height: 32,
          border: 'none',
          background: 'transparent',
          right: '-45px',
          transition: 'opacity 0.2s ease-in-out',
          opacity: isHovered || selected ? 1 : 0,
        }}
      >
        <IoIosAddCircle
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '30px',
            color: 'white',
            pointerEvents: 'none',
          }}
        />
      </Handle>
    </div>
  );
};

export default ChipNode;
