import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useNodeHandling from './useNodeHandling';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from 'reactflow';

// Mock reactflow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    applyNodeChanges: vi.fn((changes, nodes) => {
      // Simple mock implementation
      let result = [...nodes];
      for (const change of changes) {
        if (change.type === 'remove') {
          result = result.filter((n) => n.id !== change.id);
        } else if (change.type === 'position' && change.position) {
          result = result.map((n) =>
            n.id === change.id ? { ...n, position: change.position } : n
          );
        } else if (change.type === 'dimensions' && change.dimensions) {
          result = result.map((n) =>
            n.id === change.id
              ? { ...n, width: change.dimensions!.width, height: change.dimensions!.height }
              : n
          );
        } else if (change.type === 'select') {
          result = result.map((n) =>
            n.id === change.id ? { ...n, selected: change.selected } : n
          );
        }
      }
      return result;
    }),
    applyEdgeChanges: vi.fn((changes, edges) => {
      // Simple mock implementation
      let result = [...edges];
      for (const change of changes) {
        if (change.type === 'remove') {
          result = result.filter((e) => e.id !== change.id);
        } else if (change.type === 'select') {
          result = result.map((e) =>
            e.id === change.id ? { ...e, selected: change.selected } : e
          );
        }
      }
      return result;
    }),
  };
});

