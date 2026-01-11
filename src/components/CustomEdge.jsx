import React, { useMemo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, Position } from 'reactflow';
import { emit } from '../utils/eventBus';

// Generate unique IDs for SVG gradients to avoid conflicts
let gradientIdCounter = 0;
const getUniqueGradientId = () => `edge-gradient-${++gradientIdCounter}`;

// Get the edge path based on edge type setting
const getEdgePath = (edgeType, params) => {
  switch (edgeType) {
    case 'straight':
      return getStraightPath(params);
    case 'step':
      return getSmoothStepPath({ ...params, borderRadius: 0 });
    case 'smoothstep':
      return getSmoothStepPath({ ...params, borderRadius: 10 });
    case 'bezier':
    default:
      return getBezierPath(params);
  }
};

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data
}) => {
  // Offset handles by 50px to connect to node frame instead of handle position
  const HANDLE_OFFSET = 50;
  
  // Adjust source position
  let adjustedSourceX = sourceX;
  let adjustedSourceY = sourceY;
  
  if (sourcePosition === Position.Left) {
    adjustedSourceX = sourceX + HANDLE_OFFSET;
  } else if (sourcePosition === Position.Right) {
    adjustedSourceX = sourceX - HANDLE_OFFSET;
  } else if (sourcePosition === Position.Top) {
    adjustedSourceY = sourceY + HANDLE_OFFSET;
  } else if (sourcePosition === Position.Bottom) {
    adjustedSourceY = sourceY - HANDLE_OFFSET;
  }
  
  // Adjust target position
  let adjustedTargetX = targetX;
  let adjustedTargetY = targetY;
  
  if (targetPosition === Position.Left) {
    adjustedTargetX = targetX + HANDLE_OFFSET;
  } else if (targetPosition === Position.Right) {
    adjustedTargetX = targetX - HANDLE_OFFSET;
  } else if (targetPosition === Position.Top) {
    adjustedTargetY = targetY + HANDLE_OFFSET;
  } else if (targetPosition === Position.Bottom) {
    adjustedTargetY = targetY - HANDLE_OFFSET;
  }

  // Get edge type from data (passed from app settings) or default to bezier
  const edgeTypeValue = data?.edgeType || 'bezier';
  
  const [edgePath, labelX, labelY] = getEdgePath(edgeTypeValue, {
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    sourcePosition,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    targetPosition,
  });

  // Check if this edge is part of an active processing flow
  const isProcessing = data?.isProcessing || false;
  const isDataFlowing = data?.isDataFlowing || false;
  
  // Generate unique gradient ID for this edge instance
  const flowGradientId = useMemo(() => getUniqueGradientId(), []);

  // Only show glows if this is the first edge at this handle (avoid stacking)
  const showSourceGlow = data?.showSourceGlow !== false;
  const showTargetGlow = data?.showTargetGlow !== false;

  // Keep the glow size fixed so resizing nodes does not scale it.
  const GLOW_MAJOR_RADIUS = 25;
  const GLOW_MINOR_RADIUS = 10;

  const getGlowDimensions = (position) => {
    if (position === Position.Left || position === Position.Right) {
      return { rx: GLOW_MINOR_RADIUS, ry: GLOW_MAJOR_RADIUS };
    }
    return { rx: GLOW_MAJOR_RADIUS, ry: GLOW_MINOR_RADIUS };
  };

  const sourceGlowDims = getGlowDimensions(sourcePosition);
  const targetGlowDims = getGlowDimensions(targetPosition);
  const storedHandleColor = data?.handleColor;
  const glowColor = style?.stroke
    || (storedHandleColor && storedHandleColor !== '#555' ? storedHandleColor : null)
    || 'rgba(200, 200, 200, 0.85)';
  const glowStyle = {
    '--edge-glow-color': glowColor,
    '--edge-glow-min': selected ? '0.45' : '0.25',
    '--edge-glow-max': selected ? '0.95' : '0.7',
    '--edge-glow-outer-min': selected ? '0.25' : '0.15',
    '--edge-glow-outer-max': selected ? '0.8' : '0.5'
  };

  return (
    <>
      {/* SVG filters for cross-platform blur (CSS filter:blur doesn't work on macOS WebKit) */}
      <defs>
        <filter id="edge-glow-blur-inner" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="edge-glow-blur-outer" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>

      {/* Inner glow effect at source connection point - only if first edge at this handle */}
      {showSourceGlow && (
        <ellipse
          cx={adjustedSourceX}
          cy={adjustedSourceY}
          rx={sourceGlowDims.rx}
          ry={sourceGlowDims.ry}
          fill="none"
          stroke="var(--edge-glow-color)"
          strokeWidth="3"
          filter="url(#edge-glow-blur-inner)"
          className="edge-glow edge-glow--inner edge-glow--source"
          style={glowStyle}
        />
      )}

      {/* Inner glow effect at target connection point - only if first edge at this handle */}
      {showTargetGlow && (
        <ellipse
          cx={adjustedTargetX}
          cy={adjustedTargetY}
          rx={targetGlowDims.rx}
          ry={targetGlowDims.ry}
          fill="none"
          stroke="var(--edge-glow-color)"
          strokeWidth="3"
          filter="url(#edge-glow-blur-inner)"
          className="edge-glow edge-glow--inner edge-glow--target"
          style={glowStyle}
        />
      )}

      {/* Outer rim glow on node frames - larger and more blurred */}
      {showSourceGlow && (
        <ellipse
          cx={adjustedSourceX}
          cy={adjustedSourceY}
          rx={sourceGlowDims.rx * 1.8}
          ry={sourceGlowDims.ry * 1.8}
          fill="none"
          stroke="var(--edge-glow-color)"
          strokeWidth="4"
          filter="url(#edge-glow-blur-outer)"
          className="edge-glow edge-glow--outer edge-glow--source"
          style={glowStyle}
        />
      )}

      {showTargetGlow && (
        <ellipse
          cx={adjustedTargetX}
          cy={adjustedTargetY}
          rx={targetGlowDims.rx * 1.8}
          ry={targetGlowDims.ry * 1.8}
          fill="none"
          stroke="var(--edge-glow-color)"
          strokeWidth="4"
          filter="url(#edge-glow-blur-outer)"
          className="edge-glow edge-glow--outer edge-glow--target"
          style={glowStyle}
        />
      )}
      
      {/* Define gradient for data flow animation */}
      {(isProcessing || isDataFlowing) && (
        <defs>
          <linearGradient id={flowGradientId} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.2">
              <animate
                attributeName="offset"
                values="-1;1"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor={glowColor} stopOpacity="1">
              <animate
                attributeName="offset"
                values="-0.5;1.5"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor={glowColor} stopOpacity="0.2">
              <animate
                attributeName="offset"
                values="0;2"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
      )}
      
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: selected ? 2.5 : (isProcessing || isDataFlowing) ? 2.5 : 2,
          stroke: (isProcessing || isDataFlowing) ? `url(#${flowGradientId})` : 'rgba(160, 160, 160, 0.6)',
          strokeDasharray: isProcessing ? 5 : 0,
          animation: isProcessing ? 'dashdraw 1s linear infinite' : 'none',
        }}
      />
      
      {/* Animated particle along the edge during data flow */}
      {(isProcessing || isDataFlowing) && (
        <circle r="4" fill={glowColor} filter="url(#glow)">
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}
      
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              className="edge-button"
              onClick={(event) => {
                event.stopPropagation();
                emit('deleteEdge', { edgeId: id });
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                background: 'var(--primary-color)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
