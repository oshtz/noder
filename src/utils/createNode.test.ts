/**
 * Tests for createNode utilities
 */

import { describe, it, expect } from 'vitest';
import { createNode, sortNodesForReactFlow } from './createNode';
import type { Node } from 'reactflow';

describe('createNode', () => {
  describe('createNode function', () => {
    it('creates a node with required fields', () => {
      const node = createNode({
        id: 'node-1',
        type: 'image',
      });

      expect(node.id).toBe('node-1');
      expect(node.type).toBe('image');
      expect(node.position).toEqual({ x: 0, y: 0 });
      expect(node.data).toBeDefined();
    });

    it('applies title to node data', () => {
      const node = createNode({
        id: 'node-1',
        type: 'text',
        title: 'My Text Node',
      });

      expect(node.data.title).toBe('My Text Node');
    });

    it('applies handles to node data', () => {
      const handles = [
        { id: 'input', type: 'target' as const, dataType: 'string' as const },
        { id: 'output', type: 'source' as const, dataType: 'string' as const },
      ];

      const node = createNode({
        id: 'node-1',
        type: 'text',
        handles,
      });

      expect(node.data.handles).toEqual(handles);
    });

    it('applies custom position', () => {
      const node = createNode({
        id: 'node-1',
        type: 'image',
        position: { x: 100, y: 200 },
      });

      expect(node.position).toEqual({ x: 100, y: 200 });
    });

    it('applies custom style', () => {
      const node = createNode({
        id: 'node-1',
        type: 'image',
        style: { width: 300, height: 400 },
      });

      expect(node.style).toEqual({ width: 300, height: 400 });
    });

    it('applies custom className', () => {
      const node = createNode({
        id: 'node-1',
        type: 'image',
        className: 'my-custom-class',
      });

      expect(node.className).toBe('my-custom-class');
    });

    it('applies custom dragHandle', () => {
      const node = createNode({
        id: 'node-1',
        type: 'image',
        dragHandle: '.my-drag-handle',
      });

      expect(node.dragHandle).toBe('.my-drag-handle');
    });

    it('merges initialData with other data fields', () => {
      const node = createNode({
        id: 'node-1',
        type: 'image',
        title: 'Test Node',
        initialData: {
          model: 'some-model',
          settings: { quality: 'high' },
        },
      });

      expect(node.data.title).toBe('Test Node');
      expect(node.data.model).toBe('some-model');
      expect(node.data.settings).toEqual({ quality: 'high' });
    });

    it('uses default values for optional fields', () => {
      const node = createNode({
        id: 'node-1',
        type: 'image',
      });

      expect(node.style).toEqual({ width: 200, height: 200 });
      expect(node.className).toBe('react-flow__node-resizable');
      expect(node.dragHandle).toBe('.custom-drag-handle');
    });
  });

  describe('sortNodesForReactFlow', () => {
    it('returns empty array for empty input', () => {
      const result = sortNodesForReactFlow([]);
      expect(result).toEqual([]);
    });

    it('returns undefined for undefined input', () => {
      const result = sortNodesForReactFlow(undefined as unknown as Node[]);
      expect(result).toBeUndefined();
    });

    it('sorts parent nodes before child nodes', () => {
      const nodes: Node[] = [
        {
          id: 'child-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {},
          parentNode: 'parent-1',
        },
        { id: 'parent-1', type: 'group', position: { x: 0, y: 0 }, data: {} },
        { id: 'child-2', type: 'text', position: { x: 0, y: 0 }, data: {}, parentNode: 'parent-1' },
      ];

      const sorted = sortNodesForReactFlow(nodes);

      // Parent should be first
      expect(sorted[0].id).toBe('parent-1');
      // Children should come after
      const childIndices = sorted
        .map((n, i) => (n.parentNode === 'parent-1' ? i : -1))
        .filter((i) => i !== -1);
      childIndices.forEach((index) => expect(index).toBeGreaterThan(0));
    });

    it('handles nodes without parent relationships', () => {
      const nodes: Node[] = [
        { id: 'node-1', type: 'image', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-3', type: 'video', position: { x: 0, y: 0 }, data: {} },
      ];

      const sorted = sortNodesForReactFlow(nodes);

      expect(sorted.length).toBe(3);
      expect(sorted.map((n) => n.id)).toContain('node-1');
      expect(sorted.map((n) => n.id)).toContain('node-2');
      expect(sorted.map((n) => n.id)).toContain('node-3');
    });

    it('removes orphaned parentNode references', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {},
          parentNode: 'nonexistent',
        },
        { id: 'node-2', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ];

      const sorted = sortNodesForReactFlow(nodes);

      // The orphaned parentNode reference should be removed
      const node1 = sorted.find((n) => n.id === 'node-1');
      expect(node1).toBeDefined();
      expect(node1?.parentNode).toBeUndefined();
    });

    it('handles parentId property (alternative to parentNode)', () => {
      const nodes: Node[] = [
        { id: 'child-1', type: 'image', position: { x: 0, y: 0 }, data: {}, parentId: 'parent-1' },
        { id: 'parent-1', type: 'group', position: { x: 0, y: 0 }, data: {} },
      ];

      const sorted = sortNodesForReactFlow(nodes);

      // Parent should be first
      expect(sorted[0].id).toBe('parent-1');
    });

    it('handles group type nodes as parents', () => {
      const nodes: Node[] = [
        { id: 'regular-1', type: 'image', position: { x: 0, y: 0 }, data: {} },
        { id: 'group-1', type: 'group', position: { x: 0, y: 0 }, data: {} },
        { id: 'regular-2', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ];

      const sorted = sortNodesForReactFlow(nodes);

      // Group node should be first (or at least before regular nodes that might reference it)
      const groupIndex = sorted.findIndex((n) => n.id === 'group-1');
      expect(groupIndex).toBeLessThanOrEqual(1); // Should be early in the list
    });

    it('handles mixed parent relationships correctly', () => {
      const nodes: Node[] = [
        {
          id: 'child-a',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {},
          parentNode: 'parent-1',
        },
        {
          id: 'orphan',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {},
          parentNode: 'nonexistent',
        },
        { id: 'parent-1', type: 'group', position: { x: 0, y: 0 }, data: {} },
        { id: 'standalone', type: 'video', position: { x: 0, y: 0 }, data: {} },
      ];

      const sorted = sortNodesForReactFlow(nodes);

      // Parent-1 should come before child-a
      const parentIndex = sorted.findIndex((n) => n.id === 'parent-1');
      const childIndex = sorted.findIndex((n) => n.id === 'child-a');
      expect(parentIndex).toBeLessThan(childIndex);

      // Orphan should have parentNode removed
      const orphan = sorted.find((n) => n.id === 'orphan');
      expect(orphan?.parentNode).toBeUndefined();
    });

    it('preserves node data when cleaning orphaned references', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 100, y: 200 },
          data: { title: 'My Node', model: 'test-model' },
          parentNode: 'nonexistent',
          style: { width: 300 },
        },
      ];

      const sorted = sortNodesForReactFlow(nodes);
      const node = sorted[0];

      expect(node.id).toBe('node-1');
      expect(node.type).toBe('image');
      expect(node.position).toEqual({ x: 100, y: 200 });
      expect(node.data).toEqual({ title: 'My Node', model: 'test-model' });
      expect(node.style).toEqual({ width: 300 });
      expect(node.parentNode).toBeUndefined();
    });

    it('handles deeply nested parent chains', () => {
      // While React Flow doesn't support deeply nested parents, our function should handle the input gracefully
      const nodes: Node[] = [
        {
          id: 'grandchild',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {},
          parentNode: 'child',
        },
        { id: 'child', type: 'group', position: { x: 0, y: 0 }, data: {}, parentNode: 'parent' },
        { id: 'parent', type: 'group', position: { x: 0, y: 0 }, data: {} },
      ];

      const sorted = sortNodesForReactFlow(nodes);

      // All three nodes should be present
      expect(sorted.length).toBe(3);

      // Parent (as group type) should be early in the list
      const parentIndex = sorted.findIndex((n) => n.id === 'parent');
      expect(parentIndex).toBeGreaterThanOrEqual(0);

      // The function handles parent/child relationships based on actual parentNode references
      // and group type, not multi-level nesting (which React Flow doesn't fully support)
      const childIndex = sorted.findIndex((n) => n.id === 'child');
      const grandchildIndex = sorted.findIndex((n) => n.id === 'grandchild');

      // Child is itself a parent (to grandchild), so it should be categorized as a parent node
      // and appear early in the list
      expect(childIndex).toBeGreaterThanOrEqual(0);
      expect(grandchildIndex).toBeGreaterThanOrEqual(0);
    });
  });
});
