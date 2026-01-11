import React from "react";
import { Position } from 'reactflow';
import BaseNode from "../../components/BaseNode";
import { HANDLE_TYPES } from "../../constants/handleTypes";
import { emit, on } from "../../utils/eventBus";

export const NODE_TYPE = "display-text";

const handles = [
  { 
    id: "text-in", 
    type: "target", 
    position: Position.Left, 
    dataType: HANDLE_TYPES.TEXT.dataType 
  },
  { 
    id: "text-out", 
    type: "source", 
    position: Position.Right, 
    dataType: HANDLE_TYPES.TEXT.dataType 
  }
];

export const createNode = ({ id, handleRemoveNode, position }) => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  data: {
    title: "Display Text",
    onRemove: handleRemoveNode,
    content: "Connect a node to display its output here.",
    handles
  }
});

const DisplayTextNode = ({ id, data, selected, className }) => {
  const [content, setContent] = React.useState(data.content);
  const [isWaiting, setIsWaiting] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [isBlinking, setIsBlinking] = React.useState(false);
  const processedEvents = React.useRef(new Set());
  const blinkTimeoutRef = React.useRef(null);

  // Listen for input from connected nodes
  React.useEffect(() => {
    const handleNodeContentChanged = (event) => {
      console.log('Display node received content event:', event.detail);
      const { sourceId, targetId, sourceHandle, targetHandle, content } = event.detail;
      
      // Generate a unique event identifier
      const eventId = `${sourceId}-${targetId}-${Date.now()}`;
      
      // Skip if we've already processed this event
      if (processedEvents.current.has(eventId)) {
        return;
      }
      
      // Check if this event is meant for us
      if ((targetId === id || !targetId) && targetHandle === "text-in" && content?.type === HANDLE_TYPES.TEXT.type) {
        console.log('Display node updating content:', content.value);
        setError(null);
        setContent(content.value);

        // Start blinking animation: blink twice (1s total if CSS is 0.5s per blink)
        setIsBlinking(true);
        if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
        blinkTimeoutRef.current = setTimeout(() => {
          setIsBlinking(false);
        }, 1000);

        // Forward the content to any connected nodes
        const forwardEvent = new CustomEvent("nodeContentChanged", {
          detail: {
            sourceId: id,
            sourceHandle: "text-out",
            content: {
              type: HANDLE_TYPES.TEXT.type,
              value: content.value
            }
          }
        });
        emit("nodeContentChanged", forwardEvent.detail);
        
        // Add to processed events
        processedEvents.current.add(eventId);
        
        // Clean up old events after 1 second
        setTimeout(() => {
          processedEvents.current.delete(eventId);
        }, 1000);
      }
    };

    const offNodeContentChanged = on("nodeContentChanged", handleNodeContentChanged);
    return () => {
      offNodeContentChanged();
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, [id]);

  // Compose className for blinking
  const nodeClassName = [
    className,
    isBlinking ? "processing" : ""
  ].filter(Boolean).join(" ");

  return (
    <BaseNode
      id={id}
      data={data}
      handles={handles}
      selected={selected}
      className={nodeClassName}
    >
      <div 
        style={{ 
          padding: '10px',
          minHeight: '100px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere'
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
