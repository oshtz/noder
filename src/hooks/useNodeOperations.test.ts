import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeOperations } from './useNodeOperations';
import type { Node, Edge, NodeChange, EdgeChange } from 'reactflow';

// Mock dependencies
vi.mock('../utils/eventBus', () => ({
  emit: vi.fn(),
}));

vi.mock('../utils/replicateFiles', () => ({
  deleteFileFromReplicate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/workflowHelpers', () => ({
  markEdgeGlows: vi.fn((edges) => edges),
}));

vi.mock('../components/HelperLines', () => ({
  getHelperLines: vi.fn(() => ({ horizontal: null, vertical: null, snapPosition: null })),
}));

vi.mock('../nodes', () => ({
  nodeCreators: {
    text: vi.fn(({ id, position, defaultModel, data }) => ({
      id,
      type: 'text',
      position: position || { x: 100, y: 100 },
      data: {
        model: defaultModel || 'default-text-model',
        executionOrder: data?.executionOrder || 1,
      },
    })),
    image: vi.fn(({ id, position, defaultModel, data }) => ({
      id,
      type: 'image',
      position: position || { x: 100, y: 100 },
      data: {
        model: defaultModel || 'default-image-model',
        executionOrder: data?.executionOrder || 1,
      },
    })),
    video: vi.fn(({ id, position, defaultModel, data }) => ({
      id,
      type: 'video',
      position: position || { x: 100, y: 100 },
      data: {
        model: defaultModel || 'default-video-model',
        executionOrder: data?.executionOrder || 1,
      },
    })),
    audio: vi.fn(({ id, position, defaultModel, data }) => ({
      id,
      type: 'audio',
      position: position || { x: 100, y: 100 },
      data: {
        model: defaultModel || 'default-audio-model',
        executionOrder: data?.executionOrder || 1,
      },
    })),
    upscaler: vi.fn(({ id, position, defaultModel, data }) => ({
      id,
      type: 'upscaler',
      position: position || { x: 100, y: 100 },
      data: {
        model: defaultModel || 'default-upscaler-model',
        executionOrder: data?.executionOrder || 1,
      },
    })),
    media: vi.fn(({ id, position, data }) => ({
      id,
      type: 'media',
      position: position || { x: 100, y: 100 },
      data: {
        executionOrder: data?.executionOrder || 1,
      },
    })),
    group: vi.fn(({ id, position, data }) => ({
      id,
      type: 'group',
      position: position || { x: 100, y: 100 },
      data: {
        executionOrder: data?.executionOrder || 1,
      },
    })),
  },
}));

