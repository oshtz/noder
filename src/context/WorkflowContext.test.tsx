import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import {
  WorkflowProvider,
  useWorkflow,
  useNodesRef,
  useEdgesRef,
  setGlobalWorkflowRefs,
  getGlobalNodesRef,
  getGlobalEdgesRef,
} from './WorkflowContext';
import type { Node, Edge } from 'reactflow';

describe('WorkflowContext', () => {
  const mockNodes: Node[] = [
    { id: 'node-1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: 'node-2', position: { x: 200, y: 0 }, data: { label: 'Node 2' } },
  ];

  const mockEdges: Edge[] = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }];

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WorkflowProvider nodes={mockNodes} edges={mockEdges}>
      {children}
    </WorkflowProvider>
  );

  describe('WorkflowProvider', () => {
    it('should provide nodes to children', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(result.current.nodes).toEqual(mockNodes);
    });

    it('should provide edges to children', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(result.current.edges).toEqual(mockEdges);
    });

    it('should provide nodesRef that contains current nodes', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(result.current.nodesRef.current).toEqual(mockNodes);
    });

    it('should provide edgesRef that contains current edges', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(result.current.edgesRef.current).toEqual(mockEdges);
    });

    it('should provide getNodes function', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(typeof result.current.getNodes).toBe('function');
      expect(result.current.getNodes()).toEqual(mockNodes);
    });

    it('should provide getEdges function', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(typeof result.current.getEdges).toBe('function');
      expect(result.current.getEdges()).toEqual(mockEdges);
    });

    it('should update refs when nodes change', () => {
      const updatedNodes: Node[] = [
        { id: 'node-3', position: { x: 400, y: 0 }, data: { label: 'Node 3' } },
      ];

      const { result, _rerender } = renderHook(() => useWorkflow(), {
        wrapper: ({ children }) => (
          <WorkflowProvider nodes={updatedNodes} edges={mockEdges}>
            {children}
          </WorkflowProvider>
        ),
      });

      expect(result.current.nodesRef.current).toEqual(updatedNodes);
    });

    it('should update refs when edges change', () => {
      const updatedEdges: Edge[] = [{ id: 'edge-2', source: 'node-2', target: 'node-3' }];

      const { result } = renderHook(() => useWorkflow(), {
        wrapper: ({ children }) => (
          <WorkflowProvider nodes={mockNodes} edges={updatedEdges}>
            {children}
          </WorkflowProvider>
        ),
      });

      expect(result.current.edgesRef.current).toEqual(updatedEdges);
    });

    it('should handle empty nodes array', () => {
      const { result } = renderHook(() => useWorkflow(), {
        wrapper: ({ children }) => (
          <WorkflowProvider nodes={[]} edges={mockEdges}>
            {children}
          </WorkflowProvider>
        ),
      });

      expect(result.current.nodes).toEqual([]);
      expect(result.current.getNodes()).toEqual([]);
    });

    it('should handle empty edges array', () => {
      const { result } = renderHook(() => useWorkflow(), {
        wrapper: ({ children }) => (
          <WorkflowProvider nodes={mockNodes} edges={[]}>
            {children}
          </WorkflowProvider>
        ),
      });

      expect(result.current.edges).toEqual([]);
      expect(result.current.getEdges()).toEqual([]);
    });
  });

  describe('useWorkflow', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWorkflow());
      }).toThrow('useWorkflow must be used within a WorkflowProvider');

      consoleSpy.mockRestore();
    });

    it('should return context value when inside provider', () => {
      const { result } = renderHook(() => useWorkflow(), { wrapper });

      expect(result.current).toHaveProperty('nodes');
      expect(result.current).toHaveProperty('edges');
      expect(result.current).toHaveProperty('nodesRef');
      expect(result.current).toHaveProperty('edgesRef');
      expect(result.current).toHaveProperty('getNodes');
      expect(result.current).toHaveProperty('getEdges');
    });
  });

  describe('useNodesRef', () => {
    it('should return nodesRef from context', () => {
      const { result } = renderHook(() => useNodesRef(), { wrapper });

      expect(result.current.current).toEqual(mockNodes);
    });

    it('should throw when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useNodesRef());
      }).toThrow('useWorkflow must be used within a WorkflowProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('useEdgesRef', () => {
    it('should return edgesRef from context', () => {
      const { result } = renderHook(() => useEdgesRef(), { wrapper });

      expect(result.current.current).toEqual(mockEdges);
    });

    it('should throw when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useEdgesRef());
      }).toThrow('useWorkflow must be used within a WorkflowProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Global refs', () => {
    beforeEach(() => {
      // Reset global refs
      setGlobalWorkflowRefs({ current: [] }, { current: [] });
    });

    it('should set and get global nodes ref', () => {
      const nodesRef = { current: mockNodes };
      const edgesRef = { current: mockEdges };

      setGlobalWorkflowRefs(nodesRef, edgesRef);

      expect(getGlobalNodesRef().current).toEqual(mockNodes);
    });

    it('should set and get global edges ref', () => {
      const nodesRef = { current: mockNodes };
      const edgesRef = { current: mockEdges };

      setGlobalWorkflowRefs(nodesRef, edgesRef);

      expect(getGlobalEdgesRef().current).toEqual(mockEdges);
    });

    it('should return empty arrays by default', () => {
      // Reset to default state
      setGlobalWorkflowRefs({ current: [] }, { current: [] });

      expect(getGlobalNodesRef().current).toEqual([]);
      expect(getGlobalEdgesRef().current).toEqual([]);
    });

    it('should update when setGlobalWorkflowRefs is called multiple times', () => {
      const firstNodes: Node[] = [{ id: 'first', position: { x: 0, y: 0 }, data: {} }];
      const secondNodes: Node[] = [{ id: 'second', position: { x: 100, y: 100 }, data: {} }];

      setGlobalWorkflowRefs({ current: firstNodes }, { current: [] });
      expect(getGlobalNodesRef().current).toEqual(firstNodes);

      setGlobalWorkflowRefs({ current: secondNodes }, { current: [] });
      expect(getGlobalNodesRef().current).toEqual(secondNodes);
    });
  });

  describe('getNodes and getEdges stability', () => {
    it('should return same getNodes function reference', () => {
      const { result, rerender } = renderHook(() => useWorkflow(), { wrapper });

      const first = result.current.getNodes;
      rerender();
      const second = result.current.getNodes;

      expect(first).toBe(second);
    });

    it('should return same getEdges function reference', () => {
      const { result, rerender } = renderHook(() => useWorkflow(), { wrapper });

      const first = result.current.getEdges;
      rerender();
      const second = result.current.getEdges;

      expect(first).toBe(second);
    });
  });
});
