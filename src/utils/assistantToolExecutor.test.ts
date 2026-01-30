/**
 * Tests for assistantToolExecutor utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createToolExecutor } from './assistantToolExecutor';
import type { Node, Edge } from 'reactflow';

// Mock dependencies
vi.mock('../nodes', () => ({
  nodeCreators: {
    text: vi.fn(({ id, position }) => ({
      id,
      type: 'text',
      position,
      data: {
        title: 'Text Node',
        handles: [
          { id: 'text-in', type: 'input', dataType: 'text' },
          { id: 'text-out', type: 'output', dataType: 'text' },
        ],
      },
    })),
    image: vi.fn(({ id, position }) => ({
      id,
      type: 'image',
      position,
      data: {
        title: 'Image Node',
        handles: [
          { id: 'prompt-in', type: 'input', dataType: 'text' },
          { id: 'image-out', type: 'output', dataType: 'image' },
        ],
      },
    })),
  },
  nodeTypes: {
    text: {
      defaultData: {
        handles: [
          { id: 'text-in', type: 'input', dataType: 'text' },
          { id: 'text-out', type: 'output', dataType: 'text' },
        ],
      },
    },
    image: {
      defaultData: {
        handles: [
          { id: 'prompt-in', type: 'input', dataType: 'text' },
          { id: 'image-out', type: 'output', dataType: 'image' },
        ],
      },
    },
    video: {
      defaultData: {
        handles: [
          { id: 'prompt-in', type: 'input', dataType: 'text' },
          { id: 'video-out', type: 'output', dataType: 'video' },
        ],
      },
    },
  },
}));

vi.mock('./handleValidation', () => ({
  validateEdges: vi.fn((edges: Edge[], _nodes: Node[]) => ({
    validEdges: edges,
    validationErrors: [],
  })),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('assistantToolExecutor', () => {
  let mockConfig: {
    getNodes: ReturnType<typeof vi.fn>;
    getEdges: ReturnType<typeof vi.fn>;
    setNodes: ReturnType<typeof vi.fn>;
    setEdges: ReturnType<typeof vi.fn>;
    handleRemoveNode: ReturnType<typeof vi.fn>;
    setValidationErrors: ReturnType<typeof vi.fn>;
    runWorkflow: ReturnType<typeof vi.fn>;
    focusCanvas: ReturnType<typeof vi.fn>;
    allowedNodeTypes: Set<string> | null;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
      setNodes: vi.fn(),
      setEdges: vi.fn(),
      handleRemoveNode: vi.fn(),
      setValidationErrors: vi.fn(),
      runWorkflow: vi.fn(),
      focusCanvas: vi.fn(),
      allowedNodeTypes: null,
    };
  });

  describe('createToolExecutor', () => {
    it('should create a tool executor with executeToolCall function', () => {
      const executor = createToolExecutor(mockConfig);
      expect(executor).toBeDefined();
      expect(executor.executeToolCall).toBeDefined();
      expect(typeof executor.executeToolCall).toBe('function');
    });

    it('should accept allowedNodeTypes as Set', () => {
      mockConfig.allowedNodeTypes = new Set(['text', 'image']);
      const executor = createToolExecutor(mockConfig);
      expect(executor).toBeDefined();
    });

    it('should accept allowedNodeTypes as array', () => {
      const config = { ...mockConfig, allowedNodeTypes: ['text', 'image'] };
      const executor = createToolExecutor(config);
      expect(executor).toBeDefined();
    });
  });

  describe('workflow_create tool', () => {
    it('should create nodes from specification', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [
              { id: 'node-1', type: 'text', label: 'My Text Node' },
              { id: 'node-2', type: 'image', label: 'My Image Node' },
            ],
            edges: [],
          }),
        },
      });

      expect(mockConfig.setNodes).toHaveBeenCalled();
      expect(result).toHaveProperty('createdNodes');
      expect((result as { createdNodes: unknown[] }).createdNodes).toHaveLength(2);
    });

    it('should replace existing nodes when replace is true', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'existing', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [{ id: 'new-node', type: 'text' }],
            edges: [],
            replace: true,
          }),
        },
      });

      expect((result as { replaced: boolean }).replaced).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('noder-nodes');
    });

    it('should skip nodes with disallowed types', async () => {
      mockConfig.allowedNodeTypes = new Set(['text']);
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [
              { id: 'node-1', type: 'text' },
              { id: 'node-2', type: 'video' }, // Not in allowed types
            ],
            edges: [],
          }),
        },
      });

      expect((result as { createdNodes: unknown[] }).createdNodes).toHaveLength(1);
      expect((result as { skippedNodes: unknown[] }).skippedNodes).toHaveLength(1);
    });

    it('should create edges between nodes', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [
              { id: 'text-1', type: 'text' },
              { id: 'image-1', type: 'image' },
            ],
            edges: [{ source: 'text-1', target: 'image-1' }],
          }),
        },
      });

      expect(mockConfig.setEdges).toHaveBeenCalled();
      expect((result as { createdEdges: unknown[] }).createdEdges).toHaveLength(1);
    });

    it('should handle parse errors in arguments', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: 'invalid json{{{',
        },
      });

      expect((result as { error: string }).error).toContain('Invalid tool arguments');
    });

    it('should generate unique node IDs', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [{ id: 'node-1', type: 'text' }], // Same ID as existing
            edges: [],
          }),
        },
      });

      // Should have created a node with a modified unique ID
      expect((result as { idMap: Record<string, string> }).idMap).toBeDefined();
    });

    it('should call focusCanvas after creating nodes', async () => {
      vi.useFakeTimers();
      const executor = createToolExecutor(mockConfig);

      await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [{ id: 'node-1', type: 'text' }],
            edges: [],
          }),
        },
      });

      vi.advanceTimersByTime(100);
      expect(mockConfig.focusCanvas).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('workflow_connect tool', () => {
    it('should create connections between existing nodes', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'image-1', type: 'image', position: { x: 100, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_connect',
          arguments: JSON.stringify({
            connections: [{ source: 'text-1', target: 'image-1' }],
          }),
        },
      });

      expect(mockConfig.setEdges).toHaveBeenCalled();
      expect((result as { createdEdges: unknown[] }).createdEdges).toHaveLength(1);
    });

    it('should skip connections with missing nodes', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_connect',
          arguments: JSON.stringify({
            connections: [{ source: 'text-1', target: 'missing-node' }],
          }),
        },
      });

      expect((result as { skippedEdges: unknown[] }).skippedEdges).toHaveLength(1);
    });
  });

  describe('workflow_validate tool', () => {
    it('should validate workflow edges', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ]);
      mockConfig.getEdges.mockReturnValue([{ id: 'e1', source: 'node-1', target: 'node-2' }]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_validate', arguments: '{}' },
      });

      expect((result as { totalEdges: number }).totalEdges).toBe(1);
      expect((result as { validEdges: number }).validEdges).toBeDefined();
    });
  });

  describe('workflow_run tool', () => {
    it('should run workflow and return success', async () => {
      mockConfig.runWorkflow.mockResolvedValue({ output: 'test result' });

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_run', arguments: '{}' },
      });

      expect((result as { success: boolean }).success).toBe(true);
      expect((result as { result: unknown }).result).toEqual({ output: 'test result' });
    });

    it('should handle workflow run errors', async () => {
      mockConfig.runWorkflow.mockRejectedValue(new Error('Workflow failed'));

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_run', arguments: '{}' },
      });

      expect((result as { success: boolean }).success).toBe(false);
      expect((result as { error: string }).error).toBe('Workflow failed');
    });
  });

  describe('text_node_set_prompts tool', () => {
    it('should set prompts on text node', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { title: 'Text' } },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'text_node_set_prompts',
          arguments: JSON.stringify({
            nodeId: 'text-1',
            prompt: 'New prompt',
            systemPrompt: 'New system prompt',
          }),
        },
      });

      expect(mockConfig.setNodes).toHaveBeenCalled();
      expect((result as { nodeId: string }).nodeId).toBe('text-1');
      expect((result as { updated: Record<string, unknown> }).updated?.prompt).toBe('New prompt');
    });

    it('should auto-select single text node', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'only-text', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'text_node_set_prompts',
          arguments: JSON.stringify({
            prompt: 'Auto-selected prompt',
          }),
        },
      });

      expect((result as { nodeId: string }).nodeId).toBe('only-text');
    });

    it('should error when node not found', async () => {
      mockConfig.getNodes.mockReturnValue([]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'text_node_set_prompts',
          arguments: JSON.stringify({
            nodeId: 'missing',
            prompt: 'Test',
          }),
        },
      });

      expect((result as { error: string }).error).toContain('not found');
    });

    it('should error when node is not text type', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'image-1', type: 'image', position: { x: 0, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'text_node_set_prompts',
          arguments: JSON.stringify({
            nodeId: 'image-1',
            prompt: 'Test',
          }),
        },
      });

      expect((result as { error: string }).error).toContain('not a Text');
    });
  });

  describe('workflow_get_state tool', () => {
    it('should return current workflow state', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 100, y: 200 }, data: { title: 'Node 1' } },
        { id: 'n2', type: 'image', position: { x: 300, y: 200 }, data: { title: 'Node 2' } },
      ]);
      mockConfig.getEdges.mockReturnValue([
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out', targetHandle: 'in' },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_get_state', arguments: '{}' },
      });

      expect((result as { nodeCount: number }).nodeCount).toBe(2);
      expect((result as { edgeCount: number }).edgeCount).toBe(1);
      expect((result as { nodes: unknown[] }).nodes).toHaveLength(2);
    });

    it('should include data when include_data is true', async () => {
      mockConfig.getNodes.mockReturnValue([
        {
          id: 'n1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: { title: 'Test', model: 'gpt-4' },
        },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_get_state',
          arguments: JSON.stringify({ include_data: true }),
        },
      });

      expect((result as { nodes: Array<{ data: unknown }> }).nodes[0].data).toBeDefined();
    });
  });

  describe('workflow_get_node tool', () => {
    it('should return detailed node information', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 100, y: 200 }, data: { title: 'My Node' } },
      ]);
      mockConfig.getEdges.mockReturnValue([]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_get_node',
          arguments: JSON.stringify({ nodeId: 'n1' }),
        },
      });

      expect((result as { id: string }).id).toBe('n1');
      expect((result as { type: string }).type).toBe('text');
      expect((result as { handles: unknown }).handles).toBeDefined();
      expect((result as { connections: unknown }).connections).toBeDefined();
    });

    it('should error when nodeId is missing', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_get_node',
          arguments: '{}',
        },
      });

      expect((result as { error: string }).error).toContain('nodeId is required');
    });

    it('should error when node not found', async () => {
      mockConfig.getNodes.mockReturnValue([]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_get_node',
          arguments: JSON.stringify({ nodeId: 'missing' }),
        },
      });

      expect((result as { error: string }).error).toContain('not found');
    });

    it('should include incoming and outgoing connections', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', type: 'image', position: { x: 100, y: 0 }, data: {} },
      ]);
      mockConfig.getEdges.mockReturnValue([
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out', targetHandle: 'in' },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_get_node',
          arguments: JSON.stringify({ nodeId: 'n2' }),
        },
      });

      expect(
        (result as { connections: { incoming: unknown[] } }).connections.incoming
      ).toHaveLength(1);
    });
  });

  describe('workflow_get_outputs tool', () => {
    it('should return outputs for all nodes', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: { output: 'Hello world' } },
        {
          id: 'n2',
          type: 'image',
          position: { x: 100, y: 0 },
          data: { output: 'https://example.com/image.png' },
        },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_get_outputs', arguments: '{}' },
      });

      expect((result as { outputs: unknown[] }).outputs).toHaveLength(2);
    });

    it('should filter by nodeIds when provided', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: { output: 'Text output' } },
        { id: 'n2', type: 'image', position: { x: 100, y: 0 }, data: { output: 'Image output' } },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_get_outputs',
          arguments: JSON.stringify({ nodeIds: ['n1'] }),
        },
      });

      expect((result as { outputs: unknown[] }).outputs).toHaveLength(1);
    });

    it('should detect output types correctly', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: { output: 'Plain text' } },
        {
          id: 'n2',
          type: 'image',
          position: { x: 0, y: 0 },
          data: { output: 'https://example.com/image.png' },
        },
        { id: 'n3', type: 'text', position: { x: 0, y: 0 }, data: { output: { key: 'value' } } },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_get_outputs', arguments: '{}' },
      });

      const outputs = (result as { outputs: Array<{ outputType: string }> }).outputs;
      expect(outputs[0].outputType).toBe('text');
      expect(outputs[1].outputType).toBe('image_url');
      expect(outputs[2].outputType).toBe('object');
    });
  });

  describe('workflow_update_node tool', () => {
    it('should update node data', async () => {
      mockConfig.getNodes.mockReturnValue([
        {
          id: 'n1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: { title: 'Old Title', model: 'gpt-3' },
        },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_update_node',
          arguments: JSON.stringify({
            nodeId: 'n1',
            data: { model: 'gpt-4' },
            label: 'New Title',
          }),
        },
      });

      expect(mockConfig.setNodes).toHaveBeenCalled();
      expect((result as { nodeId: string }).nodeId).toBe('n1');
      expect((result as { previousValues: Record<string, unknown> }).previousValues?.model).toBe(
        'gpt-3'
      );
    });

    it('should error when no updates provided', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_update_node',
          arguments: JSON.stringify({ nodeId: 'n1' }),
        },
      });

      expect((result as { error: string }).error).toContain('No updates provided');
    });
  });

  describe('workflow_delete_nodes tool', () => {
    it('should delete specified nodes', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', type: 'image', position: { x: 100, y: 0 }, data: {} },
      ]);
      mockConfig.getEdges.mockReturnValue([{ id: 'e1', source: 'n1', target: 'n2' }]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_delete_nodes',
          arguments: JSON.stringify({ nodeIds: ['n1'] }),
        },
      });

      expect(mockConfig.setNodes).toHaveBeenCalled();
      expect((result as { deletedNodes: string[] }).deletedNodes).toContain('n1');
      expect((result as { deletedEdges: string[] }).deletedEdges).toContain('e1');
    });

    it('should report not found nodes', async () => {
      mockConfig.getNodes.mockReturnValue([]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_delete_nodes',
          arguments: JSON.stringify({ nodeIds: ['missing'] }),
        },
      });

      expect((result as { notFound: string[] }).notFound).toContain('missing');
    });

    it('should error when nodeIds is empty', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_delete_nodes',
          arguments: JSON.stringify({ nodeIds: [] }),
        },
      });

      expect((result as { error: string }).error).toContain('must not be empty');
    });
  });

  describe('workflow_delete_edges tool', () => {
    it('should delete edges matching specs', async () => {
      mockConfig.getEdges.mockReturnValue([
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'out', targetHandle: 'in' },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_delete_edges',
          arguments: JSON.stringify({
            edges: [{ source: 'n1', target: 'n2' }],
          }),
        },
      });

      expect(mockConfig.setEdges).toHaveBeenCalled();
      expect((result as { deletedEdges: string[] }).deletedEdges).toContain('e1');
      expect((result as { remainingEdges: number }).remainingEdges).toBe(1);
    });

    it('should match by handle when specified', async () => {
      mockConfig.getEdges.mockReturnValue([
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out1', targetHandle: 'in' },
        { id: 'e2', source: 'n1', target: 'n2', sourceHandle: 'out2', targetHandle: 'in' },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_delete_edges',
          arguments: JSON.stringify({
            edges: [{ source: 'n1', target: 'n2', sourceHandle: 'out1' }],
          }),
        },
      });

      expect((result as { deletedEdges: string[] }).deletedEdges).toHaveLength(1);
      expect((result as { deletedEdges: string[] }).deletedEdges[0]).toBe('e1');
    });
  });

  describe('workflow_clear tool', () => {
    it('should clear workflow when confirmed', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ]);
      mockConfig.getEdges.mockReturnValue([{ id: 'e1', source: 'n1', target: 'n2' }]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_clear',
          arguments: JSON.stringify({ confirm: true }),
        },
      });

      expect(mockConfig.setNodes).toHaveBeenCalledWith([]);
      expect(mockConfig.setEdges).toHaveBeenCalledWith([]);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('noder-nodes');
      expect((result as { cleared: boolean }).cleared).toBe(true);
      expect((result as { deletedNodes: number }).deletedNodes).toBe(1);
    });

    it('should error when not confirmed', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_clear',
          arguments: JSON.stringify({ confirm: false }),
        },
      });

      expect((result as { error: string }).error).toContain('confirm: true');
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'unknown_tool', arguments: '{}' },
      });

      expect((result as { error: string }).error).toContain('Unknown tool');
    });
  });

  describe('tool call formats', () => {
    it('should handle function.name format', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_get_state', arguments: '{}' },
      });

      expect((result as { nodeCount: number }).nodeCount).toBeDefined();
    });

    it('should handle direct name format', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        name: 'workflow_get_state',
        arguments: '{}',
      });

      expect((result as { nodeCount: number }).nodeCount).toBeDefined();
    });

    it('should handle object arguments', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_get_state',
          arguments: { include_data: true },
        },
      });

      expect((result as { nodeCount: number }).nodeCount).toBeDefined();
    });
  });

  describe('workflow_create advanced scenarios', () => {
    it('should handle nodes with custom labels', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [{ id: 'node-1', type: 'text', label: 'Custom Label Node' }],
            edges: [],
          }),
        },
      });

      expect((result as { createdNodes: unknown[] }).createdNodes).toHaveLength(1);
    });

    it('should handle nodes with position override', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [{ id: 'positioned', type: 'text', position: { x: 500, y: 300 } }],
            edges: [],
          }),
        },
      });

      expect((result as { createdNodes: unknown[] }).createdNodes).toHaveLength(1);
    });

    it('should handle empty nodes array', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [],
            edges: [],
          }),
        },
      });

      expect((result as { createdNodes: unknown[] }).createdNodes).toHaveLength(0);
    });

    it('should handle edges with explicit handles', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_create',
          arguments: JSON.stringify({
            nodes: [
              { id: 'text-1', type: 'text' },
              { id: 'image-1', type: 'image' },
            ],
            edges: [
              {
                source: 'text-1',
                target: 'image-1',
                sourceHandle: 'text-out',
                targetHandle: 'prompt-in',
              },
            ],
          }),
        },
      });

      expect((result as { createdEdges: unknown[] }).createdEdges).toHaveLength(1);
    });
  });

  describe('workflow_connect advanced scenarios', () => {
    it('should handle connections with explicit handles', async () => {
      mockConfig.getNodes.mockReturnValue([
        {
          id: 'text-1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: { handles: [{ id: 'custom-out', type: 'output', dataType: 'text' }] },
        },
        {
          id: 'image-1',
          type: 'image',
          position: { x: 100, y: 0 },
          data: { handles: [{ id: 'custom-in', type: 'input', dataType: 'text' }] },
        },
      ]);

      const executor = createToolExecutor(mockConfig);

      const _result = await executor.executeToolCall({
        function: {
          name: 'workflow_connect',
          arguments: JSON.stringify({
            connections: [
              {
                source: 'text-1',
                target: 'image-1',
                sourceHandle: 'custom-out',
                targetHandle: 'custom-in',
              },
            ],
          }),
        },
      });

      expect(mockConfig.setEdges).toHaveBeenCalled();
    });

    it('should handle multiple connections in one call', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', type: 'image', position: { x: 100, y: 0 }, data: {} },
        { id: 'n3', type: 'text', position: { x: 200, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_connect',
          arguments: JSON.stringify({
            connections: [
              { source: 'n1', target: 'n2' },
              { source: 'n2', target: 'n3' },
            ],
          }),
        },
      });

      expect((result as { createdEdges: unknown[] }).createdEdges).toHaveLength(2);
    });

    it('should skip invalid connections but report them', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_connect',
          arguments: JSON.stringify({
            connections: [
              { source: 'n1', target: 'missing' },
              { source: 'missing', target: 'n1' },
            ],
          }),
        },
      });

      expect((result as { skippedEdges: unknown[] }).skippedEdges).toHaveLength(2);
    });
  });

  describe('text_node_set_prompts edge cases', () => {
    it('should handle only systemPrompt update', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { title: 'Text' } },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'text_node_set_prompts',
          arguments: JSON.stringify({
            nodeId: 'text-1',
            systemPrompt: 'Only system prompt',
          }),
        },
      });

      expect((result as { updated: Record<string, unknown> }).updated.systemPrompt).toBe(
        'Only system prompt'
      );
    });

    it('should require nodeId when multiple text nodes exist', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'text-2', type: 'text', position: { x: 100, y: 0 }, data: {} },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'text_node_set_prompts',
          arguments: JSON.stringify({
            prompt: 'Test prompt',
          }),
        },
      });

      expect((result as { error: string }).error).toContain('nodeId');
    });
  });

  describe('workflow_update_node advanced', () => {
    it('should update multiple data fields at once', async () => {
      mockConfig.getNodes.mockReturnValue([
        {
          id: 'n1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: { title: 'Old', model: 'gpt-3', temperature: 0.5 },
        },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_update_node',
          arguments: JSON.stringify({
            nodeId: 'n1',
            data: { model: 'gpt-4', temperature: 0.7 },
          }),
        },
      });

      // The implementation returns 'updated' object, not 'updatedFields' array
      expect((result as { updated: Record<string, unknown> }).updated).toHaveProperty(
        'model',
        'gpt-4'
      );
      expect((result as { updated: Record<string, unknown> }).updated).toHaveProperty(
        'temperature',
        0.7
      );
    });

    it('should error when node not found', async () => {
      mockConfig.getNodes.mockReturnValue([]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_update_node',
          arguments: JSON.stringify({
            nodeId: 'missing',
            data: { model: 'test' },
          }),
        },
      });

      expect((result as { error: string }).error).toContain('not found');
    });

    it('should handle label update without data', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: { title: 'Old Title' } },
      ]);

      const executor = createToolExecutor(mockConfig);

      const _result = await executor.executeToolCall({
        function: {
          name: 'workflow_update_node',
          arguments: JSON.stringify({
            nodeId: 'n1',
            label: 'New Title',
          }),
        },
      });

      expect(mockConfig.setNodes).toHaveBeenCalled();
    });
  });

  describe('workflow_delete_nodes edge cases', () => {
    it('should delete multiple nodes and their connected edges', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', type: 'image', position: { x: 100, y: 0 }, data: {} },
        { id: 'n3', type: 'text', position: { x: 200, y: 0 }, data: {} },
      ]);
      mockConfig.getEdges.mockReturnValue([
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_delete_nodes',
          arguments: JSON.stringify({ nodeIds: ['n1', 'n2'] }),
        },
      });

      expect((result as { deletedNodes: string[] }).deletedNodes).toContain('n1');
      expect((result as { deletedNodes: string[] }).deletedNodes).toContain('n2');
      // Both edges should be deleted since they connect to deleted nodes
      expect((result as { deletedEdges: string[] }).deletedEdges.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle mixed found and not found nodes', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
      ]);
      mockConfig.getEdges.mockReturnValue([]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_delete_nodes',
          arguments: JSON.stringify({ nodeIds: ['n1', 'missing'] }),
        },
      });

      expect((result as { deletedNodes: string[] }).deletedNodes).toContain('n1');
      expect((result as { notFound: string[] }).notFound).toContain('missing');
    });
  });

  describe('workflow_delete_edges edge cases', () => {
    it('should delete edges by target handle', async () => {
      mockConfig.getEdges.mockReturnValue([
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out', targetHandle: 'in1' },
        { id: 'e2', source: 'n1', target: 'n2', sourceHandle: 'out', targetHandle: 'in2' },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_delete_edges',
          arguments: JSON.stringify({
            edges: [{ source: 'n1', target: 'n2', targetHandle: 'in1' }],
          }),
        },
      });

      expect((result as { deletedEdges: string[] }).deletedEdges).toHaveLength(1);
      expect((result as { deletedEdges: string[] }).deletedEdges[0]).toBe('e1');
    });

    it('should return empty result when no edges match', async () => {
      mockConfig.getEdges.mockReturnValue([{ id: 'e1', source: 'n1', target: 'n2' }]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_delete_edges',
          arguments: JSON.stringify({
            edges: [{ source: 'n3', target: 'n4' }],
          }),
        },
      });

      expect((result as { deletedEdges: string[] }).deletedEdges).toHaveLength(0);
      expect((result as { remainingEdges: number }).remainingEdges).toBe(1);
    });
  });

  describe('workflow_get_outputs edge cases', () => {
    it('should handle nodes without output', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', type: 'image', position: { x: 100, y: 0 }, data: { output: 'has-output' } },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_get_outputs', arguments: '{}' },
      });

      // Should include both nodes but only n2 has output
      const outputs = (result as { outputs: unknown[] }).outputs;
      expect(outputs).toHaveLength(2);
    });

    it('should detect image output type for image URLs', async () => {
      mockConfig.getNodes.mockReturnValue([
        {
          id: 'n1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: { output: 'https://example.com/photo.png' },
        },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_get_outputs', arguments: '{}' },
      });

      const outputs = (result as { outputs: Array<{ outputType: string }> }).outputs;
      expect(outputs[0].outputType).toBe('image_url');
    });

    it('should detect text output type for non-image URLs', async () => {
      // The implementation treats non-image URLs as 'text' type
      mockConfig.getNodes.mockReturnValue([
        {
          id: 'n1',
          type: 'video',
          position: { x: 0, y: 0 },
          data: { output: 'https://example.com/video.mp4' },
        },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_get_outputs', arguments: '{}' },
      });

      const outputs = (result as { outputs: Array<{ outputType: string }> }).outputs;
      // Note: The implementation classifies non-image URLs as 'text'
      expect(outputs[0].outputType).toBe('text');
    });

    it('should detect object output type for object data', async () => {
      mockConfig.getNodes.mockReturnValue([
        {
          id: 'n1',
          type: 'audio',
          position: { x: 0, y: 0 },
          data: { output: { audio_url: 'https://example.com/audio.mp3', duration: 5 } },
        },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: { name: 'workflow_get_outputs', arguments: '{}' },
      });

      const outputs = (result as { outputs: Array<{ outputType: string }> }).outputs;
      expect(outputs[0].outputType).toBe('object');
    });
  });

  describe('workflow_get_node connection details', () => {
    it('should include outgoing connections', async () => {
      mockConfig.getNodes.mockReturnValue([
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', type: 'image', position: { x: 100, y: 0 }, data: {} },
      ]);
      mockConfig.getEdges.mockReturnValue([
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out', targetHandle: 'in' },
      ]);

      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_get_node',
          arguments: JSON.stringify({ nodeId: 'n1' }),
        },
      });

      expect(
        (result as { connections: { outgoing: unknown[] } }).connections.outgoing
      ).toHaveLength(1);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle missing function property', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        // Neither function nor name provided
      } as any);

      expect((result as { error: string }).error).toBeDefined();
    });

    it('should handle undefined arguments', async () => {
      const executor = createToolExecutor(mockConfig);

      const result = await executor.executeToolCall({
        function: {
          name: 'workflow_get_state',
          arguments: undefined,
        },
      } as any);

      // Should still work with empty arguments
      expect((result as { nodeCount: number }).nodeCount).toBeDefined();
    });
  });
});
