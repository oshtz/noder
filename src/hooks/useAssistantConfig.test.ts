import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAssistantConfig } from './useAssistantConfig';
import type { Node, Edge, ReactFlowInstance } from 'reactflow';
import type { WorkflowTemplate } from '../utils/workflowTemplates';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../nodes', () => ({
  nodeDefinitions: [
    { type: 'text', label: 'Text (LLM)', description: 'Generate text using LLM' },
    { type: 'image', label: 'Image', description: 'Generate images' },
    { type: 'video', label: 'Video', description: 'Generate videos' },
    { type: 'audio', label: 'Audio', description: 'Generate audio' },
    { type: 'upscaler', label: 'Upscaler', description: 'Upscale images' },
    { type: 'media', label: 'Media', description: 'Display media' },
    { type: 'chip', label: 'Chip', description: 'Reusable value' },
    { type: 'display-text', label: 'Display Text', description: 'Display text output' },
    { type: 'markdown', label: 'Markdown', description: 'Render markdown' },
    { type: 'group', label: 'Group', description: 'Group nodes together' },
    { type: 'disallowed', label: 'Disallowed', description: 'Not allowed type' },
  ],
  nodeTypes: {
    text: { component: () => null, defaultData: { handles: [{ id: 'in', type: 'input' }] } },
    image: { component: () => null, defaultData: { handles: [{ id: 'in', type: 'input' }] } },
    video: { component: () => null, defaultData: { handles: [{ id: 'in', type: 'input' }] } },
    audio: { component: () => null, defaultData: { handles: [{ id: 'in', type: 'input' }] } },
    upscaler: { component: () => null, defaultData: { handles: [{ id: 'in', type: 'input' }] } },
    media: { component: () => null, defaultData: { handles: [{ id: 'out', type: 'output' }] } },
    chip: { component: () => null, defaultData: { handles: [{ id: 'out', type: 'output' }] } },
    'display-text': {
      component: () => null,
      defaultData: { handles: [{ id: 'text-in', type: 'input' }] },
    },
    markdown: {
      component: () => null,
      defaultData: { handles: [{ id: 'text-in', type: 'input' }] },
    },
    group: { component: () => null, defaultData: { handles: [] } },
    disallowed: { component: () => null, defaultData: { handles: [] } },
  },
}));

const mockGetNodeSchema = vi.fn((type: string) => {
  const schemas: Record<string, { type: string; fields: Array<{ key: string; type: string }> }> = {
    text: { type: 'text', fields: [{ key: 'prompt', type: 'textarea' }] },
    image: { type: 'image', fields: [{ key: 'prompt', type: 'textarea' }] },
    video: { type: 'video', fields: [{ key: 'prompt', type: 'textarea' }] },
    audio: { type: 'audio', fields: [{ key: 'prompt', type: 'textarea' }] },
    upscaler: { type: 'upscaler', fields: [{ key: 'scale', type: 'number' }] },
    media: { type: 'media', fields: [{ key: 'mediaPath', type: 'text' }] },
    chip: { type: 'chip', fields: [{ key: 'content', type: 'text' }] },
    'display-text': { type: 'display-text', fields: [] },
    markdown: { type: 'markdown', fields: [] },
  };
  return schemas[type] || null;
});

vi.mock('../nodes/nodeSchemas', () => ({
  getNodeSchema: (type: string) => mockGetNodeSchema(type),
}));

const mockBuildAssistantSystemPrompt = vi.fn(() => 'Mock system prompt');

vi.mock('../utils/assistantPrompt', () => ({
  buildAssistantSystemPrompt: (params: unknown) => mockBuildAssistantSystemPrompt(params),
}));

const mockExecuteToolCall = vi.fn((toolCall: unknown) => ({ success: true, toolCall }));
const mockCreateToolExecutor = vi.fn(() => ({
  executeToolCall: mockExecuteToolCall,
}));

vi.mock('../utils/assistantToolExecutor', () => ({
  createToolExecutor: (config: unknown) => mockCreateToolExecutor(config),
}));

vi.mock('../constants/app', () => ({
  ASSISTANT_ALLOWED_NODE_TYPES: [
    'text',
    'image',
    'upscaler',
    'video',
    'audio',
    'media',
    'chip',
    'display-text',
    'markdown',
  ],
}));

