import React, { useState, useEffect, useRef } from 'react';
import { Position } from 'reactflow';
import BaseNode from '../../components/BaseNode';
import { HANDLE_TYPES, HandleDataType } from '../../constants/handleTypes';
import { emit, on } from '../../utils/eventBus';

// =============================================================================
// Types
// =============================================================================

interface HandleDefinition {
  id: string;
  type: 'source' | 'target';
  position: Position;
  dataType: HandleDataType;
}

interface ContentPayload {
  type: string;
  value: string;
}

interface NodeContentChangedEvent {
  detail: {
    sourceId: string;
    targetId?: string;
    sourceHandle?: string;
    targetHandle?: string;
    content?: ContentPayload;
  };
}

interface DisplayTextNodeData {
  title: string;
  onRemove: (id: string) => void;
  content: string;
  handles: HandleDefinition[];
}

interface DisplayTextNodeProps {
  id: string;
  data: DisplayTextNodeData;
  selected?: boolean;
  className?: string;
}

interface CreateNodeParams {
  id: string;
  handleRemoveNode: (id: string) => void;
  position?: { x: number; y: number };
}

// =============================================================================
// Constants
// =============================================================================

export const NODE_TYPE = 'display-text';

const handles: HandleDefinition[] = [
  {
    id: 'text-in',
    type: 'target',
    position: Position.Left,
    dataType: HANDLE_TYPES.TEXT.dataType,
  },
  {
    id: 'text-out',
    type: 'source',
    position: Position.Right,
    dataType: HANDLE_TYPES.TEXT.dataType,
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
  data: DisplayTextNodeData;
} => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  data: {
    title: 'Display Text',
    onRemove: handleRemoveNode,
    content: 'Connect a node to display its output here.',
    handles,
  },
});

// =============================================================================
// DisplayTextNode Component
// =============================================================================

const DisplayTextNode: React.FC<DisplayTextNodeProps> = ({ id, data, selected, className }) => {
  const [content, setContent] = useState(data.content);
  const [isWaiting, _setIsWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const processedEvents = useRef<Set<string>>(new Set());
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for input from connected nodes
  useEffect(() => {
    const handleNodeContentChanged = (event: NodeContentChangedEvent): void => {
      console.log('Display node received content event:', event.detail);
      const { sourceId, targetId, targetHandle, content: contentPayload } = event.detail;

      // Generate a unique event identifier
      const eventId = `${sourceId}-${targetId}-${Date.now()}`;

      // Skip if we've already processed this event
      if (processedEvents.current.has(eventId)) {
        return;
      }

      // Check if this event is meant for us
      if (
        (targetId === id || !targetId) &&
        targetHandle === 'text-in' &&
        contentPayload?.type === HANDLE_TYPES.TEXT.type
      ) {
        console.log('Display node updating content:', contentPayload.value);
        setError(null);
        setContent(contentPayload.value);

        // Start blinking animation: blink twice (1s total if CSS is 0.5s per blink)
        setIsBlinking(true);
        if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
        blinkTimeoutRef.current = setTimeout(() => {
          setIsBlinking(false);
        }, 1000);

        // Forward the content to any connected nodes
        emit('nodeContentChanged', {
          sourceId: id,
          sourceHandle: 'text-out',
          content: {
            type: HANDLE_TYPES.TEXT.type,
            value: contentPayload.value,
          },
        });

        // Add to processed events
        processedEvents.current.add(eventId);

        // Clean up old events after 1 second
        setTimeout(() => {
          processedEvents.current.delete(eventId);
        }, 1000);
      }
    };

    const offNodeContentChanged = on(
      'nodeContentChanged',
      handleNodeContentChanged as (event: unknown) => void
    );
    return () => {
      offNodeContentChanged();
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, [id]);

  // Compose className for blinking
  const nodeClassName = [className, isBlinking ? 'processing' : ''].filter(Boolean).join(' ');

  return (
    <BaseNode id={id} data={data} handles={handles} selected={selected} className={nodeClassName}>
      <div
        style={{
          padding: '10px',
          minHeight: '100px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        }}
      >
        {isWaiting ? (
          <div>Waiting for input...</div>
        ) : error ? (
          <div style={{ color: 'red' }}>{error}</div>
        ) : (
          content
        )}
      </div>
    </BaseNode>
  );
};

export default DisplayTextNode;
