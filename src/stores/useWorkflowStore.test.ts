/**
 * Tests for useWorkflowStore Zustand store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Node, Edge, Connection } from 'reactflow';
import { useWorkflowStore, type WorkflowOutput, type WorkflowDocument } from './useWorkflowStore';

// Mock reactflow - just return what's passed
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    applyNodeChanges: vi.fn((changes, nodes) => {
      return changes.reduce((acc: Node[], change: { type: string; id?: string; item?: Node }) => {
        if (change.type === 'remove' && change.id) {
          return acc.filter((n) => n.id !== change.id);
        }
        if (change.type === 'add' && change.item) {
          return [...acc, change.item];
        }
        return acc;
      }, nodes);
    }),
    applyEdgeChanges: vi.fn((changes, edges) => {
      return changes.reduce((acc: Edge[], change: { type: string; id?: string; item?: Edge }) => {
        if (change.type === 'remove' && change.id) {
          return acc.filter((e) => e.id !== change.id);
        }
        if (change.type === 'add' && change.item) {
          return [...acc, change.item];
        }
        return acc;
      }, edges);
    }),
    addEdge: vi.fn((edge, edges) => [...edges, edge]),
  };
});

describe('useWorkflowStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useWorkflowStore.setState({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      activeWorkflow: null,
      workflowMetadata: null,
      openWorkflows: [],
      hasUnsavedChanges: false,
      workflowOutputs: [],
      workflowTemplates: [],
      reactFlowInstance: null,
    });
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useWorkflowStore.getState();

      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
      expect(state.activeWorkflow).toBeNull();
      expect(state.workflowMetadata).toBeNull();
      expect(state.openWorkflows).toEqual([]);
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.workflowOutputs).toEqual([]);
      expect(state.workflowTemplates).toEqual([]);
      expect(state.reactFlowInstance).toBeNull();
    });
  });

  describe('node operations', () => {
    const mockNode: Node = {
      id: 'node-1',
      type: 'image',
      position: { x: 100, y: 200 },
      data: { title: 'Test Node', model: 'flux' },
    };

    it('should set nodes with array', () => {
      useWorkflowStore.getState().setNodes([mockNode]);

      expect(useWorkflowStore.getState().nodes).toEqual([mockNode]);
      expect(useWorkflowStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('should set nodes with updater function', () => {
      useWorkflowStore.getState().setNodes([mockNode]);
      useWorkflowStore.getState().setNodes((nodes) => [...nodes, { ...mockNode, id: 'node-2' }]);

      expect(useWorkflowStore.getState().nodes).toHaveLength(2);
    });

    it('should add node', () => {
      useWorkflowStore.getState().addNode(mockNode);

      expect(useWorkflowStore.getState().nodes).toHaveLength(1);
      expect(useWorkflowStore.getState().nodes[0].id).toBe('node-1');
      expect(useWorkflowStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('should update node', () => {
      useWorkflowStore.getState().setNodes([mockNode]);
      useWorkflowStore.getState().updateNode('node-1', { position: { x: 300, y: 400 } });

      expect(useWorkflowStore.getState().nodes[0].position).toEqual({ x: 300, y: 400 });
    });

    it('should not update non-existent node', () => {
      useWorkflowStore.getState().setNodes([mockNode]);
      useWorkflowStore.getState().updateNode('non-existent', { position: { x: 0, y: 0 } });

      expect(useWorkflowStore.getState().nodes[0].position).toEqual({ x: 100, y: 200 });
    });

    it('should update node data', () => {
      useWorkflowStore.getState().setNodes([mockNode]);
      useWorkflowStore.getState().updateNodeData('node-1', { model: 'sdxl', newProp: 'value' });

      const nodeData = useWorkflowStore.getState().nodes[0].data;
      expect(nodeData.model).toBe('sdxl');
      expect(nodeData.newProp).toBe('value');
      expect(nodeData.title).toBe('Test Node'); // Original data preserved
    });

    it('should remove node', () => {
      useWorkflowStore.getState().setNodes([mockNode, { ...mockNode, id: 'node-2' }]);
      useWorkflowStore.getState().removeNode('node-1');

      expect(useWorkflowStore.getState().nodes).toHaveLength(1);
      expect(useWorkflowStore.getState().nodes[0].id).toBe('node-2');
    });

    it('should remove connected edges when removing node', () => {
      const edge: Edge = { id: 'e1', source: 'node-1', target: 'node-2' };
      useWorkflowStore.setState({
        nodes: [mockNode, { ...mockNode, id: 'node-2' }],
        edges: [edge],
      });

      useWorkflowStore.getState().removeNode('node-1');

      expect(useWorkflowStore.getState().edges).toHaveLength(0);
    });

    it('should apply node changes', () => {
      useWorkflowStore.getState().setNodes([mockNode, { ...mockNode, id: 'node-2' }]);

      useWorkflowStore.getState().applyNodeChanges([{ type: 'remove', id: 'node-1' }]);

      expect(useWorkflowStore.getState().nodes).toHaveLength(1);
    });
  });

  describe('edge operations', () => {
    const mockEdge: Edge = {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'out',
      targetHandle: 'in',
    };

    it('should set edges with array', () => {
      useWorkflowStore.getState().setEdges([mockEdge]);

      expect(useWorkflowStore.getState().edges).toHaveLength(1);
      expect(useWorkflowStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('should set edges with updater function', () => {
      useWorkflowStore.getState().setEdges([mockEdge]);
      useWorkflowStore.getState().setEdges((edges) => [...edges, { ...mockEdge, id: 'edge-2' }]);

      expect(useWorkflowStore.getState().edges).toHaveLength(2);
    });

    it('should add edge from Edge object', () => {
      useWorkflowStore.getState().addEdge(mockEdge);

      expect(useWorkflowStore.getState().edges).toHaveLength(1);
      expect(useWorkflowStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('should add edge from Connection object', () => {
      const connection: Connection = {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'out',
        targetHandle: 'in',
      };

      useWorkflowStore.getState().addEdge(connection);

      expect(useWorkflowStore.getState().edges).toHaveLength(1);
      const addedEdge = useWorkflowStore.getState().edges[0];
      expect(addedEdge.source).toBe('node-1');
      expect(addedEdge.target).toBe('node-2');
    });

    it('should remove edge', () => {
      useWorkflowStore.getState().setEdges([mockEdge, { ...mockEdge, id: 'edge-2' }]);
      useWorkflowStore.getState().removeEdge('edge-1');

      expect(useWorkflowStore.getState().edges).toHaveLength(1);
      expect(useWorkflowStore.getState().edges[0].id).toBe('edge-2');
    });

    it('should apply edge changes', () => {
      useWorkflowStore.getState().setEdges([mockEdge, { ...mockEdge, id: 'edge-2' }]);

      useWorkflowStore.getState().applyEdgeChanges([{ type: 'remove', id: 'edge-1' }]);

      expect(useWorkflowStore.getState().edges).toHaveLength(1);
    });

    it('should mark edge glows correctly', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'a', target: 'c', sourceHandle: 'out', targetHandle: 'in' },
      ];

      useWorkflowStore.getState().setEdges(edges);

      const storeEdges = useWorkflowStore.getState().edges;
      expect(storeEdges[0].data?.showSourceGlow).toBe(true);
      expect(storeEdges[0].data?.showTargetGlow).toBe(true);
      expect(storeEdges[1].data?.showSourceGlow).toBe(false); // Same source:handle
      expect(storeEdges[1].data?.showTargetGlow).toBe(true); // Different target:handle
    });
  });

  describe('viewport', () => {
    it('should set viewport', () => {
      useWorkflowStore.getState().setViewport({ x: 100, y: 200, zoom: 1.5 });

      expect(useWorkflowStore.getState().viewport).toEqual({ x: 100, y: 200, zoom: 1.5 });
    });
  });

  describe('workflow management', () => {
    it('should set active workflow', () => {
      const workflow = { id: 'wf-1', name: 'My Workflow' };
      useWorkflowStore.getState().setActiveWorkflow(workflow);

      expect(useWorkflowStore.getState().activeWorkflow).toEqual(workflow);
    });

    it('should clear active workflow', () => {
      useWorkflowStore.getState().setActiveWorkflow({ id: 'wf-1', name: 'Test' });
      useWorkflowStore.getState().setActiveWorkflow(null);

      expect(useWorkflowStore.getState().activeWorkflow).toBeNull();
    });

    it('should set workflow metadata', () => {
      const metadata = { id: 'wf-1', name: 'Workflow', createdAt: '2024-01-01' };
      useWorkflowStore.getState().setWorkflowMetadata(metadata);

      expect(useWorkflowStore.getState().workflowMetadata).toEqual(metadata);
    });

    it('should set open workflows', () => {
      const workflows = [
        { id: 'wf-1', name: 'Workflow 1' },
        { id: 'wf-2', name: 'Workflow 2' },
      ];
      useWorkflowStore.getState().setOpenWorkflows(workflows);

      expect(useWorkflowStore.getState().openWorkflows).toEqual(workflows);
    });

    it('should set hasUnsavedChanges', () => {
      useWorkflowStore.getState().setHasUnsavedChanges(true);
      expect(useWorkflowStore.getState().hasUnsavedChanges).toBe(true);

      useWorkflowStore.getState().setHasUnsavedChanges(false);
      expect(useWorkflowStore.getState().hasUnsavedChanges).toBe(false);
    });
  });

  describe('output management', () => {
    const mockOutput: WorkflowOutput = {
      id: 'out-1',
      nodeId: 'node-1',
      type: 'image',
      value: 'https://example.com/image.png',
      timestamp: Date.now(),
    };

    it('should set workflow outputs', () => {
      useWorkflowStore.getState().setWorkflowOutputs([mockOutput]);

      expect(useWorkflowStore.getState().workflowOutputs).toEqual([mockOutput]);
    });

    it('should add workflow output (prepends)', () => {
      useWorkflowStore.getState().setWorkflowOutputs([mockOutput]);
      const newOutput = { ...mockOutput, id: 'out-2' };
      useWorkflowStore.getState().addWorkflowOutput(newOutput);

      expect(useWorkflowStore.getState().workflowOutputs).toHaveLength(2);
      expect(useWorkflowStore.getState().workflowOutputs[0].id).toBe('out-2'); // Prepended
    });

    it('should remove workflow output', () => {
      useWorkflowStore.getState().setWorkflowOutputs([mockOutput, { ...mockOutput, id: 'out-2' }]);
      useWorkflowStore.getState().removeWorkflowOutput('out-1');

      expect(useWorkflowStore.getState().workflowOutputs).toHaveLength(1);
      expect(useWorkflowStore.getState().workflowOutputs[0].id).toBe('out-2');
    });

    it('should clear workflow outputs', () => {
      useWorkflowStore.getState().setWorkflowOutputs([mockOutput, { ...mockOutput, id: 'out-2' }]);
      useWorkflowStore.getState().clearWorkflowOutputs();

      expect(useWorkflowStore.getState().workflowOutputs).toEqual([]);
    });
  });

  describe('template management', () => {
    const mockTemplate: WorkflowDocument = {
      name: 'Template 1',
      nodes: [{ id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    };

    it('should set workflow templates', () => {
      useWorkflowStore.getState().setWorkflowTemplates([mockTemplate]);

      expect(useWorkflowStore.getState().workflowTemplates).toEqual([mockTemplate]);
    });

    it('should add workflow template', () => {
      useWorkflowStore.getState().setWorkflowTemplates([mockTemplate]);
      const newTemplate = { ...mockTemplate, name: 'Template 2' };
      useWorkflowStore.getState().addWorkflowTemplate(newTemplate);

      expect(useWorkflowStore.getState().workflowTemplates).toHaveLength(2);
    });
  });

  describe('ReactFlow instance', () => {
    it('should set ReactFlow instance', () => {
      const mockInstance = { fitView: vi.fn() };
      useWorkflowStore.getState().setReactFlowInstance(mockInstance);

      expect(useWorkflowStore.getState().reactFlowInstance).toBe(mockInstance);
    });
  });

  describe('workflow loading', () => {
    it('should load workflow document', () => {
      const document: WorkflowDocument = {
        name: 'Loaded Workflow',
        nodes: [{ id: 'n1', type: 'text', position: { x: 50, y: 100 }, data: {} }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        viewport: { x: 200, y: 300, zoom: 2 },
        metadata: { id: 'wf-loaded', name: 'Loaded' },
        outputs: [{ id: 'o1', nodeId: 'n1', type: 'text', value: 'test', timestamp: Date.now() }],
      };

      useWorkflowStore.getState().loadWorkflow(document);

      const state = useWorkflowStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.edges).toHaveLength(1);
      expect(state.viewport).toEqual({ x: 200, y: 300, zoom: 2 });
      expect(state.workflowMetadata).toEqual({ id: 'wf-loaded', name: 'Loaded' });
      expect(state.workflowOutputs).toHaveLength(1);
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle empty workflow document', () => {
      const document: WorkflowDocument = {
        nodes: [],
        edges: [],
      };

      useWorkflowStore.getState().loadWorkflow(document);

      const state = useWorkflowStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('should clear workflow', () => {
      // Set some state first
      useWorkflowStore.setState({
        nodes: [{ id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        activeWorkflow: { id: 'wf-1', name: 'Test' },
        workflowMetadata: { id: 'meta-1' },
        hasUnsavedChanges: true,
        workflowOutputs: [{ id: 'o1', nodeId: 'n1', type: 'text', value: 'v', timestamp: 1 }],
      });

      useWorkflowStore.getState().clearWorkflow();

      const state = useWorkflowStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
      expect(state.activeWorkflow).toBeNull();
      expect(state.workflowMetadata).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.workflowOutputs).toEqual([]);
    });
  });

  describe('snapshots', () => {
    it('should get nodes snapshot', () => {
      const nodes: Node[] = [
        { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', type: 'image', position: { x: 100, y: 100 }, data: {} },
      ];
      useWorkflowStore.setState({ nodes });

      const snapshot = useWorkflowStore.getState().getNodesSnapshot();

      expect(snapshot).toEqual(nodes);
    });

    it('should get edges snapshot', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ];
      useWorkflowStore.setState({ edges });

      const snapshot = useWorkflowStore.getState().getEdgesSnapshot();

      expect(snapshot).toEqual(edges);
    });
  });

  describe('group node handling', () => {
    it('should remove group and update children positions', () => {
      const groupNode: Node = {
        id: 'group-1',
        type: 'group',
        position: { x: 100, y: 200 },
        data: {},
      };
      const childNode: Node = {
        id: 'child-1',
        type: 'text',
        position: { x: 50, y: 50 },
        data: {},
        parentNode: 'group-1',
      };

      useWorkflowStore.setState({ nodes: [groupNode, childNode], edges: [] });

      useWorkflowStore.getState().removeNode('group-1');

      const state = useWorkflowStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('child-1');
      expect(state.nodes[0].parentNode).toBeUndefined();
      // Position should be adjusted: original (50,50) + parent (100,200) - 40 for y
      expect(state.nodes[0].position).toEqual({ x: 150, y: 210 });
    });

    it('should sort nodes with group nodes first', () => {
      const childNode: Node = {
        id: 'child-1',
        type: 'text',
        position: { x: 0, y: 0 },
        data: {},
        parentNode: 'group-1',
      };
      const groupNode: Node = {
        id: 'group-1',
        type: 'group',
        position: { x: 0, y: 0 },
        data: {},
      };

      // Add child first, then group
      useWorkflowStore.getState().addNode(childNode);
      useWorkflowStore.getState().addNode(groupNode);

      // Group should end up before child due to sorting
      const nodes = useWorkflowStore.getState().nodes;
      const groupIndex = nodes.findIndex((n) => n.id === 'group-1');
      const childIndex = nodes.findIndex((n) => n.id === 'child-1');

      expect(groupIndex).toBeLessThan(childIndex);
    });
  });
});
