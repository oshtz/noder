import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowRunner } from './useWorkflowRunner';
import type { Node, Edge } from 'reactflow';

// Mock workflowExecutor
vi.mock('../utils/workflowExecutor', () => ({
  executeWorkflow: vi.fn(() =>
    Promise.resolve({
      success: true,
      duration: 1000,
      completedCount: 2,
      nodeOutputs: { 'node-1': 'output1', 'node-2': 'output2' },
    })
  ),
}));

// Mock database
vi.mock('../utils/database', () => ({
  saveOutput: vi.fn(() => Promise.resolve('saved-id-123')),
}));

// Mock workflowHelpers
vi.mock('../utils/workflowHelpers', () => ({
  getPrimaryOutput: vi.fn((output) => {
    if (output === null || output === undefined) return null;
    return { value: output, metadata: { model: 'test-model' } };
  }),
  persistOutputToLocal: vi.fn((value) => Promise.resolve(value)),
  getOutputTypeFromNodeType: vi.fn((type) => {
    if (type === 'image') return 'image';
    if (type === 'text') return 'text';
    if (type === 'video') return 'video';
    return 'unknown';
  }),
}));

// Mock constants
vi.mock('../constants/app', () => ({
  PREVIEW_NODE_TYPES: new Set(['image', 'text', 'video']),
}));

// Mock settings store
vi.mock('../stores/useSettingsStore', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      openaiApiKey: 'test-openai-key',
      anthropicApiKey: 'test-anthropic-key',
      replicateApiKey: 'test-replicate-key',
    };
    return selector(state);
  }),
}));

