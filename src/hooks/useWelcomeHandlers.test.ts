import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWelcomeHandlers, type WelcomeHandlersConfig } from './useWelcomeHandlers';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '../utils/eventBus';
import { buildWorkflowDocument } from '../utils/workflowSchema';
import { applyTemplate } from '../utils/workflowTemplates';
import { markEdgeGlows } from '../utils/workflowHelpers';
import type { Workflow } from './useWorkflowPersistence';
import type { WorkflowTemplate } from '../utils/workflowTemplates';
import type { Node, Edge } from 'reactflow';

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('reactflow', () => ({
  useUpdateNodeInternals: () => vi.fn(),
}));

vi.mock('../utils/eventBus', () => ({
  emit: vi.fn(),
}));

vi.mock('../utils/workflowSchema', () => ({
  buildWorkflowDocument: vi.fn((input) => ({
    id: input.id,
    name: input.name,
    nodes: input.nodes || [],
    edges: input.edges || [],
    metadata: { name: input.name },
  })),
}));

vi.mock('../utils/workflowTemplates', () => ({
  applyTemplate: vi.fn((template, handleRemove) => ({
    nodes:
      template?.nodes?.map((n: Node) => ({ ...n, data: { ...n.data, onRemove: handleRemove } })) ||
      [],
    edges: template?.edges || [],
  })),
}));

vi.mock('../utils/workflowHelpers', () => ({
  markEdgeGlows: vi.fn((edges) =>
    edges.map((e: Edge) => ({
      ...e,
      data: { ...e.data, showSourceGlow: true, showTargetGlow: true },
    }))
  ),
}));

vi.mock('../utils/workflowId', () => ({
  toSafeWorkflowId: vi.fn((name) => name?.replace(/\s+/g, '-').toLowerCase() || 'workflow'),
}));

