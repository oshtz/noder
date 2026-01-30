import { describe, it, expect, beforeEach } from 'vitest';
import { useExecutionStore } from '../useExecutionStore';
import type { Node, Edge } from 'reactflow';

describe('useExecutionStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useExecutionStore.setState({
      isProcessing: false,
      currentWorkflowId: null,
      failedNodes: [],
      showErrorRecovery: false,
      executionState: {
        nodeOutputs: {},
        scopeNodeIds: [],
        failedNodeIds: [],
      },
      nodeTimings: {},
      processedNodeCount: 0,
      totalNodeCount: 0,
      currentNodeId: null,
    });
  });

  describe('execution lifecycle', () => {
    it('should start execution', () => {
      const store = useExecutionStore.getState();

      store.startExecution('workflow-123');

      const state = useExecutionStore.getState();
      expect(state.isProcessing).toBe(true);
      expect(state.currentWorkflowId).toBe('workflow-123');
      expect(state.processedNodeCount).toBe(0);
    });

    it('should end execution successfully', () => {
      useExecutionStore.setState({
        isProcessing: true,
        currentWorkflowId: 'workflow-123',
      });

      const store = useExecutionStore.getState();
      store.endExecution({ success: true });

      const state = useExecutionStore.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.currentWorkflowId).toBeNull();
      expect(state.executionState.nodeOutputs).toEqual({});
    });

    it('should end execution with failure and preserve state', () => {
      useExecutionStore.setState({
        isProcessing: true,
        currentWorkflowId: 'workflow-123',
      });

      const store = useExecutionStore.getState();
      const nodeOutputs = { 'node-1': { value: 'test' } };
      const scopeNodeIds = ['node-1', 'node-2'];
      const failedNodeIds = ['node-2'];

      store.endExecution({ success: false, nodeOutputs }, scopeNodeIds, failedNodeIds);

      const state = useExecutionStore.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.executionState.nodeOutputs).toEqual(nodeOutputs);
      expect(state.executionState.scopeNodeIds).toEqual(scopeNodeIds);
      expect(state.executionState.failedNodeIds).toEqual(failedNodeIds);
    });
  });

  describe('node timing', () => {
    it('should record node start time', () => {
      const store = useExecutionStore.getState();

      const before = Date.now();
      store.recordNodeStart('node-1');
      const after = Date.now();

      const state = useExecutionStore.getState();
      expect(state.nodeTimings['node-1']).toBeGreaterThanOrEqual(before);
      expect(state.nodeTimings['node-1']).toBeLessThanOrEqual(after);
      expect(state.currentNodeId).toBe('node-1');
    });

    it('should calculate node duration', async () => {
      const store = useExecutionStore.getState();

      store.recordNodeStart('node-1');

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = store.getNodeDuration('node-1');
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should return null for unrecorded node', () => {
      const store = useExecutionStore.getState();
      expect(store.getNodeDuration('nonexistent')).toBeNull();
    });
  });

  describe('error recovery', () => {
    it('should add failed node', () => {
      const store = useExecutionStore.getState();
      const node: Node = {
        id: 'node-1',
        type: 'text',
        position: { x: 0, y: 0 },
        data: {},
      };

      store.addFailedNode('node-1', new Error('Test error'), node);

      const state = useExecutionStore.getState();
      expect(state.failedNodes).toHaveLength(1);
      expect(state.failedNodes[0].id).toBe('node-1');
      expect(state.failedNodes[0].error).toBe('Test error');
      expect(state.showErrorRecovery).toBe(true);
    });

    it('should not add duplicate failed nodes', () => {
      const store = useExecutionStore.getState();
      const node: Node = {
        id: 'node-1',
        type: 'text',
        position: { x: 0, y: 0 },
        data: {},
      };

      store.addFailedNode('node-1', 'Error 1', node);
      store.addFailedNode('node-1', 'Error 2', node);

      expect(useExecutionStore.getState().failedNodes).toHaveLength(1);
    });

    it('should remove failed node', () => {
      useExecutionStore.setState({
        failedNodes: [
          { id: 'node-1', error: 'Error 1', node: {} as Node },
          { id: 'node-2', error: 'Error 2', node: {} as Node },
        ],
        showErrorRecovery: true,
      });

      const store = useExecutionStore.getState();
      store.removeFailedNode('node-1');

      const state = useExecutionStore.getState();
      expect(state.failedNodes).toHaveLength(1);
      expect(state.failedNodes[0].id).toBe('node-2');
    });

    it('should clear all failed nodes', () => {
      useExecutionStore.setState({
        failedNodes: [
          { id: 'node-1', error: 'Error 1', node: {} as Node },
          { id: 'node-2', error: 'Error 2', node: {} as Node },
        ],
        showErrorRecovery: true,
      });

      const store = useExecutionStore.getState();
      store.clearFailedNodes();

      const state = useExecutionStore.getState();
      expect(state.failedNodes).toHaveLength(0);
      expect(state.showErrorRecovery).toBe(false);
    });
  });

  describe('progress tracking', () => {
    it('should set progress', () => {
      const store = useExecutionStore.getState();

      store.setProgress(5, 10, 'node-5');

      const state = useExecutionStore.getState();
      expect(state.processedNodeCount).toBe(5);
      expect(state.totalNodeCount).toBe(10);
      expect(state.currentNodeId).toBe('node-5');
    });

    it('should increment progress', () => {
      useExecutionStore.setState({
        processedNodeCount: 3,
        totalNodeCount: 10,
      });

      const store = useExecutionStore.getState();
      store.incrementProgress();

      expect(useExecutionStore.getState().processedNodeCount).toBe(4);
    });
  });

  describe('node outputs', () => {
    it('should set node output', () => {
      const store = useExecutionStore.getState();

      store.setNodeOutput('node-1', { value: 'result', type: 'text' });

      const state = useExecutionStore.getState();
      expect(state.executionState.nodeOutputs['node-1']).toEqual({
        value: 'result',
        type: 'text',
      });
    });

    it('should get node output', () => {
      useExecutionStore.setState({
        executionState: {
          nodeOutputs: { 'node-1': { value: 'test' } },
          scopeNodeIds: [],
          failedNodeIds: [],
        },
      });

      const store = useExecutionStore.getState();
      const output = store.getNodeOutput('node-1');

      expect(output).toEqual({ value: 'test' });
    });

    it('should return null for missing output', () => {
      const store = useExecutionStore.getState();
      expect(store.getNodeOutput('nonexistent')).toBeNull();
    });

    it('should clear node outputs', () => {
      useExecutionStore.setState({
        executionState: {
          nodeOutputs: { 'node-1': { value: 'test' } },
          scopeNodeIds: ['node-1'],
          failedNodeIds: [],
        },
      });

      const store = useExecutionStore.getState();
      store.clearNodeOutputs();

      expect(useExecutionStore.getState().executionState.nodeOutputs).toEqual({});
    });
  });

  describe('resume state', () => {
    it('should detect resume state exists', () => {
      useExecutionStore.setState({
        executionState: {
          nodeOutputs: { 'node-1': { value: 'test' } },
          scopeNodeIds: ['node-1'],
          failedNodeIds: [],
        },
      });

      const store = useExecutionStore.getState();
      expect(store.hasResumeState()).toBe(true);
    });

    it('should detect no resume state', () => {
      const store = useExecutionStore.getState();
      expect(store.hasResumeState()).toBe(false);
    });
  });

  describe('downstream nodes', () => {
    it('should find downstream node ids', () => {
      const store = useExecutionStore.getState();

      const edges: Edge[] = [
        { id: 'e1-2', source: 'node-1', target: 'node-2' },
        { id: 'e2-3', source: 'node-2', target: 'node-3' },
        { id: 'e3-4', source: 'node-3', target: 'node-4' },
      ];

      const downstream = store.getDownstreamNodeIds(new Set(['node-1']), edges);

      expect(downstream.has('node-2')).toBe(true);
      expect(downstream.has('node-3')).toBe(true);
      expect(downstream.has('node-4')).toBe(true);
      expect(downstream.has('node-1')).toBe(false);
    });

    it('should handle array input', () => {
      const store = useExecutionStore.getState();

      const edges: Edge[] = [{ id: 'e1-2', source: 'node-1', target: 'node-2' }];

      const downstream = store.getDownstreamNodeIds(['node-1'], edges);

      expect(downstream.has('node-2')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      useExecutionStore.setState({
        isProcessing: true,
        currentWorkflowId: 'workflow-123',
        failedNodes: [{ id: 'node-1', error: 'Error', node: {} as Node }],
        showErrorRecovery: true,
        processedNodeCount: 5,
        totalNodeCount: 10,
      });

      const store = useExecutionStore.getState();
      store.reset();

      const state = useExecutionStore.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.currentWorkflowId).toBeNull();
      expect(state.failedNodes).toHaveLength(0);
      expect(state.showErrorRecovery).toBe(false);
      expect(state.processedNodeCount).toBe(0);
      expect(state.totalNodeCount).toBe(0);
    });
  });
});
