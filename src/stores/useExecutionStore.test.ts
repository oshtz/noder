/**
 * Tests for useExecutionStore Zustand store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useExecutionStore } from './useExecutionStore';
import type { Node, Edge } from 'reactflow';

describe('useExecutionStore', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useExecutionStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useExecutionStore.getState();

      expect(state.isProcessing).toBe(false);
      expect(state.currentWorkflowId).toBeNull();
      expect(state.failedNodes).toEqual([]);
      expect(state.showErrorRecovery).toBe(false);
      expect(state.executionState).toEqual({
        nodeOutputs: {},
        scopeNodeIds: [],
        failedNodeIds: [],
      });
      expect(state.nodeTimings).toEqual({});
      expect(state.processedNodeCount).toBe(0);
      expect(state.totalNodeCount).toBe(0);
      expect(state.currentNodeId).toBeNull();
    });
  });

  describe('processing control', () => {
    it('should start execution with workflow ID', () => {
      useExecutionStore.getState().startExecution('workflow-123');

      const state = useExecutionStore.getState();
      expect(state.currentWorkflowId).toBe('workflow-123');
      expect(state.isProcessing).toBe(true);
      expect(state.processedNodeCount).toBe(0);
      expect(state.currentNodeId).toBeNull();
    });

    it('should reset execution state when starting with resetState=true', () => {
      // Set some state first
      useExecutionStore.getState().setNodeOutput('node-1', { out: 'value' });

      useExecutionStore.getState().startExecution('workflow-123', true);

      expect(useExecutionStore.getState().executionState.nodeOutputs).toEqual({});
    });

    it('should preserve execution state when starting with resetState=false', () => {
      // Set some state first
      useExecutionStore.getState().setNodeOutput('node-1', { out: 'value' });

      useExecutionStore.getState().startExecution('workflow-123', false);

      expect(useExecutionStore.getState().executionState.nodeOutputs).toEqual({
        'node-1': { out: 'value' },
      });
    });

    it('should end execution with success', () => {
      useExecutionStore.getState().startExecution('workflow-123');
      useExecutionStore.getState().setNodeOutput('node-1', { out: 'result' });

      useExecutionStore.getState().endExecution({ success: true });

      const state = useExecutionStore.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.currentWorkflowId).toBeNull();
      expect(state.executionState.nodeOutputs).toEqual({});
    });

    it('should end execution with failure and preserve outputs', () => {
      useExecutionStore.getState().startExecution('workflow-123');

      const nodeOutputs = { 'node-1': { out: 'partial' } };
      useExecutionStore
        .getState()
        .endExecution({ success: false, nodeOutputs }, ['node-1', 'node-2'], ['node-2']);

      const state = useExecutionStore.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.executionState.nodeOutputs).toEqual(nodeOutputs);
      expect(state.executionState.scopeNodeIds).toEqual(['node-1', 'node-2']);
      expect(state.executionState.failedNodeIds).toEqual(['node-2']);
    });

    it('should set processing state directly', () => {
      useExecutionStore.getState().setIsProcessing(true);
      expect(useExecutionStore.getState().isProcessing).toBe(true);

      useExecutionStore.getState().setIsProcessing(false);
      expect(useExecutionStore.getState().isProcessing).toBe(false);
    });

    it('should set current workflow ID directly', () => {
      useExecutionStore.getState().setCurrentWorkflowId('wf-456');
      expect(useExecutionStore.getState().currentWorkflowId).toBe('wf-456');

      useExecutionStore.getState().setCurrentWorkflowId(null);
      expect(useExecutionStore.getState().currentWorkflowId).toBeNull();
    });
  });

  describe('node timing', () => {
    it('should record node start time', () => {
      const beforeTime = Date.now();
      useExecutionStore.getState().recordNodeStart('node-1');
      const afterTime = Date.now();

      const state = useExecutionStore.getState();
      expect(state.nodeTimings['node-1']).toBeGreaterThanOrEqual(beforeTime);
      expect(state.nodeTimings['node-1']).toBeLessThanOrEqual(afterTime);
      expect(state.currentNodeId).toBe('node-1');
    });

    it('should get node duration', () => {
      useExecutionStore.getState().recordNodeStart('node-1');

      // Wait a tiny bit
      const duration = useExecutionStore.getState().getNodeDuration('node-1');

      expect(duration).not.toBeNull();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return null for unknown node duration', () => {
      const duration = useExecutionStore.getState().getNodeDuration('unknown-node');
      expect(duration).toBeNull();
    });
  });

  describe('error recovery', () => {
    const mockNode: Node = {
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: { label: 'Test' },
    };

    it('should add failed node with Error object', () => {
      useExecutionStore.getState().addFailedNode('node-1', new Error('Test error'), mockNode);

      const state = useExecutionStore.getState();
      expect(state.failedNodes).toHaveLength(1);
      expect(state.failedNodes[0].id).toBe('node-1');
      expect(state.failedNodes[0].error).toBe('Test error');
      expect(state.failedNodes[0].node).toEqual(mockNode);
      expect(state.showErrorRecovery).toBe(true);
    });

    it('should add failed node with string error', () => {
      useExecutionStore.getState().addFailedNode('node-1', 'String error', mockNode);

      expect(useExecutionStore.getState().failedNodes[0].error).toBe('String error');
    });

    it('should not add duplicate failed nodes', () => {
      useExecutionStore.getState().addFailedNode('node-1', 'Error 1', mockNode);
      useExecutionStore.getState().addFailedNode('node-1', 'Error 2', mockNode);

      expect(useExecutionStore.getState().failedNodes).toHaveLength(1);
      expect(useExecutionStore.getState().failedNodes[0].error).toBe('Error 1');
    });

    it('should remove failed node', () => {
      useExecutionStore.getState().addFailedNode('node-1', 'Error 1', mockNode);
      useExecutionStore
        .getState()
        .addFailedNode('node-2', 'Error 2', { ...mockNode, id: 'node-2' });

      useExecutionStore.getState().removeFailedNode('node-1');

      const state = useExecutionStore.getState();
      expect(state.failedNodes).toHaveLength(1);
      expect(state.failedNodes[0].id).toBe('node-2');
    });

    it('should hide error recovery when last failed node is removed', () => {
      useExecutionStore.getState().addFailedNode('node-1', 'Error', mockNode);
      expect(useExecutionStore.getState().showErrorRecovery).toBe(true);

      useExecutionStore.getState().removeFailedNode('node-1');
      expect(useExecutionStore.getState().showErrorRecovery).toBe(false);
    });

    it('should clear all failed nodes', () => {
      useExecutionStore.getState().addFailedNode('node-1', 'Error 1', mockNode);
      useExecutionStore
        .getState()
        .addFailedNode('node-2', 'Error 2', { ...mockNode, id: 'node-2' });

      useExecutionStore.getState().clearFailedNodes();

      expect(useExecutionStore.getState().failedNodes).toEqual([]);
      expect(useExecutionStore.getState().showErrorRecovery).toBe(false);
    });

    it('should close error recovery panel', () => {
      useExecutionStore.getState().addFailedNode('node-1', 'Error', mockNode);
      useExecutionStore.getState().closeErrorRecovery();

      expect(useExecutionStore.getState().showErrorRecovery).toBe(false);
    });

    it('should set error recovery visibility directly', () => {
      useExecutionStore.getState().setShowErrorRecovery(true);
      expect(useExecutionStore.getState().showErrorRecovery).toBe(true);

      useExecutionStore.getState().setShowErrorRecovery(false);
      expect(useExecutionStore.getState().showErrorRecovery).toBe(false);
    });
  });

  describe('execution state', () => {
    it('should get execution state', () => {
      useExecutionStore.getState().setNodeOutput('node-1', { out: 'value' });

      const execState = useExecutionStore.getState().getExecutionState();

      expect(execState.nodeOutputs['node-1']).toEqual({ out: 'value' });
    });

    it('should check if has resume state (with outputs)', () => {
      expect(useExecutionStore.getState().hasResumeState()).toBe(false);

      useExecutionStore.getState().setNodeOutput('node-1', { out: 'value' });

      expect(useExecutionStore.getState().hasResumeState()).toBe(true);
    });

    it('should check if has resume state (with scope)', () => {
      useExecutionStore
        .getState()
        .endExecution({ success: false, nodeOutputs: {} }, ['node-1'], []);

      expect(useExecutionStore.getState().hasResumeState()).toBe(true);
    });

    it('should check if has resume state (with failed)', () => {
      useExecutionStore
        .getState()
        .endExecution({ success: false, nodeOutputs: {} }, [], ['node-1']);

      expect(useExecutionStore.getState().hasResumeState()).toBe(true);
    });
  });

  describe('prepareResumeState', () => {
    const edges: Edge[] = [
      { id: 'e1', source: 'node-1', target: 'node-2' },
      { id: 'e2', source: 'node-2', target: 'node-3' },
    ];

    beforeEach(() => {
      // Setup some initial state
      useExecutionStore.getState().setNodeOutput('node-1', { out: 'v1' });
      useExecutionStore.getState().setNodeOutput('node-2', { out: 'v2' });
      useExecutionStore.getState().setNodeOutput('node-3', { out: 'v3' });
      useExecutionStore.getState().endExecution(
        {
          success: false,
          nodeOutputs: {
            'node-1': { out: 'v1' },
            'node-2': { out: 'v2' },
            'node-3': { out: 'v3' },
          },
        },
        ['node-1', 'node-2', 'node-3'],
        ['node-2']
      );
    });

    it('should prepare resume state with retry nodes', () => {
      const resumeState = useExecutionStore
        .getState()
        .prepareResumeState(['node-1', 'node-2', 'node-3'], ['node-2'], false, edges);

      expect(resumeState.retryNodeIdSet.has('node-2')).toBe(true);
      expect(resumeState.retryNodeIdSet.has('node-3')).toBe(true); // downstream
      expect(resumeState.initialNodeOutputs['node-1']).toEqual({ out: 'v1' });
      expect(resumeState.initialNodeOutputs['node-2']).toBeUndefined(); // being retried
    });

    it('should include failed nodes when retryFailed is true', () => {
      const resumeState = useExecutionStore
        .getState()
        .prepareResumeState(['node-1', 'node-2', 'node-3'], [], true, edges);

      expect(resumeState.retryNodeIdSet.has('node-2')).toBe(true);
      expect(resumeState.failedNodeIdSet.has('node-2')).toBe(true);
    });
  });

  describe('getDownstreamNodeIds', () => {
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'b', target: 'd' },
      { id: 'e4', source: 'c', target: 'e' },
    ];

    it('should find downstream nodes from array', () => {
      const downstream = useExecutionStore.getState().getDownstreamNodeIds(['a'], edges);

      expect(downstream.has('b')).toBe(true);
      expect(downstream.has('c')).toBe(true);
      expect(downstream.has('d')).toBe(true);
      expect(downstream.has('e')).toBe(true);
      expect(downstream.has('a')).toBe(false); // not the start node
    });

    it('should find downstream nodes from Set', () => {
      const downstream = useExecutionStore.getState().getDownstreamNodeIds(new Set(['b']), edges);

      expect(downstream.has('c')).toBe(true);
      expect(downstream.has('d')).toBe(true);
      expect(downstream.has('e')).toBe(true);
      expect(downstream.has('a')).toBe(false);
      expect(downstream.has('b')).toBe(false);
    });

    it('should handle node with no downstream', () => {
      const downstream = useExecutionStore.getState().getDownstreamNodeIds(['e'], edges);

      expect(downstream.size).toBe(0);
    });

    it('should handle multiple start nodes', () => {
      const downstream = useExecutionStore.getState().getDownstreamNodeIds(['c', 'd'], edges);

      expect(downstream.has('e')).toBe(true);
      expect(downstream.size).toBe(1);
    });
  });

  describe('progress tracking', () => {
    it('should set progress', () => {
      useExecutionStore.getState().setProgress(5, 10, 'node-5');

      const state = useExecutionStore.getState();
      expect(state.processedNodeCount).toBe(5);
      expect(state.totalNodeCount).toBe(10);
      expect(state.currentNodeId).toBe('node-5');
    });

    it('should set progress without current node', () => {
      useExecutionStore.getState().setProgress(3, 8);

      const state = useExecutionStore.getState();
      expect(state.processedNodeCount).toBe(3);
      expect(state.totalNodeCount).toBe(8);
      expect(state.currentNodeId).toBeNull();
    });

    it('should increment progress', () => {
      useExecutionStore.getState().setProgress(2, 10);
      useExecutionStore.getState().incrementProgress();

      expect(useExecutionStore.getState().processedNodeCount).toBe(3);
    });
  });

  describe('node output management', () => {
    it('should set node output', () => {
      useExecutionStore.getState().setNodeOutput('node-1', { out: 'value', extra: 123 });

      expect(useExecutionStore.getState().executionState.nodeOutputs['node-1']).toEqual({
        out: 'value',
        extra: 123,
      });
    });

    it('should get node output', () => {
      useExecutionStore.getState().setNodeOutput('node-1', { out: 'value' });

      const output = useExecutionStore.getState().getNodeOutput('node-1');
      expect(output).toEqual({ out: 'value' });
    });

    it('should return null for unknown node output', () => {
      const output = useExecutionStore.getState().getNodeOutput('unknown');
      expect(output).toBeNull();
    });

    it('should clear all node outputs', () => {
      useExecutionStore.getState().setNodeOutput('node-1', { out: 'v1' });
      useExecutionStore.getState().setNodeOutput('node-2', { out: 'v2' });

      useExecutionStore.getState().clearNodeOutputs();

      expect(useExecutionStore.getState().executionState.nodeOutputs).toEqual({});
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      // Modify state
      useExecutionStore.getState().startExecution('wf-123');
      useExecutionStore.getState().setNodeOutput('node-1', { out: 'value' });
      useExecutionStore.getState().setProgress(5, 10, 'node-5');
      useExecutionStore.getState().addFailedNode('node-2', 'Error', {
        id: 'node-2',
        type: 'text',
        position: { x: 0, y: 0 },
        data: {},
      });

      // Reset
      useExecutionStore.getState().reset();

      // Verify defaults
      const state = useExecutionStore.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.currentWorkflowId).toBeNull();
      expect(state.failedNodes).toEqual([]);
      expect(state.executionState.nodeOutputs).toEqual({});
      expect(state.processedNodeCount).toBe(0);
    });
  });
});
