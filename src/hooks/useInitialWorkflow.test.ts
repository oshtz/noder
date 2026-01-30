import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInitialWorkflow } from './useInitialWorkflow';
import { LOCAL_WORKFLOW_KEY } from '../utils/workflowSchema';

// Mock dependencies
vi.mock('../utils/workflowSchema', async () => {
  const actual = await vi.importActual('../utils/workflowSchema');
  return {
    ...actual,
    migrateWorkflowDocument: vi.fn((doc) => doc),
  };
});

vi.mock('../utils/createNode', () => ({
  sortNodesForReactFlow: vi.fn((nodes) => nodes),
}));

vi.mock('../utils/workflowHelpers', () => ({
  prepareEdges: vi.fn((edges) => edges),
}));

describe('useInitialWorkflow', () => {
  let originalLocalStorage: Storage;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    originalLocalStorage = window.localStorage;

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
    vi.clearAllMocks();
  });

  describe('when no stored workflow exists', () => {
    it('should return empty arrays for nodes and edges', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.initialNodes).toEqual([]);
      expect(result.current.initialEdges).toEqual([]);
    });

    it('should show welcome screen', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.showWelcomeInitially).toBe(true);
    });

    it('should return empty outputs', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.initialOutputs).toEqual([]);
    });
  });

  describe('when a stored workflow document exists', () => {
    beforeEach(() => {
      const workflowDoc = {
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }],
        edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
        outputs: [{ nodeId: 'node-1', output: 'test' }],
        metadata: { name: 'Test Workflow' },
      };
      localStorageMock[LOCAL_WORKFLOW_KEY] = JSON.stringify(workflowDoc);
    });

    it('should return nodes from stored workflow', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.initialNodes).toHaveLength(1);
      expect(result.current.initialNodes[0].id).toBe('node-1');
    });

    it('should return edges from stored workflow', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.initialEdges).toHaveLength(1);
      expect(result.current.initialEdges[0].id).toBe('edge-1');
    });

    it('should return outputs from stored workflow', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.initialOutputs).toHaveLength(1);
    });

    it('should not show welcome screen', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.showWelcomeInitially).toBe(false);
    });
  });

  describe('when legacy storage format exists', () => {
    beforeEach(() => {
      localStorageMock['noder-nodes'] = JSON.stringify([
        { id: 'legacy-node', position: { x: 100, y: 100 }, data: {} },
      ]);
      localStorageMock['noder-edges'] = JSON.stringify([
        { id: 'legacy-edge', source: 'a', target: 'b' },
      ]);
    });

    it('should migrate legacy nodes', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.initialNodes).toHaveLength(1);
      expect(result.current.initialNodes[0].id).toBe('legacy-node');
    });

    it('should migrate legacy edges', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.initialEdges).toHaveLength(1);
      expect(result.current.initialEdges[0].id).toBe('legacy-edge');
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON in stored workflow', () => {
      localStorageMock[LOCAL_WORKFLOW_KEY] = 'invalid json {{{';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useInitialWorkflow());

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.current.initialNodes).toEqual([]);
      expect(result.current.initialEdges).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe('validation errors', () => {
    it('should initialize with empty validation errors', () => {
      const { result } = renderHook(() => useInitialWorkflow());

      expect(result.current.initialValidationErrors).toEqual([]);
    });
  });

  describe('memoization', () => {
    it('should return stable references on rerender', () => {
      const workflowDoc = {
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
        metadata: { name: 'Test' },
      };
      localStorageMock[LOCAL_WORKFLOW_KEY] = JSON.stringify(workflowDoc);

      const { result, rerender } = renderHook(() => useInitialWorkflow());

      const firstNodes = result.current.initialNodes;
      const firstEdges = result.current.initialEdges;

      rerender();

      expect(result.current.initialNodes).toBe(firstNodes);
      expect(result.current.initialEdges).toBe(firstEdges);
    });
  });
});