describe('useNodeHandling', () => {
  let setNodes: ReturnType<typeof vi.fn>;
  let setEdges: ReturnType<typeof vi.fn>;
  let currentNodes: Node[];
  let currentEdges: Edge[];

  beforeEach(() => {
    vi.clearAllMocks();

    currentNodes = [
      { id: 'node-1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
      { id: 'node-2', position: { x: 200, y: 0 }, data: { label: 'Node 2' } },
    ] as Node[];

    currentEdges = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }] as Edge[];

    setNodes = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentNodes = updater(currentNodes);
      } else {
        currentNodes = updater;
      }
    });

    setEdges = vi.fn((updater) => {
      if (typeof updater === 'function') {
        currentEdges = updater(currentEdges);
      } else {
        currentEdges = updater;
      }
    });
  });

  describe('handleNodesChange', () => {
    it('should apply node position changes', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleNodesChange([
          { type: 'position', id: 'node-1', position: { x: 100, y: 100 } },
        ] as NodeChange[]);
      });

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes[0].position).toEqual({ x: 100, y: 100 });
    });

    it('should apply node removal changes', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleNodesChange([{ type: 'remove', id: 'node-1' }] as NodeChange[]);
      });

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes).toHaveLength(1);
      expect(currentNodes[0].id).toBe('node-2');
    });

    it('should apply node selection changes', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleNodesChange([
          { type: 'select', id: 'node-1', selected: true },
        ] as NodeChange[]);
      });

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes[0].selected).toBe(true);
    });

    it('should apply node dimension changes', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleNodesChange([
          { type: 'dimensions', id: 'node-1', dimensions: { width: 300, height: 200 } },
        ] as NodeChange[]);
      });

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes[0].width).toBe(300);
      expect(currentNodes[0].height).toBe(200);
    });

    it('should apply multiple changes at once', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleNodesChange([
          { type: 'position', id: 'node-1', position: { x: 50, y: 50 } },
          { type: 'select', id: 'node-2', selected: true },
        ] as NodeChange[]);
      });

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes[0].position).toEqual({ x: 50, y: 50 });
      expect(currentNodes[1].selected).toBe(true);
    });
  });

  describe('handleEdgesChange', () => {
    it('should apply edge removal changes', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleEdgesChange([{ type: 'remove', id: 'edge-1' }] as EdgeChange[]);
      });

      expect(setEdges).toHaveBeenCalled();
      expect(currentEdges).toHaveLength(0);
    });

    it('should apply edge selection changes', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleEdgesChange([
          { type: 'select', id: 'edge-1', selected: true },
        ] as EdgeChange[]);
      });

      expect(setEdges).toHaveBeenCalled();
      expect(currentEdges[0].selected).toBe(true);
    });

    it('should apply multiple edge changes at once', () => {
      currentEdges = [
        { id: 'edge-1', source: 'node-1', target: 'node-2' },
        { id: 'edge-2', source: 'node-2', target: 'node-3' },
      ] as Edge[];

      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleEdgesChange([
          { type: 'select', id: 'edge-1', selected: true },
          { type: 'remove', id: 'edge-2' },
        ] as EdgeChange[]);
      });

      expect(setEdges).toHaveBeenCalled();
      expect(currentEdges).toHaveLength(1);
      expect(currentEdges[0].selected).toBe(true);
    });
  });

  describe('handleConnect', () => {
    it('should create a new edge from connection params', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input',
        });
      });

      expect(setEdges).toHaveBeenCalled();
      expect(currentEdges).toHaveLength(2);

      const newEdge = currentEdges[1];
      expect(newEdge.source).toBe('node-1');
      expect(newEdge.target).toBe('node-2');
      expect(newEdge.sourceHandle).toBe('output');
      expect(newEdge.targetHandle).toBe('input');
    });

    it('should set edge type to custom', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input',
        });
      });

      const newEdge = currentEdges[1];
      expect(newEdge.type).toBe('custom');
    });

    it('should set edge as animated', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input',
        });
      });

      const newEdge = currentEdges[1];
      expect(newEdge.animated).toBe(true);
    });

    it('should generate unique edge ID with timestamp', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input',
        });
      });

      const newEdge = currentEdges[1];
      expect(newEdge.id).toMatch(/^enode-1-node-2-\d+$/);
    });

    it('should handle null source gracefully', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleConnect({
          source: null,
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input',
        } as Connection);
      });

      const newEdge = currentEdges[1];
      expect(newEdge.source).toBe('');
    });

    it('should handle null target gracefully', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleConnect({
          source: 'node-1',
          target: null,
          sourceHandle: 'output',
          targetHandle: 'input',
        } as Connection);
      });

      const newEdge = currentEdges[1];
      expect(newEdge.target).toBe('');
    });

    it('should concatenate new edge to existing edges', () => {
      currentEdges = [
        { id: 'edge-1', source: 'node-1', target: 'node-2' },
        { id: 'edge-2', source: 'node-2', target: 'node-3' },
      ] as Edge[];

      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      act(() => {
        result.current.handleConnect({
          source: 'node-3',
          target: 'node-1',
          sourceHandle: null,
          targetHandle: null,
        });
      });

      expect(currentEdges).toHaveLength(3);
    });
  });

  describe('hook stability', () => {
    it('should return stable handleNodesChange reference', () => {
      const { result, rerender } = renderHook(() => useNodeHandling(setNodes, setEdges));

      const first = result.current.handleNodesChange;
      rerender();
      const second = result.current.handleNodesChange;

      expect(first).toBe(second);
    });

    it('should return stable handleEdgesChange reference', () => {
      const { result, rerender } = renderHook(() => useNodeHandling(setNodes, setEdges));

      const first = result.current.handleEdgesChange;
      rerender();
      const second = result.current.handleEdgesChange;

      expect(first).toBe(second);
    });

    it('should return stable handleConnect reference', () => {
      const { result, rerender } = renderHook(() => useNodeHandling(setNodes, setEdges));

      const first = result.current.handleConnect;
      rerender();
      const second = result.current.handleConnect;

      expect(first).toBe(second);
    });
  });

  describe('return value', () => {
    it('should return all three handlers', () => {
      const { result } = renderHook(() => useNodeHandling(setNodes, setEdges));

      expect(result.current).toHaveProperty('handleNodesChange');
      expect(result.current).toHaveProperty('handleEdgesChange');
      expect(result.current).toHaveProperty('handleConnect');
      expect(typeof result.current.handleNodesChange).toBe('function');
      expect(typeof result.current.handleEdgesChange).toBe('function');
      expect(typeof result.current.handleConnect).toBe('function');
    });
  });
});
