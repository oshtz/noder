import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Position } from 'reactflow';
import BaseNode from '../../components/BaseNode';
import { HANDLE_TYPES } from '../../constants/handleTypes';
import { on } from '../../utils/eventBus';

export const NODE_TYPE = 'markdown';

const handles = [
  { 
    id: "text-in", 
    type: "target", 
    position: Position.Left, 
    dataType: HANDLE_TYPES.TEXT.dataType 
  }
];

export const createNode = ({ id, handleRemoveNode, position, style = { width: 300, height: 300 } }) => {
  const initialContent = {
    value: "# Welcome\nConnect this node to a Text (text) node to display markdown content.\n\nSupports:\n- Headers\n- Lists\n- **Bold**\n- *Italic*\n- `Code`\n- And more!",
    type: HANDLE_TYPES.TEXT.type
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
      handles
    },
    position: position || { x: 0, y: 0 }
  };
};

const formatContent = (content) => {
  if (!content) return "";
  
  // If content is already a string, return it
  if (typeof content === "string") return content;
  
  // If content has type information, format based on type
  if (content.type && content.value !== undefined) {
    switch (content.type) {
      case HANDLE_TYPES.TEXT.type:
        return content.value;
      case "bool":
        return content.value ? "**True**" : "**False**";
      case "int":
      case "float":
        return `\`${String(content.value)}\``;
      default:
        return String(content.value);
    }
  }
  
  // Fallback: convert to string
  return String(content);
};

const MarkdownContent = React.memo(({ content }) => {
  const displayValue = formatContent(content);
  
  return (
    <div className="markdown-content">
      <ReactMarkdown>{displayValue}</ReactMarkdown>
    </div>
  );
});

const MarkdownNode = ({ id, data, selected }) => {
  const [content, setContent] = React.useState(data.content);
  const processedEvents = React.useRef(new Set());

  React.useEffect(() => {
    const handleNodeContentChanged = (event) => {
      const { targetId, content } = event.detail;
      
      // Generate a unique event identifier
      const eventId = `${targetId}-${Date.now()}`;
      
      // Skip if we've already processed this event
      if (processedEvents.current.has(eventId)) {
        return;
      }
      
      if (targetId === id && content?.type === HANDLE_TYPES.TEXT.type) {
        setContent(content);
        
        // Add to processed events
        processedEvents.current.add(eventId);
        
        // Clean up old events after 1 second
        setTimeout(() => {
          processedEvents.current.delete(eventId);
        }, 1000);
      }
    };

    const offNodeContentChanged = on("nodeContentChanged", handleNodeContentChanged);
    return () => offNodeContentChanged();
  }, [id]);

  return (
    <BaseNode
      id={id}
      data={data}
      handles={handles}
      selected={selected}
    >
      <MarkdownContent content={content} />
    </BaseNode>
  );
};

export default MarkdownNode;