describe('useWelcomeHandlers', () => {
  let setShowWelcome: ReturnType<typeof vi.fn>;
  let setWelcomePinned: ReturnType<typeof vi.fn>;
  let setHideEmptyHint: ReturnType<typeof vi.fn>;
  let setSidebarOpen: ReturnType<typeof vi.fn>;
  let setNodes: ReturnType<typeof vi.fn>;
  let setEdges: ReturnType<typeof vi.fn>;
  let loadWorkflow: ReturnType<typeof vi.fn>;
  let handleRemoveNode: ReturnType<typeof vi.fn>;
  let openNodeSelectorAt: ReturnType<typeof vi.fn>;
  let mockReactFlowInstance: {
    setViewport: ReturnType<typeof vi.fn>;
    fitView: ReturnType<typeof vi.fn>;
  };
  let config: WelcomeHandlersConfig;
  let originalRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock requestAnimationFrame for synchronous testing
    originalRaf = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };

    setShowWelcome = vi.fn();
    setWelcomePinned = vi.fn();
    setHideEmptyHint = vi.fn();
    setSidebarOpen = vi.fn();
    setNodes = vi.fn();
    setEdges = vi.fn();
    loadWorkflow = vi.fn().mockResolvedValue(undefined);
    handleRemoveNode = vi.fn().mockResolvedValue(undefined);
    openNodeSelectorAt = vi.fn();
    mockReactFlowInstance = {
      setViewport: vi.fn(),
      fitView: vi.fn(),
    };

    config = {
      setShowWelcome,
      setWelcomePinned,
      setHideEmptyHint,
      setSidebarOpen,
      setNodes,
      setEdges,
      loadWorkflow,
      handleRemoveNode,
      reactFlowInstance:
        mockReactFlowInstance as unknown as WelcomeHandlersConfig['reactFlowInstance'],
      openNodeSelectorAt,
    };
  });

  afterEach(() => {
    global.requestAnimationFrame = originalRaf;
  });

  // ==========================================================================
  // handleCreateWorkflowFromWelcome tests
  // ==========================================================================

  describe('handleCreateWorkflowFromWelcome', () => {
    it('should hide welcome screen when creating workflow', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]); // list_workflows
      vi.mocked(invoke).mockResolvedValueOnce(undefined); // save_workflow

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      expect(setShowWelcome).toHaveBeenCalledWith(false);
    });

    it('should unpin welcome when creating workflow', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      expect(setWelcomePinned).toHaveBeenCalledWith(false);
    });

    it('should use default name when no name provided', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      expect(buildWorkflowDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Untitled Workflow',
        })
      );
    });

    it('should use provided workflow name', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome('My Awesome Workflow');
      });

      expect(buildWorkflowDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Awesome Workflow',
        })
      );
    });

    it('should trim provided workflow name', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome('  Padded Name  ');
      });

      expect(buildWorkflowDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Padded Name',
        })
      );
    });

    it('should generate unique workflow name when duplicate exists', async () => {
      const existingWorkflows: Workflow[] = [
        { id: 'untitled-workflow', name: 'Untitled Workflow' },
      ];
      vi.mocked(invoke).mockResolvedValueOnce(existingWorkflows);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      expect(buildWorkflowDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Untitled Workflow 2',
        })
      );
    });

    it('should generate unique name with higher counter when multiple duplicates exist', async () => {
      const existingWorkflows: Workflow[] = [
        { id: 'untitled-workflow', name: 'Untitled Workflow' },
        { id: 'untitled-workflow-2', name: 'Untitled Workflow 2' },
        { id: 'untitled-workflow-3', name: 'Untitled Workflow 3' },
      ];
      vi.mocked(invoke).mockResolvedValueOnce(existingWorkflows);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      expect(buildWorkflowDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Untitled Workflow 4',
        })
      );
    });

    it('should generate unique name for custom workflow name with duplicates', async () => {
      const existingWorkflows: Workflow[] = [{ id: 'my-project', name: 'My Project' }];
      vi.mocked(invoke).mockResolvedValueOnce(existingWorkflows);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome('My Project');
      });

      expect(buildWorkflowDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Project 2',
        })
      );
    });

    it('should save workflow via invoke', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome('Test Workflow');
      });

      expect(invoke).toHaveBeenCalledWith(
        'save_workflow',
        expect.objectContaining({
          name: 'Test Workflow',
        })
      );
    });

    it('should call loadWorkflow with new workflow', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome('New Workflow');
      });

      expect(loadWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Workflow',
        })
      );
    });

    it('should reset viewport after creating workflow', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      expect(mockReactFlowInstance.setViewport).toHaveBeenCalledWith(
        { x: 0, y: 0, zoom: 1 },
        { duration: 500 }
      );
    });

    it('should handle error when listing workflows fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValueOnce(new Error('List failed'));
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to list workflows:', expect.any(Error));
      // Should still create workflow with default name
      expect(loadWorkflow).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle error when saving workflow fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Save failed'));

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to create workflow:', expect.any(Error));
      // loadWorkflow should still be called
      expect(loadWorkflow).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle null reactFlowInstance gracefully', async () => {
      const configWithoutInstance = { ...config, reactFlowInstance: null };
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(configWithoutInstance));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      // Should not throw and should still complete
      expect(loadWorkflow).toHaveBeenCalled();
      expect(mockReactFlowInstance.setViewport).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // handleBuildWithAI tests
  // ==========================================================================

  describe('handleBuildWithAI', () => {
    it('should hide welcome screen', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleBuildWithAI();
      });

      expect(setShowWelcome).toHaveBeenCalledWith(false);
    });

    it('should unpin welcome', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleBuildWithAI();
      });

      expect(setWelcomePinned).toHaveBeenCalledWith(false);
    });

    it('should hide empty hint', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleBuildWithAI();
      });

      expect(setHideEmptyHint).toHaveBeenCalledWith(true);
    });

    it('should emit assistantOpen event', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleBuildWithAI();
      });

      expect(emit).toHaveBeenCalledWith('assistantOpen');
    });

    it('should emit event exactly once', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleBuildWithAI();
      });

      expect(emit).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // handleStartFromScratch tests
  // ==========================================================================

  describe('handleStartFromScratch', () => {
    it('should hide welcome screen', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleStartFromScratch();
      });

      expect(setShowWelcome).toHaveBeenCalledWith(false);
    });

    it('should unpin welcome', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleStartFromScratch();
      });

      expect(setWelcomePinned).toHaveBeenCalledWith(false);
    });

    it('should hide empty hint', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleStartFromScratch();
      });

      expect(setHideEmptyHint).toHaveBeenCalledWith(true);
    });

    it('should open node selector', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleStartFromScratch();
      });

      expect(openNodeSelectorAt).toHaveBeenCalled();
    });

    it('should pass event to openNodeSelectorAt', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));
      const mockEvent = { clientX: 100, clientY: 200 } as React.MouseEvent<HTMLButtonElement>;

      act(() => {
        result.current.handleStartFromScratch(mockEvent);
      });

      expect(openNodeSelectorAt).toHaveBeenCalledWith(mockEvent);
    });

    it('should work without event argument', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleStartFromScratch();
      });

      expect(openNodeSelectorAt).toHaveBeenCalledWith(undefined);
    });
  });

  // ==========================================================================
  // handleLoadWorkflowFromWelcome tests
  // ==========================================================================

  describe('handleLoadWorkflowFromWelcome', () => {
    it('should hide welcome screen', async () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome();
      });

      expect(setShowWelcome).toHaveBeenCalledWith(false);
    });

    it('should unpin welcome', async () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome();
      });

      expect(setWelcomePinned).toHaveBeenCalledWith(false);
    });

    it('should open sidebar when no workflow provided', async () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome();
      });

      expect(setSidebarOpen).toHaveBeenCalledWith(true);
    });

    it('should open sidebar when workflow without id provided', async () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));
      const workflowWithoutId = { name: 'Test' } as Workflow;

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome(workflowWithoutId);
      });

      expect(setSidebarOpen).toHaveBeenCalledWith(true);
    });

    it('should load workflow by id when workflow has id', async () => {
      const mockWorkflowData = {
        data: {
          id: 'test-workflow',
          name: 'Test Workflow',
          nodes: [],
          edges: [],
        },
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockWorkflowData);

      const { result } = renderHook(() => useWelcomeHandlers(config));
      const workflow: Workflow = { id: 'test-workflow', name: 'Test Workflow' };

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome(workflow);
      });

      expect(invoke).toHaveBeenCalledWith('load_workflow', { id: 'test-workflow' });
    });

    it('should call loadWorkflow with fetched data', async () => {
      const mockWorkflowData = {
        data: {
          id: 'test-workflow',
          name: 'Test Workflow',
          nodes: [{ id: 'node-1' }],
          edges: [],
        },
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockWorkflowData);

      const { result } = renderHook(() => useWelcomeHandlers(config));
      const workflow: Workflow = { id: 'test-workflow', name: 'Test Workflow' };

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome(workflow);
      });

      expect(loadWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-workflow',
          name: 'Test Workflow',
        })
      );
    });

    it('should handle workflow data without wrapper', async () => {
      const mockWorkflowData = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: [],
        edges: [],
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockWorkflowData);

      const { result } = renderHook(() => useWelcomeHandlers(config));
      const workflow: Workflow = { id: 'test-workflow', name: 'Test Workflow' };

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome(workflow);
      });

      expect(loadWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-workflow',
          data: mockWorkflowData,
        })
      );
    });

    it('should open sidebar on load error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Load failed'));

      const { result } = renderHook(() => useWelcomeHandlers(config));
      const workflow: Workflow = { id: 'test-workflow', name: 'Test Workflow' };

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome(workflow);
      });

      expect(setSidebarOpen).toHaveBeenCalledWith(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load workflow from welcome screen:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('should not call loadWorkflow when load fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Load failed'));

      const { result } = renderHook(() => useWelcomeHandlers(config));
      const workflow: Workflow = { id: 'test-workflow', name: 'Test Workflow' };

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome(workflow);
      });

      expect(loadWorkflow).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // handleLoadTemplate tests
  // ==========================================================================

  describe('handleLoadTemplate', () => {
    const mockTemplate: WorkflowTemplate = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test template',
      icon: 'test',
      category: 'beginner',
      nodes: [
        { id: 'node-1', type: 'image', position: { x: 0, y: 0 }, data: { prompt: 'test' } },
        { id: 'node-2', type: 'text', position: { x: 100, y: 0 }, data: { content: 'hello' } },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'out',
          targetHandle: 'in',
        },
      ],
    };

    it('should hide welcome screen', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      expect(setShowWelcome).toHaveBeenCalledWith(false);
    });

    it('should unpin welcome', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      expect(setWelcomePinned).toHaveBeenCalledWith(false);
    });

    it('should clear existing nodes', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      expect(setNodes).toHaveBeenCalledWith([]);
    });

    it('should clear existing edges', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      expect(setEdges).toHaveBeenCalledWith([]);
    });

    it('should call applyTemplate with template and handleRemoveNode', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      expect(applyTemplate).toHaveBeenCalledWith(mockTemplate, handleRemoveNode);
    });

    it('should set nodes from template', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      // setNodes is called twice: once to clear, once to set template nodes
      expect(setNodes).toHaveBeenCalledTimes(2);
      expect(setNodes).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'node-1' }),
          expect.objectContaining({ id: 'node-2' }),
        ])
      );
    });

    it('should set edges with glow markers', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      expect(markEdgeGlows).toHaveBeenCalled();
      // setEdges is called twice: once to clear, once to set template edges
      expect(setEdges).toHaveBeenCalledTimes(2);
    });

    it('should call fitView on reactFlowInstance', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      expect(mockReactFlowInstance.fitView).toHaveBeenCalledWith({ padding: 0.2, duration: 800 });
    });

    it('should handle template with no edges', () => {
      const templateNoEdges: WorkflowTemplate = {
        ...mockTemplate,
        edges: [],
      };

      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(templateNoEdges);
      });

      expect(markEdgeGlows).toHaveBeenCalledWith([]);
    });

    it('should handle template with no nodes', () => {
      const templateNoNodes: WorkflowTemplate = {
        ...mockTemplate,
        nodes: [],
      };

      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(templateNoNodes);
      });

      // Should still work without throwing
      expect(setNodes).toHaveBeenCalled();
    });

    it('should handle null reactFlowInstance gracefully', () => {
      const configWithoutInstance = { ...config, reactFlowInstance: null };
      const { result } = renderHook(() => useWelcomeHandlers(configWithoutInstance));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      // Should not throw
      expect(mockReactFlowInstance.fitView).not.toHaveBeenCalled();
    });

    it('should add onRemove callback to template nodes', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleLoadTemplate(mockTemplate);
      });

      expect(applyTemplate).toHaveBeenCalledWith(mockTemplate, handleRemoveNode);
    });
  });

  // ==========================================================================
  // Hook stability tests
  // ==========================================================================

  describe('hook stability', () => {
    it('should return stable handleCreateWorkflowFromWelcome reference', () => {
      const { result, rerender } = renderHook(() => useWelcomeHandlers(config));

      const first = result.current.handleCreateWorkflowFromWelcome;
      rerender();
      const second = result.current.handleCreateWorkflowFromWelcome;

      expect(first).toBe(second);
    });

    it('should return stable handleBuildWithAI reference', () => {
      const { result, rerender } = renderHook(() => useWelcomeHandlers(config));

      const first = result.current.handleBuildWithAI;
      rerender();
      const second = result.current.handleBuildWithAI;

      expect(first).toBe(second);
    });

    it('should return stable handleStartFromScratch reference', () => {
      const { result, rerender } = renderHook(() => useWelcomeHandlers(config));

      const first = result.current.handleStartFromScratch;
      rerender();
      const second = result.current.handleStartFromScratch;

      expect(first).toBe(second);
    });

    it('should return stable handleLoadWorkflowFromWelcome reference', () => {
      const { result, rerender } = renderHook(() => useWelcomeHandlers(config));

      const first = result.current.handleLoadWorkflowFromWelcome;
      rerender();
      const second = result.current.handleLoadWorkflowFromWelcome;

      expect(first).toBe(second);
    });

    it('should return handleLoadTemplate function on each render', () => {
      // Note: handleLoadTemplate may not be referentially stable due to its dependencies
      // (handleRemoveNode, reactFlowInstance, setShowWelcome, etc.)
      // This test verifies the function exists and is callable
      const { result, rerender } = renderHook(() => useWelcomeHandlers(config));

      const first = result.current.handleLoadTemplate;
      expect(typeof first).toBe('function');

      rerender();
      const second = result.current.handleLoadTemplate;
      expect(typeof second).toBe('function');
    });
  });

  // ==========================================================================
  // Return value tests
  // ==========================================================================

  describe('return value', () => {
    it('should return all handler functions', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      expect(result.current).toHaveProperty('handleCreateWorkflowFromWelcome');
      expect(result.current).toHaveProperty('handleBuildWithAI');
      expect(result.current).toHaveProperty('handleStartFromScratch');
      expect(result.current).toHaveProperty('handleLoadWorkflowFromWelcome');
      expect(result.current).toHaveProperty('handleLoadTemplate');
    });

    it('should return functions with correct types', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      expect(typeof result.current.handleCreateWorkflowFromWelcome).toBe('function');
      expect(typeof result.current.handleBuildWithAI).toBe('function');
      expect(typeof result.current.handleStartFromScratch).toBe('function');
      expect(typeof result.current.handleLoadWorkflowFromWelcome).toBe('function');
      expect(typeof result.current.handleLoadTemplate).toBe('function');
    });
  });

  // ==========================================================================
  // Edge cases and error handling
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty string workflow name', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome('');
      });

      expect(buildWorkflowDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Untitled Workflow',
        })
      );
    });

    it('should handle whitespace-only workflow name', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome('   ');
      });

      expect(buildWorkflowDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Untitled Workflow',
        })
      );
    });

    it('should handle non-array response from list_workflows', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(null);
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleCreateWorkflowFromWelcome();
      });

      // Should not throw and should use default name
      expect(buildWorkflowDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Untitled Workflow',
        })
      );
    });

    it('should handle undefined workflow in handleLoadWorkflowFromWelcome', async () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome(undefined);
      });

      expect(setSidebarOpen).toHaveBeenCalledWith(true);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should handle workflow with empty id in handleLoadWorkflowFromWelcome', async () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));
      const workflowEmptyId: Workflow = { id: '', name: 'Test' };

      await act(async () => {
        await result.current.handleLoadWorkflowFromWelcome(workflowEmptyId);
      });

      expect(setSidebarOpen).toHaveBeenCalledWith(true);
    });
  });

  // ==========================================================================
  // Integration-like tests
  // ==========================================================================

  describe('handler sequences', () => {
    it('should handle rapid successive handleBuildWithAI calls', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleBuildWithAI();
        result.current.handleBuildWithAI();
        result.current.handleBuildWithAI();
      });

      expect(setShowWelcome).toHaveBeenCalledTimes(3);
      expect(emit).toHaveBeenCalledTimes(3);
    });

    it('should handle switching from build with AI to start from scratch', () => {
      const { result } = renderHook(() => useWelcomeHandlers(config));

      act(() => {
        result.current.handleBuildWithAI();
      });

      act(() => {
        result.current.handleStartFromScratch();
      });

      expect(setShowWelcome).toHaveBeenCalledTimes(2);
      expect(emit).toHaveBeenCalledTimes(1);
      expect(openNodeSelectorAt).toHaveBeenCalledTimes(1);
    });
  });
});
