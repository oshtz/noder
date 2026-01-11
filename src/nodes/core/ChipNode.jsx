import React, { useState, useEffect, useRef, useCallback } from "react";
import { Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import { Handle } from 'reactflow';
import { IoIosAddCircle } from 'react-icons/io';
import { HANDLE_TYPES } from "../../constants/handleTypes";
import { emit, on } from "../../utils/eventBus";
import '@reactflow/node-resizer/dist/style.css';

export const NODE_TYPE = "chip";

const handles = [
  {
    id: "out",
    type: "source",
    position: Position.Right,
    dataType: HANDLE_TYPES.TEXT.dataType,
    style: { top: '50%' }
  }
];

export const createNode = ({ id, handleRemoveNode, position }) => ({
  id,
  type: NODE_TYPE,
  position: position || { x: 0, y: 0 },
  style: { width: 160, height: 60 },
  data: {
    title: "Chip",
    onRemove: handleRemoveNode,
    handles,
    content: "",
    chipId: "" // User-defined chip ID like "CHIP1", "COLOR", etc.
  }
});

const ChipNode = ({ id, data, selected }) => {
  const [content, setContent] = useState(data.content || "");
  const [chipId, setChipId] = useState(data.chipId || "");
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingChipId, setIsEditingChipId] = useState(false);
  const inputRef = useRef(null);
  const chipIdInputRef = useRef(null);

  // Generate default chipId from node id if not set
  const effectiveChipId = chipId || id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();

  // Define dispatchOutput with useCallback so it can be used in effects
  const dispatchOutput = useCallback((value, chipIdValue) => {
    const edges = window.edgesRef?.current || [];
    const outgoing = edges.filter((edge) => edge.source === id && edge.sourceHandle === "out");

    const payload = {
      type: HANDLE_TYPES.TEXT.type,
      value,
      chipId: chipIdValue,
      isChip: true
    };

    outgoing.forEach((edge) => {
      emit("nodeContentChanged", {
        sourceId: id,
        targetId: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        content: payload
      });
    });

    // Emit global chip update for any listeners
    emit("chipUpdated", {
      nodeId: id,
      chipId: chipIdValue,
      content: value
    });
  }, [id]);

  // Focus chip ID input when editing
  useEffect(() => {
    if (isEditingChipId && chipIdInputRef.current) {
      chipIdInputRef.current.focus();
      chipIdInputRef.current.select();
    }
  }, [isEditingChipId]);

  // Dispatch output when content or chipId changes
  useEffect(() => {
    data.content = content;
    data.chipId = effectiveChipId;
    dispatchOutput(content, effectiveChipId);
  }, [content, effectiveChipId, dispatchOutput]);

  // Sync with external data changes
  useEffect(() => {
    if (data.content !== undefined && data.content !== content) {
      setContent(data.content || "");
      if (inputRef.current && inputRef.current.innerText !== data.content) {
        inputRef.current.innerText = data.content || "";
      }
    }
    if (data.chipId !== undefined && data.chipId !== chipId) {
      setChipId(data.chipId || "");
    }
  }, [data.content, data.chipId]);

  // Set initial content on mount
  useEffect(() => {
    if (inputRef.current && content) {
      inputRef.current.innerText = content;
    }
  }, []);

  // Listen for edge changes to dispatch when newly connected
  useEffect(() => {
    const handleEdgesChange = () => {
      // Re-dispatch current value to any connected nodes
      dispatchOutput(content, effectiveChipId);
    };

    const off = on("edgesChange", handleEdgesChange);
    return () => off();
  }, [content, effectiveChipId, dispatchOutput]);

  // Also dispatch on mount after a short delay to handle initial connections
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatchOutput(content, effectiveChipId);
    }, 100);
    return () => clearTimeout(timer);
  }, [dispatchOutput]);

  const handleChipIdChange = (e) => {
    // Sanitize as user types - only allow alphanumeric and underscore
    const sanitized = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    setChipId(sanitized);
  };

  const handleChipIdBlur = () => {
    setIsEditingChipId(false);
  };

  const handleChipIdKeyDown = (e) => {
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
        border: selected ? '2px solid var(--primary-color, #6366f1)' : '1px solid var(--border-color, #333)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxSizing: 'border-box'
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
          textAlign: 'center'
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
              outline: 'none'
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
        onInput={(e) => setContent(e.currentTarget.innerText || "")}
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
          justifyContent: 'center'
        }}
      />

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
          opacity: (isHovered || selected) ? 1 : 0
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
            pointerEvents: 'none'
          }}
        />
      </Handle>
    </div>
  );
};

export default ChipNode;
