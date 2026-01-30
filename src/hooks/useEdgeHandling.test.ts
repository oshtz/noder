import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEdgeHandling } from './useEdgeHandling';
import type { Node, Edge, Connection } from 'reactflow';
import type { ThemeColors } from '../constants/themes';

// Mock the handleTypes module
vi.mock('../constants/handleTypes', () => ({
  areTypesCompatible: vi.fn((source, target) => {
    // Default: same types are compatible, text is compatible with any
    if (source === target) return true;
    if (source === 'text' || target === 'text') return true;
    return false;
  }),
  getHandleColor: vi.fn((type) => {
    const colors: Record<string, string> = {
      text: '#ffffff',
      image: '#ff0000',
      video: '#00ff00',
      audio: '#0000ff',
    };
    return colors[type] || '#ffffff';
  }),
}));

describe('useEdgeHandling', () => {
  let setEdges: ReturnType<typeof vi.fn>;
  let edgesRef: { current: Edge[] };
  let nodesRef: { current: Node[] };
  const currentTheme = 'dark';
  const themes: Record<string, ThemeColors> = {
    dark: {
      '--text-color': '#ffffff',
      '--background-color': '#1a1a1a',
      '--node-background': '#2d2d2d',
      '--node-border': '#404040',
      '--node-text': '#ffffff',
      '--accent-color': '#3b82f6',
      '--handle-color': '#ffffff',
      '--edge-color': '#ffffff',
      '--selection-color': '#3b82f6',
      '--error-color': '#ef4444',
      '--success-color': '#10b981',
      '--warning-color': '#f59e0b',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setEdges = vi.fn((updater) => {
      if (typeof updater === 'function') {
        const newEdges = updater(edgesRef.current);
        edgesRef.current = newEdges;
      }
    });
    edgesRef = { current: [] };
    nodesRef = {
      current: [
        { id: 'node-1', position: { x: 0, y: 0 }, data: {}, width: 200, height: 100 },
        { id: 'node-2', position: { x: 300, y: 0 }, data: {}, width: 200, height: 100 },
      ] as Node[],
    };
  });

  describe('onConnect', () => {
    it('should create a new edge on valid connection', () => {
      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        });
      });

      expect(setEdges).toHaveBeenCalled();
      expect(edgesRef.current).toHaveLength(1);
      expect(edgesRef.current[0]).toMatchObject({
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'text-output',
        targetHandle: 'text-input',
        animated: false,
      });
    });

    it('should set edge color based on source handle type', () => {
      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-output',
          targetHandle: 'image-input',
        });
      });

      expect(edgesRef.current[0].style?.stroke).toBe('#ff0000'); // image color from mock
    });

    it('should include node dimensions in edge data', () => {
      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        });
      });

      expect(edgesRef.current[0].data).toMatchObject({
        sourceNodeWidth: 200,
        sourceNodeHeight: 100,
        targetNodeWidth: 200,
        targetNodeHeight: 100,
      });
    });

    it('should create edge regardless of handle types (validation is done by ReactFlow isValidConnection)', () => {
      // Note: Type compatibility is validated by isValidConnection prop in ReactFlow
      // This hook does not perform type validation itself
      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-output',
          targetHandle: 'video-input',
        });
      });

      // Edge is created - validation happens elsewhere
      expect(edgesRef.current).toHaveLength(1);
      expect(edgesRef.current[0].sourceHandle).toBe('image-output');
      expect(edgesRef.current[0].targetHandle).toBe('video-input');
    });

    it('should reject duplicate connections', () => {
      edgesRef.current = [
        {
          id: 'existing-edge',
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        },
      ];

      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        });
      });

      expect(consoleSpy).toHaveBeenCalledWith('This exact connection already exists');
      expect(edgesRef.current).toHaveLength(1);

      consoleSpy.mockRestore();
    });

    it('should allow multiple connections to same target handle', () => {
      edgesRef.current = [
        {
          id: 'existing-edge',
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'text-output-1',
          targetHandle: 'text-input',
        },
      ];

      // Add a third node
      nodesRef.current.push({
        id: 'node-3',
        position: { x: 0, y: 200 },
        data: {},
        width: 200,
        height: 100,
      } as Node);

      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-3',
          target: 'node-2',
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        });
      });

      // Should have 2 edges (original + new)
      expect(edgesRef.current).toHaveLength(2);
    });

    it('should generate unique edge IDs with timestamp', () => {
      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        });
      });

      const edgeId = edgesRef.current[0].id;
      expect(edgeId).toMatch(/^enode-1-node-2-text-input-\d+$/);
    });

    it('should handle nodes without explicit dimensions', () => {
      nodesRef.current = [
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} } as Node,
        { id: 'node-2', position: { x: 300, y: 0 }, data: {} } as Node,
      ];

      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        });
      });

      // Should use default dimensions
      expect(edgesRef.current[0].data).toMatchObject({
        sourceNodeWidth: 200,
        sourceNodeHeight: 200,
        targetNodeWidth: 200,
        targetNodeHeight: 200,
      });
    });

    it('should use theme text color as fallback when no handle type', () => {
      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: null,
          targetHandle: null,
        });
      });

      expect(edgesRef.current[0].style?.stroke).toBe('#ffffff'); // theme text color
    });

    it('should handle connections with undefined source/target handles', () => {
      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: undefined,
          targetHandle: undefined,
        } as Connection);
      });

      // Should create edge (undefined handles = no type validation needed)
      expect(edgesRef.current).toHaveLength(1);
    });

    it('should set edge type to custom', () => {
      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        });
      });

      expect(edgesRef.current[0].type).toBe('custom');
    });

    it('should handle missing source node gracefully', () => {
      nodesRef.current = [
        { id: 'node-2', position: { x: 300, y: 0 }, data: {}, width: 200, height: 100 } as Node,
      ];

      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1', // doesn't exist
          target: 'node-2',
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        });
      });

      // Should still create edge with default dimensions
      expect(edgesRef.current).toHaveLength(1);
      expect(edgesRef.current[0].data?.sourceNodeWidth).toBe(200);
    });

    it('should handle missing target node gracefully', () => {
      nodesRef.current = [
        { id: 'node-1', position: { x: 0, y: 0 }, data: {}, width: 200, height: 100 } as Node,
      ];

      const { result } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2', // doesn't exist
          sourceHandle: 'text-output',
          targetHandle: 'text-input',
        });
      });

      // Should still create edge with default dimensions
      expect(edgesRef.current).toHaveLength(1);
      expect(edgesRef.current[0].data?.targetNodeWidth).toBe(200);
    });
  });

  describe('hook stability', () => {
    it('should return stable onConnect reference', () => {
      const { result, rerender } = renderHook(() =>
        useEdgeHandling(setEdges, edgesRef, nodesRef, currentTheme, themes)
      );

      const firstOnConnect = result.current.onConnect;
      rerender();
      const secondOnConnect = result.current.onConnect;

      expect(firstOnConnect).toBe(secondOnConnect);
    });
  });
});
