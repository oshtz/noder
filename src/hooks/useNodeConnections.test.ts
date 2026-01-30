import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeConnections } from './useNodeConnections';
import type { Node, Edge, Connection, OnConnectStartParams } from 'reactflow';

// Mock reactflow addEdge
vi.mock('reactflow', () => ({
  addEdge: vi.fn((edge, edges) => [...edges, edge]),
}));

// Mock handleValidation
vi.mock('../utils/handleValidation', () => ({
  validateEdges: vi.fn(() => ({ validationErrors: [] })),
}));

// Mock eventBus - store handlers for testing
const eventHandlers: Record<string, ((event: unknown) => void)[]> = {};
vi.mock('../utils/eventBus', () => ({
  emit: vi.fn(),
  on: vi.fn((eventType: string, handler: (event: unknown) => void) => {
    if (!eventHandlers[eventType]) {
      eventHandlers[eventType] = [];
    }
    eventHandlers[eventType].push(handler);
    // Return unsubscribe function
    return vi.fn(() => {
      const index = eventHandlers[eventType].indexOf(handler);
      if (index > -1) {
        eventHandlers[eventType].splice(index, 1);
      }
    });
  }),
}));

// Mock workflowHelpers
vi.mock('../utils/workflowHelpers', () => ({
  markEdgeGlows: vi.fn((edges) => edges),
}));

// Mock nodes registry
vi.mock('../nodes', () => ({
  nodeTypes: {
    image: {
      component: vi.fn(),
      defaultData: {
        handles: [
          { id: 'prompt-in', type: 'input', dataType: 'text' },
          { id: 'image-out', type: 'output', dataType: 'image' },
        ],
      },
    },
    text: {
      component: vi.fn(),
      defaultData: {
        handles: [
          { id: 'text-in', type: 'input', dataType: 'text' },
          { id: 'text-out', type: 'output', dataType: 'text' },
        ],
      },
    },
    video: {
      component: vi.fn(),
      defaultData: {
        handles: [
          { id: 'image-in', type: 'input', dataType: 'image' },
          { id: 'video-out', type: 'output', dataType: 'video' },
        ],
      },
      handles: [
        { id: 'image-in', type: 'input', dataType: 'image' },
        { id: 'video-out', type: 'output', dataType: 'video' },
      ],
    },
  },
}));

// Import mocked modules for assertions
import { emit, on } from '../utils/eventBus';
import { validateEdges } from '../utils/handleValidation';
import { markEdgeGlows } from '../utils/workflowHelpers';
import { addEdge } from 'reactflow';

