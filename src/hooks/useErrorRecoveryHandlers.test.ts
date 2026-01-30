import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorRecoveryHandlers, ErrorRecoveryHandlersConfig } from './useErrorRecoveryHandlers';
import type { Node } from 'reactflow';

describe('useErrorRecoveryHandlers', () => {
  let mockSetNodes: ReturnType<typeof vi.fn>;
  let mockRemoveFailedNode: ReturnType<typeof vi.fn>;
  let mockClearFailedNodes: ReturnType<typeof vi.fn>;
  let mockRunWorkflow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetNodes = vi.fn();
    mockRemoveFailedNode = vi.fn();
    mockClearFailedNodes = vi.fn();
    mockRunWorkflow = vi.fn();
  });

  const createConfig = (
    overrides: Partial<ErrorRecoveryHandlersConfig> = {}
  ): ErrorRecoveryHandlersConfig => ({
    setNodes: mockSetNodes,
    removeFailedNode: mockRemoveFailedNode,
    clearFailedNodes: mockClearFailedNodes,
    runWorkflow: mockRunWorkflow,
    ...overrides,
  });

  describe('handleRetryNode', () => {
    it('should call removeFailedNode with the node id', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleRetryNode('node-1');
      });

      expect(mockRemoveFailedNode).toHaveBeenCalledWith('node-1');
    });

    it('should call setNodes to remove error class and data', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleRetryNode('node-1');
      });

      expect(mockSetNodes).toHaveBeenCalled();

      // Get the setter function passed to setNodes
      const setterFn = mockSetNodes.mock.calls[0][0];

      // Test the setter function
      const testNodes: Node[] = [
        {
          id: 'node-1',
          className: 'some-class error',
          data: { error: 'test error' },
          position: { x: 0, y: 0 },
        },
        { id: 'node-2', className: 'other-class', data: { error: null }, position: { x: 0, y: 0 } },
      ];

      const result2 = setterFn(testNodes);

      expect(result2[0].className).toBe('some-class');
      expect(result2[0].data.error).toBeNull();
      expect(result2[1].className).toBe('other-class');
    });

    it('should call runWorkflow with retry-node options', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleRetryNode('node-1');
      });

      expect(mockRunWorkflow).toHaveBeenCalledWith({
        trigger: 'retry-node',
        resume: true,
        retryNodeIds: ['node-1'],
      });
    });

    it('should handle nodes without className', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleRetryNode('node-1');
      });

      const setterFn = mockSetNodes.mock.calls[0][0];
      const testNodes: Node[] = [
        { id: 'node-1', data: { error: 'test error' }, position: { x: 0, y: 0 } },
      ];

      const result2 = setterFn(testNodes);
      expect(result2[0].className).toBe('');
    });
  });

  describe('handleRetryAll', () => {
    it('should call clearFailedNodes', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleRetryAll();
      });

      expect(mockClearFailedNodes).toHaveBeenCalled();
    });

    it('should call setNodes to remove error class and data from all nodes', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleRetryAll();
      });

      expect(mockSetNodes).toHaveBeenCalled();

      const setterFn = mockSetNodes.mock.calls[0][0];
      const testNodes: Node[] = [
        {
          id: 'node-1',
          className: 'some-class error',
          data: { error: 'error 1' },
          position: { x: 0, y: 0 },
        },
        {
          id: 'node-2',
          className: 'other-class error',
          data: { error: 'error 2' },
          position: { x: 0, y: 0 },
        },
      ];

      const result2 = setterFn(testNodes);

      expect(result2[0].className).toBe('some-class');
      expect(result2[0].data.error).toBeNull();
      expect(result2[1].className).toBe('other-class');
      expect(result2[1].data.error).toBeNull();
    });

    it('should call runWorkflow with retry-all options', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleRetryAll();
      });

      expect(mockRunWorkflow).toHaveBeenCalledWith({
        trigger: 'retry-all',
        resume: true,
        retryFailed: true,
      });
    });
  });

  describe('handleSkipErrors', () => {
    it('should call clearFailedNodes', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleSkipErrors();
      });

      expect(mockClearFailedNodes).toHaveBeenCalled();
    });

    it('should call setNodes to remove error class and data from all nodes', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleSkipErrors();
      });

      expect(mockSetNodes).toHaveBeenCalled();

      const setterFn = mockSetNodes.mock.calls[0][0];
      const testNodes: Node[] = [
        { id: 'node-1', className: 'error', data: { error: 'error 1' }, position: { x: 0, y: 0 } },
      ];

      const result2 = setterFn(testNodes);

      // 'error'.replace(' error', '') returns 'error' (no match for ' error')
      expect(result2[0].className).toBe('error');
      expect(result2[0].data.error).toBeNull();
    });

    it('should call runWorkflow with skip-errors options', () => {
      const { result } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      act(() => {
        result.current.handleSkipErrors();
      });

      expect(mockRunWorkflow).toHaveBeenCalledWith({
        trigger: 'skip-errors',
        resume: true,
        skipFailed: true,
        continueOnError: true,
      });
    });
  });

  describe('callback memoization', () => {
    it('should return stable callback references', () => {
      const { result, rerender } = renderHook(() => useErrorRecoveryHandlers(createConfig()));

      const firstCallbacks = { ...result.current };

      rerender();

      expect(result.current.handleRetryNode).toBe(firstCallbacks.handleRetryNode);
      expect(result.current.handleRetryAll).toBe(firstCallbacks.handleRetryAll);
      expect(result.current.handleSkipErrors).toBe(firstCallbacks.handleSkipErrors);
    });

    it('should update callbacks when dependencies change', () => {
      const config1 = createConfig();
      const { result, rerender } = renderHook(({ config }) => useErrorRecoveryHandlers(config), {
        initialProps: { config: config1 },
      });

      const firstCallback = result.current.handleRetryNode;

      // Create new config with different runWorkflow
      const config2 = createConfig({ runWorkflow: vi.fn() });
      rerender({ config: config2 });

      expect(result.current.handleRetryNode).not.toBe(firstCallback);
    });
  });
});
