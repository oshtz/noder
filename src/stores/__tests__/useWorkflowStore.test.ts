import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from '../useWorkflowStore';
import type { Node, Edge } from 'reactflow';

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

  describe('node operations', () => {
    it('should add a node', () => {
      const store = useWorkflowStore.getState();

      const node: Node = {
        id: 'node-1',
        type: 'text',
        position: { x: 100, y: 200 },
        data: { label: 'Test Node' },
      };

      store.addNode(node);

      const state = useWorkflowStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('node-1');
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('should update a node', () => {
      useWorkflowStore.setState({
        nodes: [
          {
            id: 'node-1',
            type: 'text',
            position: { x: 0, y: 0 },
            data: { label: 'Original' },
          },
        ],
      });

      const store = useWorkflowStore.getState();
      store.updateNode('node-1', { position: { x: 100, y: 200 } });

      const node = useWorkflowStore.getState().nodes[0];
      expect(node.position).toEqual({ x: 100, y: 200 });
    });

    it('should update node data', () => {
      useWorkflowStore.setState({
        nodes: [
          {
            id: 'node-1',
            type: 'text',
            position: { x: 0, y: 0 },
            data: { label: 'Original', value: 1 },
          },
        ],
      });

      const store = useWorkflowStore.getState();
      store.updateNodeData('node-1', { value: 2, newProp: 'test' });

      const nodeData = useWorkflowStore.getState().nodes[0].data;
      expect(nodeData.value).toBe(2);
      expect(nodeData.newProp).toBe('test');
      expect(nodeData.label).toBe('Original');
    });

    it('should remove a node and connected edges', () => {
      useWorkflowStore.setState({
        nodes: [
          { id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} },
          { id: 'node-2', type: 'text', position: { x: 100, y: 0 }, data: {} },
        ],
        edges: [
          {
            id: 'e1-2',
            source: 'node-1',
            target: 'node-2',
            sourceHandle: 'out',
            targetHandle: 'in',
          },
        ],
      });

      const store = useWorkflowStore.getState();
      store.removeNode('node-1');

      const state = useWorkflowStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('node-2');
      expect(state.edges).toHaveLength(0);
    });

    it('should set nodes with function updater', () => {
      useWorkflowStore.setState({
        nodes: [{ id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
      });

      const store = useWorkflowStore.getState();
      store.setNodes((nodes) => [
        ...nodes,
        { id: 'node-2', type: 'image', position: { x: 100, y: 0 }, data: {} },
      ]);

      expect(useWorkflowStore.getState().nodes).toHaveLength(2);
    });
  });

  describe('edge operations', () => {
    it('should add an edge', () => {
      const store = useWorkflowStore.getState();

      const edge: Edge = {
        id: 'e1-2',
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'out',
        targetHandle: 'in',
      };

      store.addEdge(edge);

      const state = useWorkflowStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('should add edge from connection', () => {
      const store = useWorkflowStore.getState();

      store.addEdge({
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'out',
        targetHandle: 'in',
      });

      const state = useWorkflowStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].source).toBe('node-1');
      expect(state.edges[0].target).toBe('node-2');
    });

    it('should remove an edge', () => {
      useWorkflowStore.setState({
        edges: [
          { id: 'e1-2', source: 'node-1', target: 'node-2' },
          { id: 'e2-3', source: 'node-2', target: 'node-3' },
        ],
      });

      const store = useWorkflowStore.getState();
      store.removeEdge('e1-2');

      expect(useWorkflowStore.getState().edges).toHaveLength(1);
      expect(useWorkflowStore.getState().edges[0].id).toBe('e2-3');
    });
  });

  describe('workflow management', () => {
    it('should set active workflow', () => {
      const store = useWorkflowStore.getState();

      const workflow = { id: 'wf-1', name: 'Test Workflow' };
      store.setActiveWorkflow(workflow);

      expect(useWorkflowStore.getState().activeWorkflow).toEqual(workflow);
    });

    it('should load workflow document', () => {
      const store = useWorkflowStore.getState();

      const document = {
        nodes: [{ id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
        edges: [{ id: 'e1-2', source: 'node-1', target: 'node-2' }],
        viewport: { x: 100, y: 100, zoom: 1.5 },
        metadata: { name: 'Test', id: 'wf-1' },
      };

      store.loadWorkflow(document);

      const state = useWorkflowStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.edges).toHaveLength(1);
      expect(state.viewport).toEqual({ x: 100, y: 100, zoom: 1.5 });
      expect(state.workflowMetadata?.name).toBe('Test');
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should clear workflow', () => {
      useWorkflowStore.setState({
        nodes: [{ id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
        edges: [{ id: 'e1-2', source: 'node-1', target: 'node-2' }],
        activeWorkflow: { id: 'wf-1', name: 'Test' },
        hasUnsavedChanges: true,
      });

      const store = useWorkflowStore.getState();
      store.clearWorkflow();

      const state = useWorkflowStore.getState();
      expect(state.nodes).toHaveLength(0);
      expect(state.edges).toHaveLength(0);
      expect(state.activeWorkflow).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
    });
  });

  describe('output management', () => {
    it('should add workflow output', () => {
      const store = useWorkflowStore.getState();

      const output = {
        id: 'out-1',
        nodeId: 'node-1',
        type: 'image' as const,
        value: 'http://example.com/image.png',
        timestamp: Date.now(),
      };

      store.addWorkflowOutput(output);

      expect(useWorkflowStore.getState().workflowOutputs).toHaveLength(1);
    });

    it('should remove workflow output', () => {
      useWorkflowStore.setState({
        workflowOutputs: [
          { id: 'out-1', nodeId: 'node-1', type: 'image', value: 'url1', timestamp: 1 },
          { id: 'out-2', nodeId: 'node-2', type: 'text', value: 'text', timestamp: 2 },
        ],
      });

      const store = useWorkflowStore.getState();
      store.removeWorkflowOutput('out-1');

      expect(useWorkflowStore.getState().workflowOutputs).toHaveLength(1);
      expect(useWorkflowStore.getState().workflowOutputs[0].id).toBe('out-2');
    });
  });

  describe('snapshots', () => {
    it('should return nodes snapshot', () => {
      const nodes = [
        { id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', type: 'image', position: { x: 100, y: 0 }, data: {} },
      ];

      useWorkflowStore.setState({ nodes });

      const store = useWorkflowStore.getState();
      const snapshot = store.getNodesSnapshot();

      expect(snapshot).toEqual(nodes);
    });

    it('should return edges snapshot', () => {
      const edges = [
        { id: 'e1-2', source: 'node-1', target: 'node-2' },
        { id: 'e2-3', source: 'node-2', target: 'node-3' },
      ];

      useWorkflowStore.setState({ edges });

      const store = useWorkflowStore.getState();
      const snapshot = store.getEdgesSnapshot();

      expect(snapshot).toEqual(edges);
    });
  });
});
