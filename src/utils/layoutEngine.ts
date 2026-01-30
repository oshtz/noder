/**
 * Layout Engine - Auto-arrange workflow nodes using dagre
 *
 * Provides automatic layout algorithms for organizing nodes in the workflow canvas.
 */

import dagre from '@dagrejs/dagre';
import type { Node, Edge, XYPosition } from 'reactflow';

// =============================================================================
// Constants
// =============================================================================

/** Default node dimensions (used when actual dimensions aren't available) */
const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 200;

/** Layout direction options */
export const LAYOUT_DIRECTION = {
  TOP_BOTTOM: 'TB',
  BOTTOM_TOP: 'BT',
  LEFT_RIGHT: 'LR',
  RIGHT_LEFT: 'RL',
} as const;

export type LayoutDirection = (typeof LAYOUT_DIRECTION)[keyof typeof LAYOUT_DIRECTION];

// =============================================================================
// Types
// =============================================================================

/** Options for layout algorithm */
export interface LayoutOptions {
  /** Layout direction ('TB', 'LR', 'BT', 'RL') */
  direction?: LayoutDirection;
  /** Horizontal spacing between nodes */
  nodeSpacing?: number;
  /** Vertical spacing between ranks/layers */
  rankSpacing?: number;
}

/** Result of layout operation */
export interface LayoutResult<T extends Node = Node> {
  nodes: T[];
  edges: Edge[];
}

/** Bounding box dimensions */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Node data with layout transition info */
export interface LayoutTransitionData {
  _layoutFromPosition?: XYPosition;
  _layoutToPosition?: XYPosition;
  [key: string]: unknown;
}

// =============================================================================
// Layout Functions
// =============================================================================

/**
 * Get layouted elements using dagre algorithm
 *
 * @param nodes - React Flow nodes array
 * @param edges - React Flow edges array
 * @param options - Layout options
 * @returns Object containing layouted nodes and edges
 */
export const getLayoutedElements = <T extends Node>(
  nodes: T[],
  edges: Edge[],
  options: LayoutOptions = {}
): LayoutResult<T> => {
  const { direction = LAYOUT_DIRECTION.TOP_BOTTOM, nodeSpacing = 80, rankSpacing = 120 } = options;

  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Create a new directed graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure graph layout
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing, // Horizontal spacing between nodes
    ranksep: rankSpacing, // Vertical spacing between ranks
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to the graph with their dimensions
  nodes.forEach((node) => {
    const width = node.width || (node.style?.width as number | undefined) || DEFAULT_NODE_WIDTH;
    const height = node.height || (node.style?.height as number | undefined) || DEFAULT_NODE_HEIGHT;

    dagreGraph.setNode(node.id, {
      width,
      height,
    });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Map the calculated positions back to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.width || (node.style?.width as number | undefined) || DEFAULT_NODE_WIDTH;
    const height = node.height || (node.style?.height as number | undefined) || DEFAULT_NODE_HEIGHT;

    // dagre returns center position, convert to top-left
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return {
    nodes: layoutedNodes,
    edges,
  };
};

/**
 * Apply layout to nodes with animation support
 * Returns nodes with target positions for animated transitions
 *
 * @param nodes - Current nodes
 * @param edges - Current edges
 * @param options - Layout options
 * @returns Nodes containing both current and target positions
 */
export const getLayoutWithTransition = <T extends Node>(
  nodes: T[],
  edges: Edge[],
  options: LayoutOptions = {}
): T[] => {
  const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, options);

  return layoutedNodes.map((layoutedNode) => {
    const originalNode = nodes.find((n) => n.id === layoutedNode.id);
    return {
      ...layoutedNode,
      // Store original position for animation
      data: {
        ...(layoutedNode.data as Record<string, unknown>),
        _layoutFromPosition: originalNode?.position,
        _layoutToPosition: layoutedNode.position,
      } as LayoutTransitionData,
    };
  });
};

/**
 * Calculate the bounding box of all nodes
 * Useful for fitting view after layout
 *
 * @param nodes - Nodes array
 * @returns Bounding box { x, y, width, height }
 */
export const getNodesBounds = (nodes: Node[]): BoundingBox => {
  if (!nodes || nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const width = node.width || (node.style?.width as number | undefined) || DEFAULT_NODE_WIDTH;
    const height = node.height || (node.style?.height as number | undefined) || DEFAULT_NODE_HEIGHT;
    const x = node.position?.x || 0;
    const y = node.position?.y || 0;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

// =============================================================================
// Default Export
// =============================================================================

export default {
  getLayoutedElements,
  getLayoutWithTransition,
  getNodesBounds,
  LAYOUT_DIRECTION,
};
