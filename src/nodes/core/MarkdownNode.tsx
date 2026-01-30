import React, { useState, useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Position } from 'reactflow';
import BaseNode from '../../components/BaseNode';
import { HANDLE_TYPES, HandleDataType } from '../../constants/handleTypes';
import { on } from '../../utils/eventBus';

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
  value: string | boolean | number;
}

interface NodeContentChangedEvent {
  detail: {
    targetId?: string;
    content?: ContentPayload;
  };
}

interface MarkdownNodeData {
  title: string;
  onRemove: (id: string) => void;
  content: ContentPayload;
  savedContent: ContentPayload;
  handles: HandleDefinition[];
}

interface MarkdownNodeProps {
  id: string;
  data: MarkdownNodeData;
  selected?: boolean;
}

interface CreateNodeParams {
  id: string;
  handleRemoveNode: (id: string) => void;
  position?: { x: number; y: number };
  style?: { width: number; height: number };
}

// =============================================================================
// Constants
// =============================================================================

export const NODE_TYPE = 'markdown';

const handles: HandleDefinition[] = [
  {
    id: 'text-in',
    type: 'target',
    position: Position.Left,
    dataType: HANDLE_TYPES.TEXT.dataType,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

const formatContent = (content: ContentPayload | string | null | undefined): string => {
  if (!content) return '';

  // If content is already a string, return it
  if (typeof content === 'string') return content;

  // If content has type information, format based on type
  if (content.type && content.value !== undefined) {
    switch (content.type) {
      case HANDLE_TYPES.TEXT.type:
        return String(content.value);
      case 'bool':
        return content.value ? '**True**' : '**False**';
      case 'int':
      case 'float':
        return `\`${String(content.value)}\``;
      default:
        return String(content.value);
    }
  }

  // Fallback: convert to string
  return String(content);
};

// =============================================================================
// Node Factory
// =============================================================================

export const createNode = ({
  id,
  handleRemoveNode,
  position,
  style = { width: 300, height: 300 },
}: CreateNodeParams): {
  id: string;
  type: string;
  style: { width: number; height: number };
  data: MarkdownNodeData;
  position: { x: number; y: number };
} => {
  const initialContent: ContentPayload = {
    value:
      '# Welcome\nConnect this node to a Text (text) node to display markdown content.\n\nSupports:\n- Headers\n- Lists\n- **Bold**\n- *Italic*\n- `Code`\n- And more!',
    type: HANDLE_TYPES.TEXT.type,
  };

  return {
    id,
    type: NODE_TYPE,
    style,
    data: {
      title: 'Markdown',
      onRemove: handleRemoveNode,
      content: initialContent,
      savedContent: initialContent,
      handles,
    },
    position: position || { x: 0, y: 0 },
  };
};

// =============================================================================
// MarkdownContent Component
// =============================================================================

interface MarkdownContentProps {
  content: ContentPayload | string | null | undefined;
}

const MarkdownContent = memo<MarkdownContentProps>(({ content }) => {
  const displayValue = formatContent(content);

  return (
    <div className="markdown-content">
      <ReactMarkdown>{displayValue}</ReactMarkdown>
    </div>
  );
});

MarkdownContent.displayName = 'MarkdownContent';

// =============================================================================
// MarkdownNode Component
// =============================================================================

const MarkdownNode: React.FC<MarkdownNodeProps> = ({ id, data, selected }) => {
  const [content, setContent] = useState<ContentPayload | string>(data.content);
  const processedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleNodeContentChanged = (event: NodeContentChangedEvent): void => {
      const { targetId, content: contentPayload } = event.detail;

      // Generate a unique event identifier
      const eventId = `${targetId}-${Date.now()}`;

      // Skip if we've already processed this event
      if (processedEvents.current.has(eventId)) {
        return;
      }

      if (targetId === id && contentPayload?.type === HANDLE_TYPES.TEXT.type) {
        setContent(contentPayload);

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
    return () => offNodeContentChanged();
  }, [id]);

  return (
    <BaseNode id={id} data={data} handles={handles} selected={selected}>
      <MarkdownContent content={content} />
    </BaseNode>
  );
};

export default MarkdownNode;
