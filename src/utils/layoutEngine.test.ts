/**
 * Tests for layoutEngine utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  getLayoutedElements,
  getLayoutWithTransition,
  getNodesBounds,
  LAYOUT_DIRECTION,
} from './layoutEngine';
import type { Node, Edge } from 'reactflow';

// Mock dagre since it's a heavy dependency
vi.mock('@dagrejs/dagre', () => {
  const mockGraph = {
    nodes: new Map<string, { width: number; height: number; x?: number; y?: number }>(),
    edges: [] as { source: string; target: string }[],
    options: {} as Record<string, unknown>,

    setDefaultEdgeLabel: vi.fn(() => ({})),
    setGraph: vi.fn(function (this: typeof mockGraph, opts: Record<string, unknown>) {
      this.options = opts;
    }),
    setNode: vi.fn(function (
      this: typeof mockGraph,
      id: string,
      data: { width: number; height: number }
    ) {
      this.nodes.set(id, { ...data, x: 0, y: 0 });
    }),
    setEdge: vi.fn(function (this: typeof mockGraph, source: string, target: string) {
      this.edges.push({ source, target });
    }),
    node: vi.fn(function (this: typeof mockGraph, id: string) {
      const node = this.nodes.get(id);
      if (!node) return { x: 0, y: 0 };
      // Simulate dagre layout - returns center position
      const idx = Array.from(this.nodes.keys()).indexOf(id);
      return {
        x: 150 + idx * 300, // Spread nodes horizontally
        y: 150 + idx * 100, // And vertically
        width: node.width,
        height: node.height,
      };
    }),
  };

  return {
    default: {
      graphlib: {
        Graph: vi.fn(() => mockGraph),
      },
      layout: vi.fn(() => {
        // Layout is called but the mock graph already handles positioning
      }),
    },
  };
});

describe('layoutEngine', () => {
  describe('LAYOUT_DIRECTION', () => {
    it('has correct direction constants', () => {
      expect(LAYOUT_DIRECTION.TOP_BOTTOM).toBe('TB');
      expect(LAYOUT_DIRECTION.BOTTOM_TOP).toBe('BT');
      expect(LAYOUT_DIRECTION.LEFT_RIGHT).toBe('LR');
      expect(LAYOUT_DIRECTION.RIGHT_LEFT).toBe('RL');
    });
  });

  describe('getLayoutedElements', () => {
    it('returns empty arrays for empty input', () => {
      const result = getLayoutedElements([], []);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('handles null/undefined nodes', () => {
      const result = getLayoutedElements(null as unknown as Node[], []);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('layouts nodes with positions', () => {
      const nodes: Node[] = [
        { id: 'node-1', type: 'image', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }];

      const result = getLayoutedElements(nodes, edges);

      expect(result.nodes.length).toBe(2);
      expect(result.edges.length).toBe(1);

      // Nodes should have positions (mock returns calculated positions)
      result.nodes.forEach((node) => {
        expect(node.position).toBeDefined();
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });
    });

    it('preserves node properties after layout', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: { title: 'My Node', model: 'test' },
          style: { width: 300, height: 200 },
        },
      ];

      const result = getLayoutedElements(nodes, []);

      expect(result.nodes[0].id).toBe('node-1');
      expect(result.nodes[0].type).toBe('image');
      expect(result.nodes[0].data).toEqual({ title: 'My Node', model: 'test' });
    });

    it('passes through edges unchanged', () => {
      const nodes: Node[] = [
        { id: 'a', type: 'image', position: { x: 0, y: 0 }, data: {} },
        { id: 'b', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'a', target: 'b', type: 'custom', animated: true },
      ];

      const result = getLayoutedElements(nodes, edges);

      expect(result.edges).toEqual(edges);
    });

    it('uses default node dimensions when not specified', () => {
      const nodes: Node[] = [{ id: 'node-1', type: 'image', position: { x: 0, y: 0 }, data: {} }];

      // Should not throw - uses default dimensions
      const result = getLayoutedElements(nodes, []);

      expect(result.nodes.length).toBe(1);
    });

    it('uses node.width/height when available', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {},
          width: 400,
          height: 300,
        },
      ];

      const result = getLayoutedElements(nodes, []);

      expect(result.nodes.length).toBe(1);
    });

    it('uses style.width/height as fallback', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {},
          style: { width: 350, height: 250 },
        },
      ];

      const result = getLayoutedElements(nodes, []);

      expect(result.nodes.length).toBe(1);
    });

    it('accepts custom layout options', () => {
      const nodes: Node[] = [
        { id: 'node-1', type: 'image', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ];

      // Should not throw with custom options
      const result = getLayoutedElements(nodes, [], {
        direction: LAYOUT_DIRECTION.LEFT_RIGHT,
        nodeSpacing: 100,
        rankSpacing: 150,
      });

      expect(result.nodes.length).toBe(2);
    });

    it('handles single node', () => {
      const nodes: Node[] = [
        { id: 'only-node', type: 'image', position: { x: 0, y: 0 }, data: {} },
      ];

      const result = getLayoutedElements(nodes, []);

      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].position).toBeDefined();
    });

    it('handles disconnected nodes', () => {
      const nodes: Node[] = [
        { id: 'a', type: 'image', position: { x: 0, y: 0 }, data: {} },
        { id: 'b', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'c', type: 'video', position: { x: 0, y: 0 }, data: {} },
      ];

      // No edges connecting them
      const result = getLayoutedElements(nodes, []);

      expect(result.nodes.length).toBe(3);
    });

    it('handles complex graph with multiple edges', () => {
      const nodes: Node[] = [
        { id: 'a', type: 'image', position: { x: 0, y: 0 }, data: {} },
        { id: 'b', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'c', type: 'video', position: { x: 0, y: 0 }, data: {} },
        { id: 'd', type: 'audio', position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
        { id: 'e3', source: 'b', target: 'd' },
        { id: 'e4', source: 'c', target: 'd' },
      ];

      const result = getLayoutedElements(nodes, edges);

      expect(result.nodes.length).toBe(4);
      expect(result.edges.length).toBe(4);
    });
  });

  describe('getLayoutWithTransition', () => {
    it('returns nodes with transition data', () => {
      const nodes: Node[] = [
        { id: 'node-1', type: 'image', position: { x: 50, y: 100 }, data: {} },
      ];

      const result = getLayoutWithTransition(nodes, []);

      expect(result.length).toBe(1);
      expect(result[0].data._layoutFromPosition).toEqual({ x: 50, y: 100 });
      expect(result[0].data._layoutToPosition).toBeDefined();
    });

    it('preserves original node data', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: { title: 'Test', model: 'flux' },
        },
      ];

      const result = getLayoutWithTransition(nodes, []);

      expect(result[0].data.title).toBe('Test');
      expect(result[0].data.model).toBe('flux');
    });

    it('handles multiple nodes', () => {
      const nodes: Node[] = [
        { id: 'a', type: 'image', position: { x: 10, y: 20 }, data: {} },
        { id: 'b', type: 'text', position: { x: 30, y: 40 }, data: {} },
      ];

      const result = getLayoutWithTransition(nodes, []);

      expect(result.length).toBe(2);
      expect(result[0].data._layoutFromPosition).toEqual({ x: 10, y: 20 });
      expect(result[1].data._layoutFromPosition).toEqual({ x: 30, y: 40 });
    });

    it('accepts layout options', () => {
      const nodes: Node[] = [{ id: 'node-1', type: 'image', position: { x: 0, y: 0 }, data: {} }];

      const result = getLayoutWithTransition(nodes, [], {
        direction: LAYOUT_DIRECTION.LEFT_RIGHT,
      });

      expect(result.length).toBe(1);
    });
  });

  describe('getNodesBounds', () => {
    it('returns zero bounds for empty input', () => {
      const result = getNodesBounds([]);

      expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('returns zero bounds for null/undefined', () => {
      const result = getNodesBounds(null as unknown as Node[]);

      expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('calculates bounds for single node', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 100, y: 200 },
          data: {},
          width: 300,
          height: 150,
        },
      ];

      const result = getNodesBounds(nodes);

      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
      expect(result.width).toBe(300);
      expect(result.height).toBe(150);
    });

    it('calculates bounds for multiple nodes', () => {
      const nodes: Node[] = [
        { id: 'a', type: 'image', position: { x: 0, y: 0 }, data: {}, width: 100, height: 100 },
        {
          id: 'b',
          type: 'text',
          position: { x: 200, y: 300 },
          data: {},
          width: 100,
          height: 100,
        },
      ];

      const result = getNodesBounds(nodes);

      expect(result.x).toBe(0); // Min x
      expect(result.y).toBe(0); // Min y
      expect(result.width).toBe(300); // 200 + 100 - 0
      expect(result.height).toBe(400); // 300 + 100 - 0
    });

    it('uses style dimensions as fallback', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 50, y: 50 },
          data: {},
          style: { width: 200, height: 150 },
        },
      ];

      const result = getNodesBounds(nodes);

      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });

    it('uses default dimensions when none specified', () => {
      const nodes: Node[] = [{ id: 'node-1', type: 'image', position: { x: 0, y: 0 }, data: {} }];

      const result = getNodesBounds(nodes);

      // Default dimensions are 280x200
      expect(result.width).toBe(280);
      expect(result.height).toBe(200);
    });

    it('handles nodes with negative positions', () => {
      const nodes: Node[] = [
        {
          id: 'a',
          type: 'image',
          position: { x: -100, y: -50 },
          data: {},
          width: 100,
          height: 100,
        },
        { id: 'b', type: 'text', position: { x: 50, y: 50 }, data: {}, width: 100, height: 100 },
      ];

      const result = getNodesBounds(nodes);

      expect(result.x).toBe(-100);
      expect(result.y).toBe(-50);
      expect(result.width).toBe(250); // 50 + 100 - (-100)
      expect(result.height).toBe(200); // 50 + 100 - (-50)
    });

    it('handles nodes without position (defaults to 0,0)', () => {
      const nodes: Node[] = [
        { id: 'node-1', type: 'image', data: {}, width: 100, height: 100 } as Node,
      ];

      const result = getNodesBounds(nodes);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('calculates correct bounds for overlapping nodes', () => {
      const nodes: Node[] = [
        { id: 'a', type: 'image', position: { x: 0, y: 0 }, data: {}, width: 200, height: 200 },
        { id: 'b', type: 'text', position: { x: 50, y: 50 }, data: {}, width: 200, height: 200 },
      ];

      const result = getNodesBounds(nodes);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBe(250); // max(200, 50+200) = 250
      expect(result.height).toBe(250);
    });
  });
});