describe('useWorkflowRunner', () => {
  let mockSetNodes: ReturnType<typeof vi.fn>;
  let mockSetEdges: ReturnType<typeof vi.fn>;
  let mockSetValidationErrors: ReturnType<typeof vi.fn>;
  let mockSetWorkflowOutputs: ReturnType<typeof vi.fn>;
  let mockSetIsProcessing: ReturnType<typeof vi.fn>;
  let mockSetCurrentWorkflowId: ReturnType<typeof vi.fn>;
  let mockSetFailedNodes: ReturnType<typeof vi.fn>;
  let mockSetShowErrorRecovery: ReturnType<typeof vi.fn>;
  let mockAppendWorkflowHistory: ReturnType<typeof vi.fn>;
  let executionStateRef: {
    current: {
      nodeOutputs: Record<string, unknown>;
      scopeNodeIds: string[];
      failedNodeIds: string[];
    };
  };
  let nodeTimingsRef: { current: Record<string, number> };

  const createTestNodes = (count: number = 3): Node[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `node-${i + 1}`,
      type: i === 0 ? 'text' : i === 1 ? 'image' : 'video',
      position: { x: i * 200, y: 0 },
      data: { label: `Node ${i + 1}`, prompt: `Prompt ${i + 1}` },
    }));

  const createTestEdges = (): Edge[] => [
    { id: 'edge-1', source: 'node-1', target: 'node-2' },
    { id: 'edge-2', source: 'node-2', target: 'node-3' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSetNodes = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater([]);
      }
      return updater;
    });
    mockSetEdges = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater([]);
      }
      return updater;
    });
    mockSetValidationErrors = vi.fn();
    mockSetWorkflowOutputs = vi.fn();
    mockSetIsProcessing = vi.fn();
    mockSetCurrentWorkflowId = vi.fn();
    mockSetFailedNodes = vi.fn();
    mockSetShowErrorRecovery = vi.fn();
    mockAppendWorkflowHistory = vi.fn();

    executionStateRef = {
      current: {
        nodeOutputs: {},
        scopeNodeIds: [],
        failedNodeIds: [],
      },
    };
    nodeTimingsRef = { current: {} };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderHookWithDefaults = (
    nodes: Node[] = createTestNodes(),
    edges: Edge[] = createTestEdges(),
    isProcessing: boolean = false
  ) => {
    return renderHook(() =>
      useWorkflowRunner({
        nodes,
        edges,
        setNodes: mockSetNodes,
        setEdges: mockSetEdges,
        setValidationErrors: mockSetValidationErrors,
        setWorkflowOutputs: mockSetWorkflowOutputs,
        isProcessing,
        executionStateRef,
        nodeTimingsRef,
        setIsProcessing: mockSetIsProcessing,
        setCurrentWorkflowId: mockSetCurrentWorkflowId,
        setFailedNodes: mockSetFailedNodes,
        setShowErrorRecovery: mockSetShowErrorRecovery,
        activeWorkflow: { id: 'test-workflow', name: 'Test Workflow' },
        workflowMetadata: { name: 'Test Workflow' },
        appendWorkflowHistory: mockAppendWorkflowHistory,
      })
    );
  };

  describe('getExecutionScope', () => {
    it('should return all nodes and edges when targetNodeIds is null', () => {
      const nodes = createTestNodes(3);
      const edges = createTestEdges();
      const { result } = renderHookWithDefaults(nodes, edges);

      const scope = result.current.getExecutionScope(null);

      expect(scope.nodes).toHaveLength(3);
      expect(scope.edges).toHaveLength(2);
    });

    it('should return all nodes and edges when targetNodeIds is empty array', () => {
      const nodes = createTestNodes(3);
      const edges = createTestEdges();
      const { result } = renderHookWithDefaults(nodes, edges);

      const scope = result.current.getExecutionScope([]);

      expect(scope.nodes).toHaveLength(3);
      expect(scope.edges).toHaveLength(2);
    });

    it('should return target node and its upstream dependencies', () => {
      const nodes = createTestNodes(3);
      const edges = createTestEdges();
      const { result } = renderHookWithDefaults(nodes, edges);

      // If we target node-3, we should get node-1, node-2, and node-3
      // because node-3 depends on node-2 which depends on node-1
      const scope = result.current.getExecutionScope(['node-3']);

      expect(scope.nodes.map((n) => n.id).sort()).toEqual(['node-1', 'node-2', 'node-3']);
    });

    it('should return only target node if it has no dependencies', () => {
      const nodes = createTestNodes(3);
      const edges = createTestEdges();
      const { result } = renderHookWithDefaults(nodes, edges);

      // node-1 has no upstream dependencies
      const scope = result.current.getExecutionScope(['node-1']);

      expect(scope.nodes).toHaveLength(1);
      expect(scope.nodes[0].id).toBe('node-1');
    });

    it('should return multiple target nodes and their dependencies', () => {
      const nodes = [
        { id: 'a', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'b', type: 'text', position: { x: 100, y: 0 }, data: {} },
        { id: 'c', type: 'image', position: { x: 200, y: 0 }, data: {} },
        { id: 'd', type: 'video', position: { x: 300, y: 0 }, data: {} },
      ] as Node[];
      const edges: Edge[] = [
        { id: 'e1', source: 'a', target: 'c' },
        { id: 'e2', source: 'b', target: 'd' },
      ];
      const { result } = renderHookWithDefaults(nodes, edges);

      // Target both c and d - should get a, b, c, d
      const scope = result.current.getExecutionScope(['c', 'd']);

      expect(scope.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should handle nodes with no edges', () => {
      const nodes = createTestNodes(3);
      const { result } = renderHookWithDefaults(nodes, []);

      const scope = result.current.getExecutionScope(['node-2']);

      expect(scope.nodes).toHaveLength(1);
      expect(scope.nodes[0].id).toBe('node-2');
      expect(scope.edges).toHaveLength(0);
    });

    it('should handle diamond dependency pattern', () => {
      const nodes = [
        { id: 'root', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'left', type: 'text', position: { x: 100, y: 100 }, data: {} },
        { id: 'right', type: 'text', position: { x: 200, y: 100 }, data: {} },
        { id: 'bottom', type: 'image', position: { x: 150, y: 200 }, data: {} },
      ] as Node[];
      const edges: Edge[] = [
        { id: 'e1', source: 'root', target: 'left' },
        { id: 'e2', source: 'root', target: 'right' },
        { id: 'e3', source: 'left', target: 'bottom' },
        { id: 'e4', source: 'right', target: 'bottom' },
      ];
      const { result } = renderHookWithDefaults(nodes, edges);

      const scope = result.current.getExecutionScope(['bottom']);

      expect(scope.nodes.map((n) => n.id).sort()).toEqual(['bottom', 'left', 'right', 'root']);
    });
  });

  describe('runWorkflow', () => {
    it('should not run if already processing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHookWithDefaults(createTestNodes(), createTestEdges(), true);

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(consoleSpy).toHaveBeenCalledWith('[Workflow] Workflow is already running');
      expect(mockSetIsProcessing).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not run if no nodes in scope', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHookWithDefaults([], []);

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Workflow] No nodes to execute for the requested scope'
      );
      consoleSpy.mockRestore();
    });

    it('should set isProcessing to true during execution', async () => {
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(mockSetIsProcessing).toHaveBeenCalledWith(true);
    });

    it('should set isProcessing to false after execution', async () => {
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(mockSetIsProcessing).toHaveBeenCalledWith(false);
    });

    it('should set currentWorkflowId during execution', async () => {
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(mockSetCurrentWorkflowId).toHaveBeenCalledWith(
        expect.stringMatching(/^workflow-\d+$/)
      );
    });

    it('should clear currentWorkflowId after execution', async () => {
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(mockSetCurrentWorkflowId).toHaveBeenCalledWith(null);
    });

    it('should append to workflow history after execution', async () => {
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(mockAppendWorkflowHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Workflow',
          timestamp: expect.any(Number),
        })
      );
    });

    it('should reset execution state if not resuming', async () => {
      executionStateRef.current = {
        nodeOutputs: { existing: 'output' },
        scopeNodeIds: ['existing-node'],
        failedNodeIds: ['failed-node'],
      };

      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow({ resume: false });
      });

      // The execution state is updated during execution
      // After success, it should be cleared
      expect(executionStateRef.current.nodeOutputs).toEqual({});
    });

    it('should use execution state if resuming', async () => {
      executionStateRef.current = {
        nodeOutputs: { 'node-1': 'existing-output' },
        scopeNodeIds: ['node-1', 'node-2'],
        failedNodeIds: [],
      };

      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow({ resume: true });
      });

      // Workflow should have been called
      const { executeWorkflow } = await import('../utils/workflowExecutor');
      expect(executeWorkflow).toHaveBeenCalled();
    });

    it('should call setNodes to clear processing/error classes at start', async () => {
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should pass correct context to executeWorkflow', async () => {
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      const { executeWorkflow } = await import('../utils/workflowExecutor');
      expect(executeWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            openaiApiKey: 'test-openai-key',
            anthropicApiKey: 'test-anthropic-key',
            replicateApiKey: 'test-replicate-key',
          },
        })
      );
    });

    it('should handle workflow error and add validation error', async () => {
      const { executeWorkflow } = await import('../utils/workflowExecutor');
      vi.mocked(executeWorkflow).mockRejectedValueOnce(new Error('Test error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(mockSetValidationErrors).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should execute only target nodes and their dependencies', async () => {
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow({ targetNodeIds: ['node-2'] });
      });

      const { executeWorkflow } = await import('../utils/workflowExecutor');
      expect(executeWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: 'node-1' }),
            expect.objectContaining({ id: 'node-2' }),
          ]),
        })
      );
    });

    it('should handle continueOnError option', async () => {
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow({ continueOnError: true });
      });

      const { executeWorkflow } = await import('../utils/workflowExecutor');
      expect(executeWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          continueOnError: true,
        })
      );
    });

    it('should handle skipFailed option', async () => {
      executionStateRef.current = {
        nodeOutputs: {},
        scopeNodeIds: ['node-1', 'node-2', 'node-3'],
        failedNodeIds: ['node-2'],
      };

      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow({ resume: true, skipFailed: true });
      });

      const { executeWorkflow } = await import('../utils/workflowExecutor');
      expect(executeWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          skipNodeIds: ['node-2'],
        })
      );
    });

    it('should handle retryFailed option', async () => {
      executionStateRef.current = {
        nodeOutputs: { 'node-1': 'output1' },
        scopeNodeIds: ['node-1', 'node-2', 'node-3'],
        failedNodeIds: ['node-2'],
      };

      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow({ resume: true, retryFailed: true });
      });

      const { executeWorkflow } = await import('../utils/workflowExecutor');
      // When retrying failed nodes, their outputs should be cleared
      expect(executeWorkflow).toHaveBeenCalled();
    });

    it('should handle retryNodeIds option', async () => {
      executionStateRef.current = {
        nodeOutputs: { 'node-1': 'output1', 'node-2': 'output2' },
        scopeNodeIds: ['node-1', 'node-2', 'node-3'],
        failedNodeIds: [],
      };

      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow({ resume: true, retryNodeIds: ['node-2'] });
      });

      const { executeWorkflow } = await import('../utils/workflowExecutor');
      expect(executeWorkflow).toHaveBeenCalled();
    });
  });

  describe('return value', () => {
    it('should return runWorkflow function', () => {
      const { result } = renderHookWithDefaults();
      expect(typeof result.current.runWorkflow).toBe('function');
    });

    it('should return getExecutionScope function', () => {
      const { result } = renderHookWithDefaults();
      expect(typeof result.current.getExecutionScope).toBe('function');
    });
  });

  describe('workflow callbacks', () => {
    it('should call onNodeStart callback during execution', async () => {
      const { executeWorkflow } = await import('../utils/workflowExecutor');
      vi.mocked(executeWorkflow).mockImplementation(async (options) => {
        // Simulate calling onNodeStart
        if (options.onNodeStart) {
          options.onNodeStart({ id: 'node-1', type: 'text', data: {} });
        }
        return { success: true, duration: 100, completedCount: 1, nodeOutputs: {} };
      });

      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      // setNodes should be called to mark node as processing
      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should call onNodeComplete callback during execution', async () => {
      const { executeWorkflow } = await import('../utils/workflowExecutor');
      vi.mocked(executeWorkflow).mockImplementation(async (options) => {
        if (options.onNodeComplete) {
          options.onNodeComplete(
            { id: 'node-1', type: 'image', data: {} },
            'https://example.com/image.png'
          );
        }
        return { success: true, duration: 100, completedCount: 1, nodeOutputs: {} };
      });

      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      // setNodes should be called to update node output
      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should call onNodeError callback during execution', async () => {
      const { executeWorkflow } = await import('../utils/workflowExecutor');
      vi.mocked(executeWorkflow).mockImplementation(async (options) => {
        if (options.onNodeError) {
          options.onNodeError(
            { id: 'node-1', type: 'text', data: {} },
            new Error('Node execution failed')
          );
        }
        return {
          success: false,
          error: 'Node execution failed',
          duration: 100,
          completedCount: 0,
          nodeOutputs: {},
        };
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow({ continueOnError: true });
      });

      // setFailedNodes should be called
      expect(mockSetFailedNodes).toHaveBeenCalled();
      expect(mockSetShowErrorRecovery).toHaveBeenCalledWith(true);
      consoleSpy.mockRestore();
    });

    it('should call onProgress callback during execution', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { executeWorkflow } = await import('../utils/workflowExecutor');
      vi.mocked(executeWorkflow).mockImplementation(async (options) => {
        if (options.onProgress) {
          options.onProgress({ percentage: 50, completed: 1, total: 2 });
        }
        return { success: true, duration: 100, completedCount: 2, nodeOutputs: {} };
      });

      const { result } = renderHookWithDefaults();

      await act(async () => {
        await result.current.runWorkflow();
      });

      expect(consoleSpy).toHaveBeenCalledWith('[Workflow] Progress: 50% (1/2)');
      consoleSpy.mockRestore();
    });
  });
});