// ============================================================================
// Test Utilities
// ============================================================================

interface CreateMockOptionsParams {
  nodes?: Node[];
  edges?: Edge[];
  reactFlowInstance?: ReactFlowInstance | null;
  workflowTemplates?: WorkflowTemplate[];
}

const createMockOptions = (overrides: CreateMockOptionsParams = {}) => {
  const nodes: Node[] = overrides.nodes ?? [];
  const edges: Edge[] = overrides.edges ?? [];

  return {
    nodes,
    edges,
    nodesRef: { current: nodes },
    edgesRef: { current: edges },
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    setValidationErrors: vi.fn(),
    handleRemoveNode: vi.fn(),
    runWorkflow: vi.fn().mockResolvedValue(undefined),
    reactFlowInstance: overrides.reactFlowInstance ?? null,
    workflowTemplates: overrides.workflowTemplates ?? [],
  };
};

// ============================================================================
// Tests
// ============================================================================

describe('useAssistantConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // assistantNodeDefinitions Tests
  // --------------------------------------------------------------------------

  describe('assistantNodeDefinitions', () => {
    it('should filter node definitions to allowed types only', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      const types = result.current.assistantNodeDefinitions.map((n) => n.type);

      expect(types).toContain('text');
      expect(types).toContain('image');
      expect(types).toContain('video');
      expect(types).toContain('audio');
      expect(types).toContain('upscaler');
      expect(types).toContain('media');
      expect(types).toContain('chip');
      expect(types).toContain('display-text');
      expect(types).toContain('markdown');
      expect(types).not.toContain('group');
      expect(types).not.toContain('disallowed');
    });

    it('should include all allowed node types', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      // Should have exactly 9 allowed types
      expect(result.current.assistantNodeDefinitions).toHaveLength(9);
    });

    it('should preserve node definition properties', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      const textNode = result.current.assistantNodeDefinitions.find((n) => n.type === 'text');
      expect(textNode).toBeDefined();
      expect(textNode?.label).toBe('Text (LLM)');
      expect(textNode?.description).toBe('Generate text using LLM');
    });
  });

  // --------------------------------------------------------------------------
  // assistantNodeSchemas Tests (internal, verified through prompt building)
  // --------------------------------------------------------------------------

  describe('assistantNodeSchemas', () => {
    it('should build schemas from filtered node definitions', () => {
      const options = createMockOptions();
      renderHook(() => useAssistantConfig(options));

      // Verify getNodeSchema was called for allowed types
      expect(mockGetNodeSchema).toHaveBeenCalledWith('text');
      expect(mockGetNodeSchema).toHaveBeenCalledWith('image');
      expect(mockGetNodeSchema).toHaveBeenCalledWith('video');
    });

    it('should not build schemas for disallowed types', () => {
      const options = createMockOptions();
      renderHook(() => useAssistantConfig(options));

      expect(mockGetNodeSchema).not.toHaveBeenCalledWith('group');
      expect(mockGetNodeSchema).not.toHaveBeenCalledWith('disallowed');
    });

    it('should pass schemas to buildAssistantSystemPrompt', () => {
      const options = createMockOptions();
      renderHook(() => useAssistantConfig(options));

      expect(mockBuildAssistantSystemPrompt).toHaveBeenCalled();
      const callArgs = mockBuildAssistantSystemPrompt.mock.calls[0][0] as {
        nodeSchemas: Record<string, unknown>;
      };
      expect(callArgs.nodeSchemas).toBeDefined();
      expect(Object.keys(callArgs.nodeSchemas)).toContain('text');
      expect(Object.keys(callArgs.nodeSchemas)).toContain('image');
    });
  });

  // --------------------------------------------------------------------------
  // assistantNodeTypes Tests (internal, verified through prompt building)
  // --------------------------------------------------------------------------

  describe('assistantNodeTypes', () => {
    it('should filter nodeTypes to allowed types for prompt building', () => {
      const options = createMockOptions();
      renderHook(() => useAssistantConfig(options));

      expect(mockBuildAssistantSystemPrompt).toHaveBeenCalled();
      const callArgs = mockBuildAssistantSystemPrompt.mock.calls[0][0] as {
        nodeTypes: Record<string, unknown>;
      };
      expect(Object.keys(callArgs.nodeTypes)).toContain('text');
      expect(Object.keys(callArgs.nodeTypes)).toContain('image');
      expect(Object.keys(callArgs.nodeTypes)).not.toContain('group');
      expect(Object.keys(callArgs.nodeTypes)).not.toContain('disallowed');
    });
  });

  // --------------------------------------------------------------------------
  // assistantSystemPrompt Tests
  // --------------------------------------------------------------------------

  describe('assistantSystemPrompt', () => {
    it('should build system prompt with correct parameters', () => {
      const templates: WorkflowTemplate[] = [
        { id: 'tpl-1', name: 'Test Template', nodes: [], edges: [] },
      ];
      const options = createMockOptions({ workflowTemplates: templates });
      renderHook(() => useAssistantConfig(options));

      expect(mockBuildAssistantSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeDefinitions: expect.any(Array),
          nodeTypes: expect.any(Object),
          nodeSchemas: expect.any(Object),
          workflowTemplates: templates,
        })
      );
    });

    it('should return the built system prompt', () => {
      mockBuildAssistantSystemPrompt.mockReturnValueOnce('Custom system prompt');
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      expect(result.current.assistantSystemPrompt).toBe('Custom system prompt');
    });

    it('should pass only filtered nodeDefinitions to prompt builder', () => {
      const options = createMockOptions();
      renderHook(() => useAssistantConfig(options));

      const callArgs = mockBuildAssistantSystemPrompt.mock.calls[0][0] as {
        nodeDefinitions: Array<{ type: string }>;
      };
      const types = callArgs.nodeDefinitions.map((n) => n.type);
      expect(types).not.toContain('group');
      expect(types).not.toContain('disallowed');
    });
  });

  // --------------------------------------------------------------------------
  // executeToolCall Tests
  // --------------------------------------------------------------------------

  describe('executeToolCall', () => {
    it('should delegate to toolExecutor.executeToolCall', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      const toolCall = { function: { name: 'workflow_create', arguments: '{}' } };
      result.current.executeToolCall(toolCall);

      expect(mockExecuteToolCall).toHaveBeenCalledWith(toolCall);
    });

    it('should return the result from toolExecutor', () => {
      mockExecuteToolCall.mockReturnValueOnce({ success: true, data: 'test-data' });
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      const response = result.current.executeToolCall({ name: 'test' });

      expect(response).toEqual({ success: true, data: 'test-data' });
    });

    it('should handle different tool call formats', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      // OpenRouter format
      const openRouterCall = {
        function: { name: 'workflow_get_state', arguments: '{"include_data": true}' },
      };
      result.current.executeToolCall(openRouterCall);
      expect(mockExecuteToolCall).toHaveBeenCalledWith(openRouterCall);

      // Direct format
      const directCall = { name: 'workflow_run', arguments: {} };
      result.current.executeToolCall(directCall);
      expect(mockExecuteToolCall).toHaveBeenCalledWith(directCall);
    });
  });

  // --------------------------------------------------------------------------
  // Tool Executor Configuration Tests
  // --------------------------------------------------------------------------

  describe('toolExecutor configuration', () => {
    it('should create toolExecutor with correct config', () => {
      const options = createMockOptions();
      renderHook(() => useAssistantConfig(options));

      expect(mockCreateToolExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          getNodes: expect.any(Function),
          getEdges: expect.any(Function),
          setNodes: options.setNodes,
          setEdges: options.setEdges,
          handleRemoveNode: options.handleRemoveNode,
          setValidationErrors: options.setValidationErrors,
          runWorkflow: options.runWorkflow,
          allowedNodeTypes: expect.any(Array),
          focusCanvas: expect.any(Function),
        })
      );
    });

    it('should pass allowedNodeTypes to toolExecutor', () => {
      const options = createMockOptions();
      renderHook(() => useAssistantConfig(options));

      const config = mockCreateToolExecutor.mock.calls[0][0] as { allowedNodeTypes: string[] };
      expect(config.allowedNodeTypes).toContain('text');
      expect(config.allowedNodeTypes).toContain('image');
      expect(config.allowedNodeTypes).toContain('video');
    });

    it('should provide getNodes function that returns current nodes', () => {
      const nodes: Node[] = [{ id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} }];
      const options = createMockOptions({ nodes });
      renderHook(() => useAssistantConfig(options));

      const config = mockCreateToolExecutor.mock.calls[0][0] as { getNodes: () => Node[] };
      expect(config.getNodes()).toEqual(nodes);
    });

    it('should provide getEdges function that returns current edges', () => {
      const edges: Edge[] = [{ id: 'edge-1', source: 'a', target: 'b' }];
      const options = createMockOptions({ edges });
      renderHook(() => useAssistantConfig(options));

      const config = mockCreateToolExecutor.mock.calls[0][0] as { getEdges: () => Edge[] };
      expect(config.getEdges()).toEqual(edges);
    });
  });

  // --------------------------------------------------------------------------
  // focusCanvas Tests
  // --------------------------------------------------------------------------

  describe('focusCanvas', () => {
    it('should call fitView on reactFlowInstance when provided', () => {
      const mockFitView = vi.fn();
      const mockReactFlowInstance = {
        fitView: mockFitView,
      } as unknown as ReactFlowInstance;

      const options = createMockOptions({ reactFlowInstance: mockReactFlowInstance });
      renderHook(() => useAssistantConfig(options));

      const config = mockCreateToolExecutor.mock.calls[0][0] as { focusCanvas: () => void };
      config.focusCanvas();

      // focusCanvas uses setTimeout, so advance timers
      vi.advanceTimersByTime(10);

      expect(mockFitView).toHaveBeenCalledWith({ padding: 0.2, duration: 500 });
    });

    it('should handle null reactFlowInstance gracefully', () => {
      const options = createMockOptions({ reactFlowInstance: null });
      renderHook(() => useAssistantConfig(options));

      const config = mockCreateToolExecutor.mock.calls[0][0] as { focusCanvas: () => void };

      // Should not throw
      expect(() => {
        config.focusCanvas();
        vi.advanceTimersByTime(10);
      }).not.toThrow();
    });

    it('should call fitView with correct parameters', () => {
      const mockFitView = vi.fn();
      const mockReactFlowInstance = {
        fitView: mockFitView,
      } as unknown as ReactFlowInstance;

      const options = createMockOptions({ reactFlowInstance: mockReactFlowInstance });
      renderHook(() => useAssistantConfig(options));

      const config = mockCreateToolExecutor.mock.calls[0][0] as { focusCanvas: () => void };
      config.focusCanvas();
      vi.advanceTimersByTime(10);

      expect(mockFitView).toHaveBeenCalledTimes(1);
      const fitViewArgs = mockFitView.mock.calls[0][0] as { padding: number; duration: number };
      expect(fitViewArgs.padding).toBe(0.2);
      expect(fitViewArgs.duration).toBe(500);
    });
  });

  // --------------------------------------------------------------------------
  // Memoization Tests
  // --------------------------------------------------------------------------

  describe('memoization', () => {
    it('should return stable assistantNodeDefinitions reference when props unchanged', () => {
      const options = createMockOptions();
      const { result, rerender } = renderHook(() => useAssistantConfig(options));

      const firstDefinitions = result.current.assistantNodeDefinitions;
      rerender();
      const secondDefinitions = result.current.assistantNodeDefinitions;

      expect(firstDefinitions).toBe(secondDefinitions);
    });

    it('should return stable assistantSystemPrompt reference when deps unchanged', () => {
      const options = createMockOptions();
      const { result, rerender } = renderHook(() => useAssistantConfig(options));

      const firstPrompt = result.current.assistantSystemPrompt;
      rerender();
      const secondPrompt = result.current.assistantSystemPrompt;

      expect(firstPrompt).toBe(secondPrompt);
    });

    it('should return stable executeToolCall reference when deps unchanged', () => {
      const options = createMockOptions();
      const { result, rerender } = renderHook(() => useAssistantConfig(options));

      const firstExecute = result.current.executeToolCall;
      rerender();
      const secondExecute = result.current.executeToolCall;

      expect(firstExecute).toBe(secondExecute);
    });

    it('should not rebuild prompt when unrelated props change', () => {
      const options = createMockOptions();
      const { rerender } = renderHook((props) => useAssistantConfig(props), {
        initialProps: options,
      });

      const initialCallCount = mockBuildAssistantSystemPrompt.mock.calls.length;

      // Rerender with same options
      rerender(options);

      expect(mockBuildAssistantSystemPrompt.mock.calls.length).toBe(initialCallCount);
    });
  });

  // --------------------------------------------------------------------------
  // Dependency Updates Tests
  // --------------------------------------------------------------------------

  describe('dependency updates', () => {
    it('should update system prompt when workflowTemplates change', () => {
      const options = createMockOptions({ workflowTemplates: [] });
      const { rerender } = renderHook((props) => useAssistantConfig(props), {
        initialProps: options,
      });

      const initialCallCount = mockBuildAssistantSystemPrompt.mock.calls.length;

      const newTemplates: WorkflowTemplate[] = [
        { id: 'new-tpl', name: 'New Template', nodes: [], edges: [] },
      ];
      rerender(createMockOptions({ workflowTemplates: newTemplates }));

      // Should rebuild prompt with new templates
      expect(mockBuildAssistantSystemPrompt.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('should recreate toolExecutor when nodes change', () => {
      const options = createMockOptions({ nodes: [] });
      const { rerender } = renderHook((props) => useAssistantConfig(props), {
        initialProps: options,
      });

      const initialCallCount = mockCreateToolExecutor.mock.calls.length;

      const newNodes: Node[] = [
        { id: 'new-node', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ];
      rerender(createMockOptions({ nodes: newNodes }));

      expect(mockCreateToolExecutor.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('should recreate toolExecutor when edges change', () => {
      const options = createMockOptions({ edges: [] });
      const { rerender } = renderHook((props) => useAssistantConfig(props), {
        initialProps: options,
      });

      const initialCallCount = mockCreateToolExecutor.mock.calls.length;

      const newEdges: Edge[] = [{ id: 'new-edge', source: 'a', target: 'b' }];
      rerender(createMockOptions({ edges: newEdges }));

      expect(mockCreateToolExecutor.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('should recreate toolExecutor when reactFlowInstance changes', () => {
      const options = createMockOptions({ reactFlowInstance: null });
      const { rerender } = renderHook((props) => useAssistantConfig(props), {
        initialProps: options,
      });

      const initialCallCount = mockCreateToolExecutor.mock.calls.length;

      const mockInstance = { fitView: vi.fn() } as unknown as ReactFlowInstance;
      rerender(createMockOptions({ reactFlowInstance: mockInstance }));

      expect(mockCreateToolExecutor.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // --------------------------------------------------------------------------
  // Return Value Structure Tests
  // --------------------------------------------------------------------------

  describe('return value structure', () => {
    it('should return object with correct shape', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      expect(result.current).toHaveProperty('assistantSystemPrompt');
      expect(result.current).toHaveProperty('executeToolCall');
      expect(result.current).toHaveProperty('assistantNodeDefinitions');
    });

    it('should return assistantSystemPrompt as string', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      expect(typeof result.current.assistantSystemPrompt).toBe('string');
    });

    it('should return executeToolCall as function', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      expect(typeof result.current.executeToolCall).toBe('function');
    });

    it('should return assistantNodeDefinitions as array', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      expect(Array.isArray(result.current.assistantNodeDefinitions)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases Tests
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle empty nodes array', () => {
      const options = createMockOptions({ nodes: [] });
      const { result } = renderHook(() => useAssistantConfig(options));

      expect(result.current.assistantNodeDefinitions).toBeDefined();
      expect(result.current.assistantSystemPrompt).toBeDefined();
    });

    it('should handle empty edges array', () => {
      const options = createMockOptions({ edges: [] });
      const { result } = renderHook(() => useAssistantConfig(options));

      expect(result.current.executeToolCall).toBeDefined();
    });

    it('should handle empty workflowTemplates array', () => {
      const options = createMockOptions({ workflowTemplates: [] });
      const { result } = renderHook(() => useAssistantConfig(options));

      expect(mockBuildAssistantSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowTemplates: [],
        })
      );
      expect(result.current.assistantSystemPrompt).toBeDefined();
    });

    it('should handle getNodeSchema returning null for some types', () => {
      mockGetNodeSchema.mockImplementation((type: string) => {
        if (type === 'text') return { type: 'text', fields: [] };
        return null;
      });

      const options = createMockOptions();
      const { result } = renderHook(() => useAssistantConfig(options));

      // Should still work, just with fewer schemas
      expect(result.current.assistantSystemPrompt).toBeDefined();
    });
  });
});