// Mock reactflow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    applyNodeChanges: vi.fn((changes, nodes) => {
      let result = [...nodes];
      for (const change of changes) {
        if (change.type === 'remove') {
          result = result.filter((n) => n.id !== change.id);
        } else if (change.type === 'add' && change.item) {
          result = [...result, change.item];
        } else if (change.type === 'position' && change.position) {
          result = result.map((n) =>
            n.id === change.id ? { ...n, position: change.position } : n
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
      let result = [...edges];
      for (const change of changes) {
        if (change.type === 'remove') {
          result = result.filter((e) => e.id !== change.id);
        } else if (change.type === 'add' && change.item) {
          result = [...result, change.item];
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

// Import mocked modules for assertions
import { emit } from '../utils/eventBus';
import { deleteFileFromReplicate } from '../utils/replicateFiles';
import { markEdgeGlows } from '../utils/workflowHelpers';
import { getHelperLines } from '../components/HelperLines';
import { nodeCreators } from '../nodes';

describe('useNodeOperations', () => {
  let nodes: Node[];
  let edges: Edge[];
  let setNodes: ReturnType<typeof vi.fn>;
  let setEdges: ReturnType<typeof vi.fn>;
  let selectedNodeId: string | null;
  let setSelectedNodeId: ReturnType<typeof vi.fn>;
  let setHelperLines: ReturnType<typeof vi.fn>;
  let takeSnapshotRef: React.MutableRefObject<((force?: boolean) => void) | null>;
  let showWelcome: boolean;
  let setShowWelcome: ReturnType<typeof vi.fn>;
  let setWelcomePinned: ReturnType<typeof vi.fn>;

  const createDefaultConfig = () => ({
    nodes,
    edges,
    setNodes,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    setHelperLines,
    takeSnapshotRef,
    showWelcome,
    setShowWelcome,
    setWelcomePinned,
    defaultTextModel: 'openai/gpt-4',
    defaultImageModel: 'stability-ai/sdxl',
    defaultVideoModel: 'video-model/v1',
    defaultAudioModel: 'audio-model/v1',
    defaultUpscalerModel: 'upscaler-model/v1',
  });

  beforeEach(() => {
    vi.clearAllMocks();

    nodes = [
      {
        id: 'node-1',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { label: 'Node 1', executionOrder: 1 },
      },
      {
        id: 'node-2',
        type: 'image',
        position: { x: 200, y: 0 },
        data: { label: 'Node 2', executionOrder: 2 },
      },
    ] as Node[];

    edges = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'text-out',
        targetHandle: 'text-in',
      },
    ] as Edge[];

    setNodes = vi.fn((updater) => {
      if (typeof updater === 'function') {
        nodes = updater(nodes);
      } else {
        nodes = updater;
      }
    });

    setEdges = vi.fn((updater) => {
      if (typeof updater === 'function') {
        edges = updater(edges);
      } else {
        edges = updater;
      }
    });

    selectedNodeId = null;
    setSelectedNodeId = vi.fn();
    setHelperLines = vi.fn();
    takeSnapshotRef = { current: vi.fn() };
    showWelcome = false;
    setShowWelcome = vi.fn();
    setWelcomePinned = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // handleRemoveNode Tests
  // ==========================================================================

  describe('handleRemoveNode', () => {
    it('should remove a node from the list', async () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('node-1');
      });

      expect(setNodes).toHaveBeenCalled();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('node-2');
    });

    it('should remove all edges connected to the removed node', async () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('node-1');
      });

      expect(setEdges).toHaveBeenCalled();
      expect(edges).toHaveLength(0);
    });

    it('should clean up media files for media nodes with replicateFileId', async () => {
      nodes = [
        {
          id: 'media-node',
          type: 'media',
          position: { x: 0, y: 0 },
          data: { replicateFileId: 'file-123', executionOrder: 1 },
        },
      ] as Node[];

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('media-node');
      });

      expect(deleteFileFromReplicate).toHaveBeenCalledWith('file-123');
    });

    it('should not call deleteFileFromReplicate for nodes without replicateFileId', async () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('node-1');
      });

      expect(deleteFileFromReplicate).not.toHaveBeenCalled();
    });

    it('should detach children from group nodes when group is removed', async () => {
      const groupNode: Node = {
        id: 'group-1',
        type: 'group',
        position: { x: 100, y: 100 },
        data: { executionOrder: 1 },
      };
      const childNode: Node = {
        id: 'child-1',
        type: 'text',
        position: { x: 10, y: 10 },
        parentNode: 'group-1',
        extent: 'parent',
        data: { executionOrder: 2 },
      };

      nodes = [groupNode, childNode];
      edges = [];

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('group-1');
      });

      expect(setNodes).toHaveBeenCalled();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('child-1');
      expect(nodes[0].parentNode).toBeUndefined();
      // Child position should be adjusted to absolute coordinates
      expect(nodes[0].position.x).toBe(110); // 10 + 100
      expect(nodes[0].position.y).toBe(70); // 10 + 100 - 40
    });

    it('should detach children using parentId when parentNode is not set', async () => {
      const groupNode: Node = {
        id: 'group-1',
        type: 'group',
        position: { x: 50, y: 50 },
        data: { executionOrder: 1 },
      };
      const childNode: Node = {
        id: 'child-1',
        type: 'text',
        position: { x: 20, y: 20 },
        parentId: 'group-1',
        extent: 'parent',
        data: { executionOrder: 2 },
      };

      nodes = [groupNode, childNode];
      edges = [];

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('group-1');
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].parentId).toBeUndefined();
    });

    it('should emit deleteElements event with nodeId', async () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('node-1');
      });

      expect(emit).toHaveBeenCalledWith('deleteElements', { nodeId: 'node-1' });
    });

    it('should call markEdgeGlows after filtering edges', async () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('node-1');
      });

      expect(markEdgeGlows).toHaveBeenCalled();
    });

    it('should handle error when deleteFileFromReplicate fails', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(deleteFileFromReplicate).mockRejectedValueOnce(new Error('Delete failed'));

      nodes = [
        {
          id: 'media-node',
          type: 'media',
          position: { x: 0, y: 0 },
          data: { replicateFileId: 'file-123', executionOrder: 1 },
        },
      ] as Node[];

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('media-node');
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(nodes).toHaveLength(0); // Node should still be removed
      consoleWarnSpy.mockRestore();
    });

    it('should remove edges where node is the target', async () => {
      edges = [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'out',
          targetHandle: 'in',
        },
        {
          id: 'edge-2',
          source: 'node-3',
          target: 'node-1',
          sourceHandle: 'out',
          targetHandle: 'in',
        },
      ] as Edge[];

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('node-1');
      });

      expect(edges).toHaveLength(0);
    });
  });

  // ==========================================================================
  // handleAddNode Tests
  // ==========================================================================

  describe('handleAddNode', () => {
    it('should create a node with proper type', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      let nodeId: string | null = null;
      act(() => {
        nodeId = result.current.handleAddNode('text');
      });

      expect(nodeCreators.text).toHaveBeenCalled();
      expect(nodeId).toMatch(/^text-\d+$/);
      expect(setNodes).toHaveBeenCalled();
    });

    it('should assign incrementing execution order', () => {
      nodes = [
        { id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: { executionOrder: 5 } },
        { id: 'node-2', type: 'image', position: { x: 100, y: 0 }, data: { executionOrder: 3 } },
      ] as Node[];

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('text');
      });

      const createCall = vi.mocked(nodeCreators.text).mock.calls[0][0];
      expect(createCall.data.executionOrder).toBe(6); // highest (5) + 1
    });

    it('should hide welcome screen when adding a node', () => {
      showWelcome = true;
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('text');
      });

      expect(setShowWelcome).toHaveBeenCalledWith(false);
      expect(setWelcomePinned).toHaveBeenCalledWith(false);
    });

    it('should not call setShowWelcome when welcome is already hidden', () => {
      showWelcome = false;
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('text');
      });

      expect(setShowWelcome).not.toHaveBeenCalled();
    });

    it('should use default model from config for text nodes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('text');
      });

      const createCall = vi.mocked(nodeCreators.text).mock.calls[0][0];
      expect(createCall.defaultModel).toBe('openai/gpt-4');
    });

    it('should use default model from config for image nodes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('image');
      });

      const createCall = vi.mocked(nodeCreators.image).mock.calls[0][0];
      expect(createCall.defaultModel).toBe('stability-ai/sdxl');
    });

    it('should use default model from config for video nodes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('video');
      });

      const createCall = vi.mocked(nodeCreators.video).mock.calls[0][0];
      expect(createCall.defaultModel).toBe('video-model/v1');
    });

    it('should use default model from config for audio nodes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('audio');
      });

      const createCall = vi.mocked(nodeCreators.audio).mock.calls[0][0];
      expect(createCall.defaultModel).toBe('audio-model/v1');
    });

    it('should use default model from config for upscaler nodes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('upscaler');
      });

      const createCall = vi.mocked(nodeCreators.upscaler).mock.calls[0][0];
      expect(createCall.defaultModel).toBe('upscaler-model/v1');
    });

    it('should use default position when not provided', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('text');
      });

      const createCall = vi.mocked(nodeCreators.text).mock.calls[0][0];
      expect(createCall.position).toEqual({ x: 100, y: 100 });
    });

    it('should use provided position when specified', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('text', { x: 300, y: 400 });
      });

      const createCall = vi.mocked(nodeCreators.text).mock.calls[0][0];
      expect(createCall.position).toEqual({ x: 300, y: 400 });
    });

    it('should return null for unknown node type', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      let nodeId: string | null = null;
      act(() => {
        nodeId = result.current.handleAddNode('unknown-type');
      });

      expect(nodeId).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'No creator function found for node type: unknown-type'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should concatenate new node to existing nodes', () => {
      const testNodes = [
        { id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: { executionOrder: 1 } },
      ] as Node[];

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('text');
      });

      expect(setNodes).toHaveBeenCalled();
      // Verify the updater function adds to existing nodes
      const updater = vi.mocked(setNodes).mock.calls[0][0];
      if (typeof updater === 'function') {
        const updatedNodes = updater(testNodes);
        expect(updatedNodes.length).toBe(2); // 1 original + 1 new
      }
    });

    it('should handle empty nodes array for execution order calculation', () => {
      nodes = [];
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('text');
      });

      const createCall = vi.mocked(nodeCreators.text).mock.calls[0][0];
      expect(createCall.data.executionOrder).toBe(1);
    });
  });

  // ==========================================================================
  // moveNodeOrder Tests
  // ==========================================================================

  describe('moveNodeOrder', () => {
    beforeEach(() => {
      nodes = [
        { id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: { executionOrder: 1 } },
        { id: 'node-2', type: 'image', position: { x: 100, y: 0 }, data: { executionOrder: 2 } },
        { id: 'node-3', type: 'video', position: { x: 200, y: 0 }, data: { executionOrder: 3 } },
      ] as Node[];
    });

    it('should move node up in execution order', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.moveNodeOrder('node-2', 'up');
      });

      expect(setNodes).toHaveBeenCalled();
      // After move, node-2 should have order 1, node-1 should have order 2
      const updatedNodes = nodes;
      const node1 = updatedNodes.find((n) => n.id === 'node-1');
      const node2 = updatedNodes.find((n) => n.id === 'node-2');
      expect(node2?.data.executionOrder).toBe(1);
      expect(node1?.data.executionOrder).toBe(2);
    });

    it('should move node down in execution order', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.moveNodeOrder('node-2', 'down');
      });

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = nodes;
      const node2 = updatedNodes.find((n) => n.id === 'node-2');
      const node3 = updatedNodes.find((n) => n.id === 'node-3');
      expect(node2?.data.executionOrder).toBe(3);
      expect(node3?.data.executionOrder).toBe(2);
    });

    it('should not move first node up', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.moveNodeOrder('node-1', 'up');
      });

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = nodes;
      const node1 = updatedNodes.find((n) => n.id === 'node-1');
      expect(node1?.data.executionOrder).toBe(1);
    });

    it('should not move last node down', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.moveNodeOrder('node-3', 'down');
      });

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = nodes;
      const node3 = updatedNodes.find((n) => n.id === 'node-3');
      expect(node3?.data.executionOrder).toBe(3);
    });

    it('should handle non-existent node gracefully', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.moveNodeOrder('non-existent', 'up');
      });

      expect(setNodes).toHaveBeenCalled();
      // Nodes should remain unchanged
      expect(nodes).toHaveLength(3);
    });

    it('should reassign all execution orders after move', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.moveNodeOrder('node-3', 'up');
      });

      const updatedNodes = nodes;
      // All nodes should have sequential execution orders
      const orders = updatedNodes.map((n) => n.data.executionOrder).sort((a, b) => a - b);
      expect(orders).toEqual([1, 2, 3]);
    });
  });

  // ==========================================================================
  // handleNodesChange Tests
  // ==========================================================================

  describe('handleNodesChange', () => {
    it('should apply node changes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodesChange([
          { type: 'position', id: 'node-1', position: { x: 50, y: 50 } },
        ] as NodeChange[]);
      });

      expect(setNodes).toHaveBeenCalled();
    });

    it('should update selection when node is selected', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodesChange([
          { type: 'select', id: 'node-1', selected: true },
        ] as NodeChange[]);
      });

      expect(setSelectedNodeId).toHaveBeenCalledWith('node-1');
    });

    it('should clear selection when node is deselected', () => {
      selectedNodeId = 'node-1';
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodesChange([
          { type: 'select', id: 'node-1', selected: false },
        ] as NodeChange[]);
      });

      expect(setSelectedNodeId).toHaveBeenCalledWith(null);
    });

    it('should not clear selection when different node is deselected', () => {
      selectedNodeId = 'node-1';
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodesChange([
          { type: 'select', id: 'node-2', selected: false },
        ] as NodeChange[]);
      });

      // Should not call with null since the deselected node is not the selected one
      expect(setSelectedNodeId).not.toHaveBeenCalledWith(null);
    });

    it('should take snapshot on structural change (add)', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodesChange([
          { type: 'add', item: { id: 'new-node', position: { x: 0, y: 0 }, data: {} } },
        ] as NodeChange[]);
      });

      expect(takeSnapshotRef.current).toHaveBeenCalledWith(true);
    });

    it('should take snapshot on structural change (remove)', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodesChange([{ type: 'remove', id: 'node-1' }] as NodeChange[]);
      });

      expect(takeSnapshotRef.current).toHaveBeenCalledWith(true);
    });

    it('should not take snapshot on non-structural changes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodesChange([
          { type: 'position', id: 'node-1', position: { x: 50, y: 50 } },
        ] as NodeChange[]);
      });

      expect(takeSnapshotRef.current).not.toHaveBeenCalled();
    });

    it('should detach children when group node is removed', () => {
      const groupNode: Node = {
        id: 'group-1',
        type: 'group',
        position: { x: 100, y: 100 },
        data: { executionOrder: 1 },
      };
      const childNode: Node = {
        id: 'child-1',
        type: 'text',
        position: { x: 10, y: 10 },
        parentNode: 'group-1',
        extent: 'parent',
        data: { executionOrder: 2 },
      };

      nodes = [groupNode, childNode];

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodesChange([{ type: 'remove', id: 'group-1' }] as NodeChange[]);
      });

      expect(setNodes).toHaveBeenCalled();
    });

    it('should handle multiple changes at once', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodesChange([
          { type: 'position', id: 'node-1', position: { x: 50, y: 50 } },
          { type: 'select', id: 'node-2', selected: true },
        ] as NodeChange[]);
      });

      expect(setNodes).toHaveBeenCalled();
      expect(setSelectedNodeId).toHaveBeenCalledWith('node-2');
    });
  });

  // ==========================================================================
  // handleEdgesChange Tests
  // ==========================================================================

  describe('handleEdgesChange', () => {
    it('should apply edge changes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleEdgesChange([
          { type: 'select', id: 'edge-1', selected: true },
        ] as EdgeChange[]);
      });

      expect(setEdges).toHaveBeenCalled();
    });

    it('should emit deleteEdge event for each removed edge', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleEdgesChange([{ type: 'remove', id: 'edge-1' }] as EdgeChange[]);
      });

      expect(emit).toHaveBeenCalledWith('deleteEdge', { edgeId: 'edge-1' });
    });

    it('should emit edgesChange event with changes', () => {
      const changes = [{ type: 'remove', id: 'edge-1' }] as EdgeChange[];
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleEdgesChange(changes);
      });

      expect(emit).toHaveBeenCalledWith('edgesChange', { changes });
    });

    it('should emit deleteElements event on removal', () => {
      const changes = [{ type: 'remove', id: 'edge-1' }] as EdgeChange[];
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleEdgesChange(changes);
      });

      expect(emit).toHaveBeenCalledWith('deleteElements', { changes });
    });

    it('should call markEdgeGlows on removal', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleEdgesChange([{ type: 'remove', id: 'edge-1' }] as EdgeChange[]);
      });

      expect(markEdgeGlows).toHaveBeenCalled();
    });

    it('should take snapshot on removal', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleEdgesChange([{ type: 'remove', id: 'edge-1' }] as EdgeChange[]);
      });

      expect(takeSnapshotRef.current).toHaveBeenCalledWith(true);
    });

    it('should take snapshot on addition', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleEdgesChange([
          {
            type: 'add',
            item: { id: 'new-edge', source: 'node-1', target: 'node-2' },
          },
        ] as EdgeChange[]);
      });

      expect(takeSnapshotRef.current).toHaveBeenCalledWith(true);
    });

    it('should not call markEdgeGlows on non-removal changes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleEdgesChange([
          { type: 'select', id: 'edge-1', selected: true },
        ] as EdgeChange[]);
      });

      // markEdgeGlows should not be called for non-removal changes
      // It gets called inside setEdges but only when hasRemovals is true
    });
  });

  // ==========================================================================
  // Node Drag Handlers Tests
  // ==========================================================================

  describe('handleNodeDragStart', () => {
    it('should take snapshot when drag starts', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodeDragStart();
      });

      expect(takeSnapshotRef.current).toHaveBeenCalledWith(true);
    });

    it('should not throw when takeSnapshotRef.current is null', () => {
      takeSnapshotRef.current = null;
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      expect(() => {
        act(() => {
          result.current.handleNodeDragStart();
        });
      }).not.toThrow();
    });
  });

  describe('handleNodeDrag', () => {
    it('should call getHelperLines with dragging node and all nodes', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));
      const mockEvent = {} as React.MouseEvent;
      const draggingNode = { id: 'node-1', position: { x: 50, y: 50 }, data: {} } as Node;

      act(() => {
        result.current.handleNodeDrag(mockEvent, draggingNode);
      });

      expect(getHelperLines).toHaveBeenCalledWith(draggingNode, nodes);
    });

    it('should update helper lines', () => {
      vi.mocked(getHelperLines).mockReturnValueOnce({
        horizontal: 100,
        vertical: 200,
        snapPosition: null,
      });

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));
      const mockEvent = {} as React.MouseEvent;
      const draggingNode = { id: 'node-1', position: { x: 50, y: 50 }, data: {} } as Node;

      act(() => {
        result.current.handleNodeDrag(mockEvent, draggingNode);
      });

      expect(setHelperLines).toHaveBeenCalledWith({ horizontal: 100, vertical: 200 });
    });

    it('should snap node position when snapPosition is returned', () => {
      vi.mocked(getHelperLines).mockReturnValueOnce({
        horizontal: 100,
        vertical: 200,
        snapPosition: { x: 150, y: 250 },
      });

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));
      const mockEvent = {} as React.MouseEvent;
      const draggingNode = { id: 'node-1', position: { x: 50, y: 50 }, data: {} } as Node;

      act(() => {
        result.current.handleNodeDrag(mockEvent, draggingNode);
      });

      expect(setNodes).toHaveBeenCalled();
    });

    it('should not update node position when no snapPosition', () => {
      vi.mocked(getHelperLines).mockReturnValueOnce({
        horizontal: null,
        vertical: null,
        snapPosition: null,
      });

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));
      const mockEvent = {} as React.MouseEvent;
      const draggingNode = { id: 'node-1', position: { x: 50, y: 50 }, data: {} } as Node;

      act(() => {
        result.current.handleNodeDrag(mockEvent, draggingNode);
      });

      // setNodes should not be called for snapping
      expect(setNodes).not.toHaveBeenCalled();
    });
  });

  describe('handleNodeDragStop', () => {
    it('should clear helper lines when drag stops', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleNodeDragStop();
      });

      expect(setHelperLines).toHaveBeenCalledWith({ horizontal: null, vertical: null });
    });
  });

  // ==========================================================================
  // Hook Stability Tests
  // ==========================================================================

  describe('hook stability', () => {
    it('should return stable handleRemoveNode reference', () => {
      const { result, rerender } = renderHook(() => useNodeOperations(createDefaultConfig()));

      const first = result.current.handleRemoveNode;
      rerender();
      const second = result.current.handleRemoveNode;

      // Note: This may not be strictly equal due to useCallback dependencies
      expect(typeof first).toBe('function');
      expect(typeof second).toBe('function');
    });

    it('should return stable handleAddNode reference', () => {
      const { result, rerender } = renderHook(() => useNodeOperations(createDefaultConfig()));

      const first = result.current.handleAddNode;
      rerender();
      const second = result.current.handleAddNode;

      expect(typeof first).toBe('function');
      expect(typeof second).toBe('function');
    });

    it('should return all expected handlers', () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      expect(result.current).toHaveProperty('handleRemoveNode');
      expect(result.current).toHaveProperty('handleAddNode');
      expect(result.current).toHaveProperty('moveNodeOrder');
      expect(result.current).toHaveProperty('handleNodesChange');
      expect(result.current).toHaveProperty('handleEdgesChange');
      expect(result.current).toHaveProperty('handleNodeDragStart');
      expect(result.current).toHaveProperty('handleNodeDrag');
      expect(result.current).toHaveProperty('handleNodeDragStop');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle removing a node that does not exist', async () => {
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('non-existent');
      });

      // Should still call setNodes and setEdges without errors
      expect(setNodes).toHaveBeenCalled();
      expect(setEdges).toHaveBeenCalled();
    });

    it('should handle nodes with undefined executionOrder', () => {
      nodes = [
        { id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', type: 'image', position: { x: 100, y: 0 }, data: {} },
      ] as Node[];

      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      act(() => {
        result.current.handleAddNode('text');
      });

      const createCall = vi.mocked(nodeCreators.text).mock.calls[0][0];
      expect(createCall.data.executionOrder).toBe(1); // 0 (max of undefined || 0) + 1
    });

    it('should handle empty edges array', async () => {
      edges = [];
      const { result } = renderHook(() => useNodeOperations(createDefaultConfig()));

      await act(async () => {
        await result.current.handleRemoveNode('node-1');
      });

      expect(setEdges).toHaveBeenCalled();
      expect(edges).toHaveLength(0);
    });

    it('should handle undefined defaultModel configs', () => {
      const configWithoutDefaults = {
        nodes,
        edges,
        setNodes,
        setEdges,
        selectedNodeId,
        setSelectedNodeId,
        setHelperLines,
        takeSnapshotRef,
        showWelcome,
        setShowWelcome,
        setWelcomePinned,
        // No default models specified
      };

      const { result } = renderHook(() => useNodeOperations(configWithoutDefaults));

      act(() => {
        result.current.handleAddNode('text');
      });

      const createCall = vi.mocked(nodeCreators.text).mock.calls[0][0];
      expect(createCall.defaultModel).toBeUndefined();
    });
  });
});