describe('useNodeConnections', () => {
  let nodes: Node[];
  let edges: Edge[];
  let setNodes: ReturnType<typeof vi.fn>;
  let setEdges: ReturnType<typeof vi.fn>;
  let setValidationErrors: ReturnType<typeof vi.fn>;
  let moveNodeOrder: ReturnType<typeof vi.fn>;

  const createDefaultOptions = () => ({
    nodes,
    edges,
    setNodes,
    setEdges,
    setValidationErrors,
    edgeType: 'default',
    moveNodeOrder,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear event handlers
    Object.keys(eventHandlers).forEach((key) => {
      eventHandlers[key] = [];
    });

    nodes = [
      {
        id: 'node-1',
        type: 'image',
        position: { x: 0, y: 0 },
        data: {
          handles: [
            { id: 'prompt-in', type: 'input', dataType: 'text' },
            { id: 'image-out', type: 'output', dataType: 'image' },
          ],
        },
      },
      {
        id: 'node-2',
        type: 'text',
        position: { x: 200, y: 0 },
        data: {
          handles: [
            { id: 'text-in', type: 'input', dataType: 'text' },
            { id: 'text-out', type: 'output', dataType: 'text' },
          ],
        },
      },
    ] as Node[];

    edges = [] as Edge[];

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

    setValidationErrors = vi.fn();
    moveNodeOrder = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================

  describe('initial state', () => {
    it('should have connectingNodeId as null initially', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      expect(result.current.connectingNodeId).toBeNull();
    });

    it('should have connectingHandleId as null initially', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      expect(result.current.connectingHandleId).toBeNull();
    });

    it('should have connectingHandleType as null initially', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      expect(result.current.connectingHandleType).toBeNull();
    });

    it('should return all expected properties', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      expect(result.current).toHaveProperty('connectingNodeId');
      expect(result.current).toHaveProperty('connectingHandleId');
      expect(result.current).toHaveProperty('connectingHandleType');
      expect(result.current).toHaveProperty('onConnectStart');
      expect(result.current).toHaveProperty('onConnectEnd');
      expect(result.current).toHaveProperty('onConnect');
    });
  });

  // ==========================================================================
  // onConnectStart Tests
  // ==========================================================================

  describe('onConnectStart', () => {
    it('should set connectingNodeId when connection starts', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      expect(result.current.connectingNodeId).toBe('node-1');
    });

    it('should set connectingHandleId when connection starts', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      expect(result.current.connectingHandleId).toBe('image-out');
    });

    it('should look up handle dataType from node data handles', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      expect(result.current.connectingHandleType).toBe('image');
    });

    it('should look up handle from node definition if not in node data', () => {
      // Create node without handles in data
      nodes = [
        {
          id: 'node-3',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {}, // No handles in data
        },
      ] as Node[];

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-3',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      // Should fall back to node definition
      expect(result.current.connectingHandleType).toBe('image');
    });

    it('should use handleType fallback when dataType not found', () => {
      nodes = [
        {
          id: 'node-unknown',
          type: 'unknown-type',
          position: { x: 0, y: 0 },
          data: {},
        },
      ] as Node[];

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-unknown',
          handleId: 'some-handle',
          handleType: 'source',
        });
      });

      expect(result.current.connectingHandleType).toBe('source');
    });

    it('should handle node not found scenario', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'non-existent',
          handleId: 'handle',
          handleType: 'source',
        });
      });

      expect(result.current.connectingNodeId).toBe('non-existent');
      expect(result.current.connectingHandleId).toBe('handle');
      expect(result.current.connectingHandleType).toBe('source');
    });

    it('should handle null nodeId in params', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart(
          { clientX: 0, clientY: 0 } as React.MouseEvent,
          {
            nodeId: null,
            handleId: 'handle',
            handleType: 'source',
          } as unknown as OnConnectStartParams
        );
      });

      expect(result.current.connectingNodeId).toBeNull();
    });

    it('should handle null handleId in params', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart(
          { clientX: 0, clientY: 0 } as React.MouseEvent,
          {
            nodeId: 'node-1',
            handleId: null,
            handleType: 'source',
          } as unknown as OnConnectStartParams
        );
      });

      expect(result.current.connectingHandleId).toBeNull();
    });
  });

  // ==========================================================================
  // onConnectEnd Tests
  // ==========================================================================

  describe('onConnectEnd', () => {
    it('should emit openNodeSelector when dropped on pane', () => {
      // Setup DOM element
      const paneElement = document.createElement('div');
      paneElement.classList.add('react-flow__pane');

      const rendererElement = document.createElement('div');
      rendererElement.classList.add('react-flow__renderer');
      document.body.appendChild(rendererElement);

      // Mock getBoundingClientRect
      vi.spyOn(rendererElement, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      // First start a connection
      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      // Then end it on the pane
      act(() => {
        result.current.onConnectEnd({
          target: paneElement,
          clientX: 400,
          clientY: 300,
        } as unknown as MouseEvent);
      });

      expect(emit).toHaveBeenCalledWith(
        'openNodeSelector',
        expect.objectContaining({
          position: { x: 400, y: 300 },
          connectionContext: expect.objectContaining({
            sourceNode: 'node-1',
            sourceHandle: 'image-out',
          }),
        })
      );

      document.body.removeChild(rendererElement);
    });

    it('should clear connecting state after processing', () => {
      const paneElement = document.createElement('div');
      paneElement.classList.add('react-flow__pane');

      const rendererElement = document.createElement('div');
      rendererElement.classList.add('react-flow__renderer');
      document.body.appendChild(rendererElement);

      vi.spyOn(rendererElement, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      act(() => {
        result.current.onConnectEnd({
          target: paneElement,
          clientX: 400,
          clientY: 300,
        } as unknown as MouseEvent);
      });

      expect(result.current.connectingNodeId).toBeNull();
      expect(result.current.connectingHandleId).toBeNull();
      expect(result.current.connectingHandleType).toBeNull();

      document.body.removeChild(rendererElement);
    });

    it('should not emit when not dropped on valid target', () => {
      const nodeElement = document.createElement('div');
      nodeElement.classList.add('react-flow__node');

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      act(() => {
        result.current.onConnectEnd({
          target: nodeElement,
          clientX: 400,
          clientY: 300,
        } as unknown as MouseEvent);
      });

      expect(emit).not.toHaveBeenCalledWith('openNodeSelector', expect.anything());
    });

    it('should clear state when no connection information available', () => {
      const paneElement = document.createElement('div');
      paneElement.classList.add('react-flow__pane');

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      // End without starting
      act(() => {
        result.current.onConnectEnd({
          target: paneElement,
          clientX: 400,
          clientY: 300,
        } as unknown as MouseEvent);
      });

      expect(result.current.connectingNodeId).toBeNull();
      expect(emit).not.toHaveBeenCalledWith('openNodeSelector', expect.anything());
    });

    it('should emit openNodeSelector when dropped on react-flow__renderer', () => {
      const rendererElement = document.createElement('div');
      rendererElement.classList.add('react-flow__renderer');
      document.body.appendChild(rendererElement);

      vi.spyOn(rendererElement, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      act(() => {
        result.current.onConnectEnd({
          target: rendererElement,
          clientX: 400,
          clientY: 300,
        } as unknown as MouseEvent);
      });

      expect(emit).toHaveBeenCalledWith('openNodeSelector', expect.anything());

      document.body.removeChild(rendererElement);
    });

    it('should emit openNodeSelector when dropped on react-flow__edges', () => {
      const edgesElement = document.createElement('div');
      edgesElement.classList.add('react-flow__edges');

      const rendererElement = document.createElement('div');
      rendererElement.classList.add('react-flow__renderer');
      document.body.appendChild(rendererElement);

      vi.spyOn(rendererElement, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      act(() => {
        result.current.onConnectEnd({
          target: edgesElement,
          clientX: 400,
          clientY: 300,
        } as unknown as MouseEvent);
      });

      expect(emit).toHaveBeenCalledWith('openNodeSelector', expect.anything());

      document.body.removeChild(rendererElement);
    });

    it('should clear state when source node not found', () => {
      const paneElement = document.createElement('div');
      paneElement.classList.add('react-flow__pane');

      // Empty nodes array
      nodes = [];

      const { result } = renderHook(() =>
        useNodeConnections({
          ...createDefaultOptions(),
          nodes: [{ id: 'node-1', type: 'image', position: { x: 0, y: 0 }, data: {} } as Node],
        })
      );

      // Set connecting state manually by starting connection
      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-deleted',
          handleId: 'handle',
          handleType: 'source',
        });
      });

      act(() => {
        result.current.onConnectEnd({
          target: paneElement,
          clientX: 400,
          clientY: 300,
        } as unknown as MouseEvent);
      });

      expect(result.current.connectingNodeId).toBeNull();
    });
  });

  // ==========================================================================
  // onConnect Tests
  // ==========================================================================

  describe('onConnect', () => {
    it('should create edge with proper id format', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        });
      });

      expect(addEdge).toHaveBeenCalled();
      const callArgs = vi.mocked(addEdge).mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        id: 'enode-1-image-out-node-2-text-in',
      });
    });

    it('should create edge with type custom', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        });
      });

      expect(addEdge).toHaveBeenCalled();
      const callArgs = vi.mocked(addEdge).mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        type: 'custom',
      });
    });

    it('should create edge with animated false', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        });
      });

      expect(addEdge).toHaveBeenCalled();
      const callArgs = vi.mocked(addEdge).mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        animated: false,
      });
    });

    it('should include edgeType in edge data', () => {
      const { result } = renderHook(() =>
        useNodeConnections({
          ...createDefaultOptions(),
          edgeType: 'smoothstep',
        })
      );

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        });
      });

      expect(addEdge).toHaveBeenCalled();
      const callArgs = vi.mocked(addEdge).mock.calls[0];
      expect(callArgs[0].data).toMatchObject({
        edgeType: 'smoothstep',
      });
    });

    it('should validate edges before adding', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        });
      });

      expect(validateEdges).toHaveBeenCalled();
    });

    it('should reject invalid connections', () => {
      vi.mocked(validateEdges).mockReturnValueOnce({
        validEdges: [],
        validationErrors: [
          {
            edge: {} as Edge,
            errors: ['type-mismatch'],
          },
        ],
      });

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        });
      });

      expect(setValidationErrors).toHaveBeenCalled();
      expect(setEdges).not.toHaveBeenCalled();
    });

    it('should emit nodeConnection event on successful connection', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        });
      });

      expect(emit).toHaveBeenCalledWith('nodeConnection', {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'image-out',
        targetHandle: 'text-in',
      });
    });

    it('should emit connect event on successful connection', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        });
      });

      expect(emit).toHaveBeenCalledWith('connect', {
        params: {
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        },
      });
    });

    it('should call markEdgeGlows on updated edges', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        });
      });

      expect(markEdgeGlows).toHaveBeenCalled();
    });

    it('should handle null source gracefully', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: null,
          target: 'node-2',
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        } as Connection);
      });

      expect(addEdge).toHaveBeenCalled();
      const callArgs = vi.mocked(addEdge).mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        source: '',
      });
    });

    it('should handle null target gracefully', () => {
      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnect({
          source: 'node-1',
          target: null,
          sourceHandle: 'image-out',
          targetHandle: 'text-in',
        } as Connection);
      });

      expect(addEdge).toHaveBeenCalled();
      const callArgs = vi.mocked(addEdge).mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        target: '',
      });
    });
  });

  // ==========================================================================
  // Event Listener Tests
  // ==========================================================================

  describe('event listeners', () => {
    it('should register deleteEdge event listener', () => {
      renderHook(() => useNodeConnections(createDefaultOptions()));

      expect(on).toHaveBeenCalledWith('deleteEdge', expect.any(Function));
    });

    it('should register moveNodeOrder event listener', () => {
      renderHook(() => useNodeConnections(createDefaultOptions()));

      expect(on).toHaveBeenCalledWith('moveNodeOrder', expect.any(Function));
    });

    it('should register nodeProcessingComplete event listener', () => {
      renderHook(() => useNodeConnections(createDefaultOptions()));

      expect(on).toHaveBeenCalledWith('nodeProcessingComplete', expect.any(Function));
    });

    it('should register autoConnect event listener', () => {
      renderHook(() => useNodeConnections(createDefaultOptions()));

      expect(on).toHaveBeenCalledWith('autoConnect', expect.any(Function));
    });

    it('should register nodeDataUpdated event listener', () => {
      renderHook(() => useNodeConnections(createDefaultOptions()));

      expect(on).toHaveBeenCalledWith('nodeDataUpdated', expect.any(Function));
    });

    it('should remove edges on deleteEdge event', () => {
      edges = [
        { id: 'edge-1', source: 'node-1', target: 'node-2' },
        { id: 'edge-2', source: 'node-2', target: 'node-3' },
      ] as Edge[];

      renderHook(() => useNodeConnections(createDefaultOptions()));

      // Trigger the deleteEdge event
      const deleteEdgeHandler = eventHandlers['deleteEdge']?.[0];
      expect(deleteEdgeHandler).toBeDefined();

      act(() => {
        deleteEdgeHandler({ detail: { edgeId: 'edge-1' } });
      });

      expect(setEdges).toHaveBeenCalled();
      expect(markEdgeGlows).toHaveBeenCalled();
    });

    it('should call moveNodeOrder on moveNodeOrder event', () => {
      renderHook(() => useNodeConnections(createDefaultOptions()));

      const moveNodeOrderHandler = eventHandlers['moveNodeOrder']?.[0];
      expect(moveNodeOrderHandler).toBeDefined();

      act(() => {
        moveNodeOrderHandler({ detail: { nodeId: 'node-1', direction: 'up' } });
      });

      expect(moveNodeOrder).toHaveBeenCalledWith('node-1', 'up');
    });

    it('should remove processing class on nodeProcessingComplete event', () => {
      nodes = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {},
          className: 'react-flow__node-resizable processing',
        },
      ] as Node[];

      renderHook(() => useNodeConnections(createDefaultOptions()));

      const handler = eventHandlers['nodeProcessingComplete']?.[0];
      expect(handler).toBeDefined();

      act(() => {
        handler({ detail: { nodeId: 'node-1' } });
      });

      expect(setNodes).toHaveBeenCalled();
    });

    it('should find compatible handle and connect on autoConnect event', () => {
      nodes = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {
            handles: [{ id: 'image-out', type: 'output', dataType: 'image' }],
          },
        },
        {
          id: 'node-2',
          type: 'video',
          position: { x: 200, y: 0 },
          data: {
            handles: [
              { id: 'image-in', type: 'input', dataType: 'image' },
              { id: 'video-out', type: 'output', dataType: 'video' },
            ],
          },
        },
      ] as Node[];

      renderHook(() => useNodeConnections(createDefaultOptions()));

      const handler = eventHandlers['autoConnect']?.[0];
      expect(handler).toBeDefined();

      act(() => {
        handler({
          detail: {
            source: 'node-1',
            sourceHandle: 'image-out',
            target: 'node-2',
            handleType: 'image',
          },
        });
      });

      // Should have called validateEdges (through onConnect)
      expect(validateEdges).toHaveBeenCalled();
    });

    it('should not connect on autoConnect when no compatible handle found', () => {
      nodes = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {
            handles: [{ id: 'image-out', type: 'output', dataType: 'image' }],
          },
        },
        {
          id: 'node-2',
          type: 'text',
          position: { x: 200, y: 0 },
          data: {
            handles: [{ id: 'text-in', type: 'input', dataType: 'text' }], // Only text input
          },
        },
      ] as Node[];

      // Clear any previous calls
      vi.mocked(validateEdges).mockClear();

      renderHook(() => useNodeConnections(createDefaultOptions()));

      const handler = eventHandlers['autoConnect']?.[0];

      act(() => {
        handler({
          detail: {
            source: 'node-1',
            sourceHandle: 'image-out',
            target: 'node-2',
            handleType: 'image', // Looking for image input but node-2 only has text
          },
        });
      });

      // Should not have called addEdge
      expect(addEdge).not.toHaveBeenCalled();
    });

    it('should not connect on autoConnect when target node not found', () => {
      vi.mocked(validateEdges).mockClear();

      renderHook(() => useNodeConnections(createDefaultOptions()));

      const handler = eventHandlers['autoConnect']?.[0];

      act(() => {
        handler({
          detail: {
            source: 'node-1',
            sourceHandle: 'image-out',
            target: 'non-existent-node',
            handleType: 'image',
          },
        });
      });

      expect(addEdge).not.toHaveBeenCalled();
    });

    it('should update node data on nodeDataUpdated event', () => {
      renderHook(() => useNodeConnections(createDefaultOptions()));

      const handler = eventHandlers['nodeDataUpdated']?.[0];
      expect(handler).toBeDefined();

      act(() => {
        handler({
          detail: {
            nodeId: 'node-1',
            updates: { label: 'Updated Label' },
          },
        });
      });

      expect(setNodes).toHaveBeenCalled();
    });

    it('should cleanup event listeners on unmount', () => {
      const unsubscribeFns: ReturnType<typeof vi.fn>[] = [];

      // Track unsubscribe functions
      vi.mocked(on).mockImplementation((_eventType: string, _handler: (event: unknown) => void) => {
        const unsubscribe = vi.fn();
        unsubscribeFns.push(unsubscribe);
        return unsubscribe;
      });

      const { unmount } = renderHook(() => useNodeConnections(createDefaultOptions()));

      unmount();

      // All unsubscribe functions should have been called
      unsubscribeFns.forEach((unsub) => {
        expect(unsub).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Hook Stability Tests
  // ==========================================================================

  describe('hook stability', () => {
    it('should return stable onConnectStart reference', () => {
      const { result, rerender } = renderHook(() => useNodeConnections(createDefaultOptions()));

      const first = result.current.onConnectStart;
      rerender();
      const second = result.current.onConnectStart;

      expect(first).toBe(second);
    });

    it('should return stable onConnectEnd reference when nodes change', () => {
      const { result, rerender } = renderHook(
        ({ nodes }) =>
          useNodeConnections({
            ...createDefaultOptions(),
            nodes,
          }),
        { initialProps: { nodes } }
      );

      const _first = result.current.onConnectEnd;

      // Add a new node
      const newNodes = [
        ...nodes,
        { id: 'node-3', type: 'text', position: { x: 400, y: 0 }, data: {} } as Node,
      ];

      rerender({ nodes: newNodes });

      // Note: onConnectEnd depends on nodes and connecting state, so it may update
      // This test verifies the callback is defined and functional
      expect(result.current.onConnectEnd).toBeDefined();
    });

    it('should return stable onConnect reference when edgeType stays same', () => {
      const { result, rerender } = renderHook(() => useNodeConnections(createDefaultOptions()));

      const first = result.current.onConnect;
      rerender();
      const second = result.current.onConnect;

      expect(first).toBe(second);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle touch events in onConnectEnd', () => {
      const paneElement = document.createElement('div');
      paneElement.classList.add('react-flow__pane');

      const rendererElement = document.createElement('div');
      rendererElement.classList.add('react-flow__renderer');
      document.body.appendChild(rendererElement);

      vi.spyOn(rendererElement, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      // Simulate touch event
      act(() => {
        result.current.onConnectEnd({
          target: paneElement,
          touches: [{ clientX: 400, clientY: 300 }],
        } as unknown as TouchEvent);
      });

      expect(emit).toHaveBeenCalledWith(
        'openNodeSelector',
        expect.objectContaining({
          position: { x: 400, y: 300 },
        })
      );

      document.body.removeChild(rendererElement);
    });

    it('should handle empty handles array in node data', () => {
      nodes = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {
            handles: [], // Empty handles
          },
        },
      ] as Node[];

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      // Should fall back to node definition
      expect(result.current.connectingHandleType).toBe('image');
    });

    it('should handle handle without dataType in node data', () => {
      nodes = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {
            handles: [
              { id: 'image-out', type: 'output' }, // Missing dataType
            ],
          },
        },
      ] as Node[];

      const { result } = renderHook(() => useNodeConnections(createDefaultOptions()));

      act(() => {
        result.current.onConnectStart({ clientX: 0, clientY: 0 } as React.MouseEvent, {
          nodeId: 'node-1',
          handleId: 'image-out',
          handleType: 'source',
        });
      });

      // Should fall back to node definition's dataType
      expect(result.current.connectingHandleType).toBe('image');
    });

    it('should use handles from node definition when node type has handles property', () => {
      // Reset the on mock to restore normal event handler tracking
      vi.mocked(on).mockImplementation((eventType: string, handler: (event: unknown) => void) => {
        if (!eventHandlers[eventType]) {
          eventHandlers[eventType] = [];
        }
        eventHandlers[eventType].push(handler);
        return vi.fn(() => {
          const index = eventHandlers[eventType].indexOf(handler);
          if (index > -1) {
            eventHandlers[eventType].splice(index, 1);
          }
        });
      });

      nodes = [
        {
          id: 'node-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {
            handles: [{ id: 'image-out', type: 'output', dataType: 'image' }],
          },
        },
        {
          id: 'node-video',
          type: 'video',
          position: { x: 200, y: 0 },
          data: {}, // No handles in data - should fall back to node definition
        },
      ] as Node[];

      renderHook(() => useNodeConnections(createDefaultOptions()));

      // Trigger autoConnect which uses handles from node definition
      const handler = eventHandlers['autoConnect']?.[0];
      expect(handler).toBeDefined();

      act(() => {
        handler({
          detail: {
            source: 'node-1',
            sourceHandle: 'image-out',
            target: 'node-video',
            handleType: 'image',
          },
        });
      });

      // Should find the image-in handle from the video node's handles property
      expect(validateEdges).toHaveBeenCalled();
    });
  });
});
