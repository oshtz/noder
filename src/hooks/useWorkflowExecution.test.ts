/**
 * Tests for useWorkflowExecution hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowExecution, type FailedNode } from './useWorkflowExecution';
import type { Node, Edge } from 'reactflow';

describe('useWorkflowExecution', () => {
  describe('initial state', () => {
    it('should have correct initial values', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.currentWorkflowId).toBeNull();
      expect(result.current.failedNodes).toEqual([]);
      expect(result.current.showErrorRecovery).toBe(false);
    });

    it('should have empty execution state ref', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      const state = result.current.getExecutionState();
      expect(state.nodeOutputs).toEqual({});
      expect(state.scopeNodeIds).toEqual([]);
      expect(state.failedNodeIds).toEqual([]);
    });
  });

  describe('startExecution', () => {
    it('should start execution with workflow ID', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.startExecution('workflow-1');
      });

      expect(result.current.isProcessing).toBe(true);
      expect(result.current.currentWorkflowId).toBe('workflow-1');
    });

    it('should reset execution state by default', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      // First, set some state
      act(() => {
        result.current.executionStateRef.current = {
          nodeOutputs: { 'node-1': { value: 'test' } },
          scopeNodeIds: ['node-1'],
          failedNodeIds: ['node-2'],
        };
        result.current.startExecution('workflow-1');
      });

      const state = result.current.getExecutionState();
      expect(state.nodeOutputs).toEqual({});
      expect(state.scopeNodeIds).toEqual([]);
      expect(state.failedNodeIds).toEqual([]);
    });

    it('should preserve execution state when resetState is false', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.executionStateRef.current = {
          nodeOutputs: { 'node-1': { value: 'test' } },
          scopeNodeIds: ['node-1'],
          failedNodeIds: [],
        };
        result.current.startExecution('workflow-1', false);
      });

      const state = result.current.getExecutionState();
      expect(state.nodeOutputs).toEqual({ 'node-1': { value: 'test' } });
    });

    it('should reset node timings', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.recordNodeStart('node-1');
        result.current.startExecution('workflow-1');
      });

      expect(result.current.getNodeDuration('node-1')).toBeNull();
    });
  });

  describe('endExecution', () => {
    it('should end execution and clear state on success', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.startExecution('workflow-1');
      });

      act(() => {
        result.current.endExecution({ success: true });
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.currentWorkflowId).toBeNull();
      const state = result.current.getExecutionState();
      expect(state.nodeOutputs).toEqual({});
    });

    it('should preserve state on failure', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.startExecution('workflow-1');
      });

      const outputs = { 'node-1': { value: 'output1' } };
      act(() => {
        result.current.endExecution(
          { success: false, nodeOutputs: outputs },
          ['node-1', 'node-2'],
          ['node-2']
        );
      });

      expect(result.current.isProcessing).toBe(false);
      const state = result.current.getExecutionState();
      expect(state.nodeOutputs).toEqual(outputs);
      expect(state.scopeNodeIds).toEqual(['node-1', 'node-2']);
      expect(state.failedNodeIds).toEqual(['node-2']);
    });

    it('should handle null result', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.startExecution('workflow-1');
        result.current.endExecution(null);
      });

      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('node timing', () => {
    it('should record node start time', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.recordNodeStart('node-1');
      });

      const duration = result.current.getNodeDuration('node-1');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return null for unrecorded nodes', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      expect(result.current.getNodeDuration('unknown-node')).toBeNull();
    });

    it('should track duration over time', async () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.recordNodeStart('node-1');
      });

      // Wait a small amount of time
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = result.current.getNodeDuration('node-1');
      expect(duration).toBeGreaterThanOrEqual(10);
    });
  });

  describe('failed nodes management', () => {
    const createMockNode = (id: string): Node => ({
      id,
      type: 'test',
      position: { x: 0, y: 0 },
      data: {},
    });

    it('should add a failed node', () => {
      const { result } = renderHook(() => useWorkflowExecution());
      const mockNode = createMockNode('node-1');

      act(() => {
        result.current.addFailedNode('node-1', 'Test error', mockNode);
      });

      expect(result.current.failedNodes).toHaveLength(1);
      expect(result.current.failedNodes[0]).toEqual({
        id: 'node-1',
        error: 'Test error',
        node: mockNode,
      });
      expect(result.current.showErrorRecovery).toBe(true);
    });

    it('should handle Error object', () => {
      const { result } = renderHook(() => useWorkflowExecution());
      const mockNode = createMockNode('node-1');
      const error = new Error('Error message');

      act(() => {
        result.current.addFailedNode('node-1', error, mockNode);
      });

      expect(result.current.failedNodes[0].error).toBe('Error message');
    });

    it('should not add duplicate failed nodes', () => {
      const { result } = renderHook(() => useWorkflowExecution());
      const mockNode = createMockNode('node-1');

      act(() => {
        result.current.addFailedNode('node-1', 'Error 1', mockNode);
        result.current.addFailedNode('node-1', 'Error 2', mockNode);
      });

      expect(result.current.failedNodes).toHaveLength(1);
      expect(result.current.failedNodes[0].error).toBe('Error 1');
    });

    it('should remove a specific failed node', () => {
      const { result } = renderHook(() => useWorkflowExecution());
      const mockNode1 = createMockNode('node-1');
      const mockNode2 = createMockNode('node-2');

      act(() => {
        result.current.addFailedNode('node-1', 'Error 1', mockNode1);
        result.current.addFailedNode('node-2', 'Error 2', mockNode2);
      });

      act(() => {
        result.current.removeFailedNode('node-1');
      });

      expect(result.current.failedNodes).toHaveLength(1);
      expect(result.current.failedNodes[0].id).toBe('node-2');
    });

    it('should hide error recovery when last failed node is removed', () => {
      const { result } = renderHook(() => useWorkflowExecution());
      const mockNode = createMockNode('node-1');

      act(() => {
        result.current.addFailedNode('node-1', 'Error', mockNode);
      });

      expect(result.current.showErrorRecovery).toBe(true);

      act(() => {
        result.current.removeFailedNode('node-1');
      });

      expect(result.current.showErrorRecovery).toBe(false);
    });

    it('should clear all failed nodes', () => {
      const { result } = renderHook(() => useWorkflowExecution());
      const mockNode1 = createMockNode('node-1');
      const mockNode2 = createMockNode('node-2');

      act(() => {
        result.current.addFailedNode('node-1', 'Error 1', mockNode1);
        result.current.addFailedNode('node-2', 'Error 2', mockNode2);
      });

      act(() => {
        result.current.clearFailedNodes();
      });

      expect(result.current.failedNodes).toHaveLength(0);
      expect(result.current.showErrorRecovery).toBe(false);
    });

    it('should close error recovery without clearing failed nodes', () => {
      const { result } = renderHook(() => useWorkflowExecution());
      const mockNode = createMockNode('node-1');

      act(() => {
        result.current.addFailedNode('node-1', 'Error', mockNode);
      });

      act(() => {
        result.current.closeErrorRecovery();
      });

      expect(result.current.showErrorRecovery).toBe(false);
      expect(result.current.failedNodes).toHaveLength(1);
    });
  });

  describe('hasResumeState', () => {
    it('should return false when no outputs exist', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      expect(result.current.hasResumeState()).toBe(false);
    });

    it('should return true when outputs exist', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.executionStateRef.current = {
          nodeOutputs: { 'node-1': { value: 'test' } },
          scopeNodeIds: [],
          failedNodeIds: [],
        };
      });

      expect(result.current.hasResumeState()).toBe(true);
    });
  });

  describe('getDownstreamNodeIds', () => {
    it('should return downstream nodes', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      const edges: Edge[] = [
        { id: 'e1', source: 'node-1', target: 'node-2' },
        { id: 'e2', source: 'node-2', target: 'node-3' },
        { id: 'e3', source: 'node-1', target: 'node-4' },
      ];

      const downstream = result.current.getDownstreamNodeIds(new Set(['node-1']), edges);

      expect(downstream.has('node-1')).toBe(true);
      expect(downstream.has('node-2')).toBe(true);
      expect(downstream.has('node-3')).toBe(true);
      expect(downstream.has('node-4')).toBe(true);
    });

    it('should handle array input', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      const edges: Edge[] = [{ id: 'e1', source: 'node-1', target: 'node-2' }];

      const downstream = result.current.getDownstreamNodeIds(['node-1'], edges);

      expect(downstream.has('node-1')).toBe(true);
      expect(downstream.has('node-2')).toBe(true);
    });

    it('should handle disconnected nodes', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      const edges: Edge[] = [{ id: 'e1', source: 'node-1', target: 'node-2' }];

      const downstream = result.current.getDownstreamNodeIds(new Set(['node-3']), edges);

      expect(downstream.has('node-3')).toBe(true);
      expect(downstream.size).toBe(1);
    });

    it('should handle cycles without infinite loop', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      const edges: Edge[] = [
        { id: 'e1', source: 'node-1', target: 'node-2' },
        { id: 'e2', source: 'node-2', target: 'node-1' },
      ];

      const downstream = result.current.getDownstreamNodeIds(new Set(['node-1']), edges);

      expect(downstream.has('node-1')).toBe(true);
      expect(downstream.has('node-2')).toBe(true);
      expect(downstream.size).toBe(2);
    });
  });

  describe('prepareResumeState', () => {
    it('should prepare resume state with existing outputs', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.executionStateRef.current = {
          nodeOutputs: {
            'node-1': { value: 'output1' },
            'node-2': { value: 'output2' },
            'node-3': { value: 'output3' },
          },
          scopeNodeIds: ['node-1', 'node-2', 'node-3'],
          failedNodeIds: ['node-3'],
        };
      });

      const resumeState = result.current.prepareResumeState(['node-1', 'node-2', 'node-3']);

      // Failed node output should be removed
      expect(resumeState.initialNodeOutputs['node-1']).toEqual({ value: 'output1' });
      expect(resumeState.initialNodeOutputs['node-2']).toEqual({ value: 'output2' });
      expect(resumeState.initialNodeOutputs['node-3']).toBeUndefined();
      expect(resumeState.failedNodeIdSet.has('node-3')).toBe(true);
    });

    it('should only include outputs in scope', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.executionStateRef.current = {
          nodeOutputs: {
            'node-1': { value: 'output1' },
            'node-2': { value: 'output2' },
          },
          scopeNodeIds: [],
          failedNodeIds: [],
        };
      });

      const resumeState = result.current.prepareResumeState(['node-1']);

      expect(resumeState.initialNodeOutputs['node-1']).toEqual({ value: 'output1' });
      expect(resumeState.initialNodeOutputs['node-2']).toBeUndefined();
    });

    it('should add retry nodes and their downstream to retry set', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      const edges: Edge[] = [{ id: 'e1', source: 'node-2', target: 'node-3' }];

      act(() => {
        result.current.executionStateRef.current = {
          nodeOutputs: {
            'node-1': { value: 'output1' },
            'node-2': { value: 'output2' },
            'node-3': { value: 'output3' },
          },
          scopeNodeIds: [],
          failedNodeIds: [],
        };
      });

      const resumeState = result.current.prepareResumeState(
        ['node-1', 'node-2', 'node-3'],
        ['node-2'],
        false,
        edges
      );

      expect(resumeState.retryNodeIdSet.has('node-2')).toBe(true);
      expect(resumeState.retryNodeIdSet.has('node-3')).toBe(true);
      // Retry nodes should have their outputs removed
      expect(resumeState.initialNodeOutputs['node-2']).toBeUndefined();
      expect(resumeState.initialNodeOutputs['node-3']).toBeUndefined();
    });

    it('should add failed nodes to retry set when retryFailed is true', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.executionStateRef.current = {
          nodeOutputs: {
            'node-1': { value: 'output1' },
          },
          scopeNodeIds: [],
          failedNodeIds: ['node-2'],
        };
      });

      const resumeState = result.current.prepareResumeState(
        ['node-1', 'node-2'],
        [],
        true, // retryFailed
        []
      );

      expect(resumeState.retryNodeIdSet.has('node-2')).toBe(true);
    });
  });

  describe('setters', () => {
    it('should allow setting isProcessing directly', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.setIsProcessing(true);
      });

      expect(result.current.isProcessing).toBe(true);
    });

    it('should allow setting currentWorkflowId directly', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.setCurrentWorkflowId('test-id');
      });

      expect(result.current.currentWorkflowId).toBe('test-id');
    });

    it('should allow setting showErrorRecovery directly', () => {
      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.setShowErrorRecovery(true);
      });

      expect(result.current.showErrorRecovery).toBe(true);
    });

    it('should allow setting failedNodes directly', () => {
      const { result } = renderHook(() => useWorkflowExecution());
      const mockNodes: FailedNode[] = [
        {
          id: 'node-1',
          error: 'Error',
          node: { id: 'node-1', position: { x: 0, y: 0 }, data: {} } as Node,
        },
      ];

      act(() => {
        result.current.setFailedNodes(mockNodes);
      });

      expect(result.current.failedNodes).toEqual(mockNodes);
    });
  });
});
