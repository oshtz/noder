import React from 'react';
import { useViewport } from 'reactflow';
import type { Node } from 'reactflow';

export interface HelperLinesProps {
  /** Y coordinate for horizontal line (null to hide) */
  horizontal: number | null;
  /** X coordinate for vertical line (null to hide) */
  vertical: number | null;
}

export interface HelperLinesResult {
  horizontal: number | null;
  vertical: number | null;
  snapPosition: { x: number; y: number } | null;
}

interface AlignmentCheck {
  dragging: number;
  target: number;
  snapTo: number;
}

/**
 * HelperLines - Visual alignment guides for node positioning
 *
 * Renders horizontal and vertical lines when nodes are being dragged
 * to help align them with other nodes in the workflow.
 * Uses ReactFlow viewport to correctly position lines in flow coordinates.
 */
const HelperLines: React.FC<HelperLinesProps> = ({ horizontal, vertical }) => {
  const { x: viewportX, y: viewportY, zoom } = useViewport();

  // Don't render if no lines to show
  if (horizontal === null && vertical === null) {
    return null;
  }

  return (
    <svg
      className="helper-lines-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {horizontal !== null && horizontal !== undefined && (
        <line
          className="helper-line helper-line-horizontal"
          x1="0"
          y1={horizontal * zoom + viewportY}
          x2="100%"
          y2={horizontal * zoom + viewportY}
          stroke="var(--primary-color, #6366f1)"
          strokeWidth="1"
          strokeDasharray="4 2"
        />
      )}
      {vertical !== null && vertical !== undefined && (
        <line
          className="helper-line helper-line-vertical"
          x1={vertical * zoom + viewportX}
          y1="0"
          x2={vertical * zoom + viewportX}
          y2="100%"
          stroke="var(--primary-color, #6366f1)"
          strokeWidth="1"
          strokeDasharray="4 2"
        />
      )}
    </svg>
  );
};

/**
 * Calculate helper line positions based on dragging node and other nodes
 *
 * @param draggingNode - The node being dragged
 * @param allNodes - All nodes in the flow
 * @param threshold - Snap threshold in pixels (default: 8)
 * @returns Object with horizontal/vertical line positions and snap position
 */
export const getHelperLines = (
  draggingNode: Node | null | undefined,
  allNodes: Node[] | null | undefined,
  threshold: number = 8
): HelperLinesResult => {
  if (!draggingNode || !allNodes || allNodes.length === 0) {
    return { horizontal: null, vertical: null, snapPosition: null };
  }

  const draggingId = draggingNode.id;
  const draggingX = draggingNode.position?.x ?? 0;
  const draggingY = draggingNode.position?.y ?? 0;
  const draggingWidth =
    draggingNode.width ||
    (typeof draggingNode.style?.width === 'number' ? draggingNode.style.width : 280);
  const draggingHeight =
    draggingNode.height ||
    (typeof draggingNode.style?.height === 'number' ? draggingNode.style.height : 200);

  // Calculate dragging node's key positions
  const draggingLeft = draggingX;
  const draggingCenterX = draggingX + draggingWidth / 2;
  const draggingRight = draggingX + draggingWidth;
  const draggingTop = draggingY;
  const draggingCenterY = draggingY + draggingHeight / 2;
  const draggingBottom = draggingY + draggingHeight;

  let horizontal: number | null = null;
  let vertical: number | null = null;
  let snapX: number | null = null;
  let snapY: number | null = null;
  let minDistanceX = threshold;
  let minDistanceY = threshold;

  // Check alignment with other nodes
  allNodes.forEach((node) => {
    if (node.id === draggingId) return;

    const nodeX = node.position?.x ?? 0;
    const nodeY = node.position?.y ?? 0;
    const nodeWidth =
      node.width || (typeof node.style?.width === 'number' ? node.style.width : 280);
    const nodeHeight =
      node.height || (typeof node.style?.height === 'number' ? node.style.height : 200);

    // Other node's key positions
    const nodeLeft = nodeX;
    const nodeCenterX = nodeX + nodeWidth / 2;
    const nodeRight = nodeX + nodeWidth;
    const nodeTop = nodeY;
    const nodeCenterY = nodeY + nodeHeight / 2;
    const nodeBottom = nodeY + nodeHeight;

    // Vertical alignment checks (X positions)
    const verticalChecks: AlignmentCheck[] = [
      { dragging: draggingLeft, target: nodeLeft, snapTo: nodeLeft },
      { dragging: draggingLeft, target: nodeCenterX, snapTo: nodeCenterX },
      { dragging: draggingLeft, target: nodeRight, snapTo: nodeRight },
      { dragging: draggingCenterX, target: nodeLeft, snapTo: nodeLeft - draggingWidth / 2 },
      { dragging: draggingCenterX, target: nodeCenterX, snapTo: nodeCenterX - draggingWidth / 2 },
      { dragging: draggingCenterX, target: nodeRight, snapTo: nodeRight - draggingWidth / 2 },
      { dragging: draggingRight, target: nodeLeft, snapTo: nodeLeft - draggingWidth },
      { dragging: draggingRight, target: nodeCenterX, snapTo: nodeCenterX - draggingWidth },
      { dragging: draggingRight, target: nodeRight, snapTo: nodeRight - draggingWidth },
    ];

    verticalChecks.forEach(({ dragging, target, snapTo }) => {
      const distance = Math.abs(dragging - target);
      if (distance < minDistanceX) {
        minDistanceX = distance;
        vertical = target;
        snapX = snapTo;
      }
    });

    // Horizontal alignment checks (Y positions)
    const horizontalChecks: AlignmentCheck[] = [
      { dragging: draggingTop, target: nodeTop, snapTo: nodeTop },
      { dragging: draggingTop, target: nodeCenterY, snapTo: nodeCenterY },
      { dragging: draggingTop, target: nodeBottom, snapTo: nodeBottom },
      { dragging: draggingCenterY, target: nodeTop, snapTo: nodeTop - draggingHeight / 2 },
      { dragging: draggingCenterY, target: nodeCenterY, snapTo: nodeCenterY - draggingHeight / 2 },
      { dragging: draggingCenterY, target: nodeBottom, snapTo: nodeBottom - draggingHeight / 2 },
      { dragging: draggingBottom, target: nodeTop, snapTo: nodeTop - draggingHeight },
      { dragging: draggingBottom, target: nodeCenterY, snapTo: nodeCenterY - draggingHeight },
      { dragging: draggingBottom, target: nodeBottom, snapTo: nodeBottom - draggingHeight },
    ];

    horizontalChecks.forEach(({ dragging, target, snapTo }) => {
      const distance = Math.abs(dragging - target);
      if (distance < minDistanceY) {
        minDistanceY = distance;
        horizontal = target;
        snapY = snapTo;
      }
    });
  });

  return {
    horizontal,
    vertical,
    snapPosition:
      snapX !== null || snapY !== null
        ? {
            x: snapX !== null ? snapX : draggingX,
            y: snapY !== null ? snapY : draggingY,
          }
        : null,
  };
};

export default HelperLines;
