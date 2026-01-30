import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDatabase } from './useDatabase';
import * as db from '../utils/database';

vi.mock('../utils/database', () => ({
  initDatabase: vi.fn(),
  saveOutput: vi.fn(),
  getOutputs: vi.fn(),
  getOutputById: vi.fn(),
  deleteOutput: vi.fn(),
  clearAllOutputs: vi.fn(),
  getOutputStats: vi.fn(),
  saveWorkflowToHistory: vi.fn(),
  getWorkflowHistory: vi.fn(),
  deleteWorkflow: vi.fn(),
}));

const mockedDb = vi.mocked(db);

describe('useDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDb.initDatabase.mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should start with isInitialized as false', () => {
      const { result } = renderHook(() => useDatabase());
      expect(result.current.isInitialized).toBe(false);
    });

    it('should start with error as null', () => {
      const { result } = renderHook(() => useDatabase());
      expect(result.current.error).toBeNull();
    });

    it('should call initDatabase on mount', async () => {
      renderHook(() => useDatabase());
      await waitFor(() => {
        expect(mockedDb.initDatabase).toHaveBeenCalledTimes(1);
      });
    });

    it('should set isInitialized to true after successful init', async () => {
      const { result } = renderHook(() => useDatabase());
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
    });

    it('should set error when initDatabase fails', async () => {
      const testError = new Error('Init failed');
      mockedDb.initDatabase.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });

    it('should handle non-Error rejection in initDatabase', async () => {
      mockedDb.initDatabase.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('string error');
      });
    });
  });

  describe('saveOutput', () => {
    it('should call db.saveOutput and return id', async () => {
      mockedDb.saveOutput.mockResolvedValueOnce(123);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      let savedId: number | null | undefined;
      await act(async () => {
        savedId = await result.current.saveOutput({
          type: 'image',
          value: '/path/to/image.png',
          nodeId: 'node-1',
          workflowId: 'workflow-1',
        });
      });

      expect(mockedDb.saveOutput).toHaveBeenCalledWith({
        type: 'image',
        value: '/path/to/image.png',
        nodeId: 'node-1',
        workflowId: 'workflow-1',
      });
      expect(savedId).toBe(123);
    });

    it('should set error and throw when saveOutput fails', async () => {
      const testError = new Error('Save failed');
      mockedDb.saveOutput.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await expect(
        result.current.saveOutput({
          type: 'image',
          value: '/path/to/image.png',
          nodeId: 'node-1',
          workflowId: 'workflow-1',
        })
      ).rejects.toThrow('Save failed');

      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });
  });

  describe('getOutputs', () => {
    it('should call db.getOutputs with default options', async () => {
      mockedDb.getOutputs.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      let outputs: db.OutputRow[];
      await act(async () => {
        outputs = await result.current.getOutputs();
      });

      expect(mockedDb.getOutputs).toHaveBeenCalledWith({});
      expect(outputs!).toEqual([]);
    });

    it('should pass options to db.getOutputs', async () => {
      const mockOutputs: db.OutputRow[] = [
        {
          id: 1,
          type: 'image',
          value: '/path.png',
          node_id: 'n1',
          workflow_id: 'w1',
          created_at: '2024-01-01',
        },
      ];
      mockedDb.getOutputs.mockResolvedValueOnce(mockOutputs);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      let outputs: db.OutputRow[];
      await act(async () => {
        outputs = await result.current.getOutputs({ type: 'image', limit: 10 });
      });

      expect(mockedDb.getOutputs).toHaveBeenCalledWith({ type: 'image', limit: 10 });
      expect(outputs!).toEqual(mockOutputs);
    });

    it('should set error and throw when getOutputs fails', async () => {
      const testError = new Error('Get failed');
      mockedDb.getOutputs.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await expect(result.current.getOutputs()).rejects.toThrow('Get failed');
      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });
  });

  describe('getOutputById', () => {
    it('should call db.getOutputById and return result', async () => {
      const mockOutput: db.OutputRow = {
        id: 1,
        type: 'image',
        value: '/path.png',
        node_id: 'n1',
        workflow_id: 'w1',
        created_at: '2024-01-01',
      };
      mockedDb.getOutputById.mockResolvedValueOnce(mockOutput);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      let output: db.OutputRow | null;
      await act(async () => {
        output = await result.current.getOutputById(1);
      });

      expect(mockedDb.getOutputById).toHaveBeenCalledWith(1);
      expect(output!).toEqual(mockOutput);
    });

    it('should return null when output not found', async () => {
      mockedDb.getOutputById.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      let output: db.OutputRow | null;
      await act(async () => {
        output = await result.current.getOutputById(999);
      });

      expect(output!).toBeNull();
    });

    it('should set error and throw when getOutputById fails', async () => {
      const testError = new Error('Get by ID failed');
      mockedDb.getOutputById.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await expect(result.current.getOutputById(1)).rejects.toThrow('Get by ID failed');
      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });
  });

  describe('deleteOutput', () => {
    it('should call db.deleteOutput', async () => {
      mockedDb.deleteOutput.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await act(async () => {
        await result.current.deleteOutput(1);
      });

      expect(mockedDb.deleteOutput).toHaveBeenCalledWith(1);
    });

    it('should set error and throw when deleteOutput fails', async () => {
      const testError = new Error('Delete failed');
      mockedDb.deleteOutput.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await expect(result.current.deleteOutput(1)).rejects.toThrow('Delete failed');
      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });
  });

  describe('clearAllOutputs', () => {
    it('should call db.clearAllOutputs', async () => {
      mockedDb.clearAllOutputs.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await act(async () => {
        await result.current.clearAllOutputs();
      });

      expect(mockedDb.clearAllOutputs).toHaveBeenCalled();
    });

    it('should set error and throw when clearAllOutputs fails', async () => {
      const testError = new Error('Clear failed');
      mockedDb.clearAllOutputs.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await expect(result.current.clearAllOutputs()).rejects.toThrow('Clear failed');
      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });
  });

  describe('getOutputStats', () => {
    it('should call db.getOutputStats and return results', async () => {
      const mockStats: db.OutputStatsRow[] = [
        { type: 'image', count: 10 },
        { type: 'video', count: 5 },
      ];
      mockedDb.getOutputStats.mockResolvedValueOnce(mockStats);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      let stats: db.OutputStatsRow[];
      await act(async () => {
        stats = await result.current.getOutputStats();
      });

      expect(mockedDb.getOutputStats).toHaveBeenCalled();
      expect(stats!).toEqual(mockStats);
    });

    it('should set error and throw when getOutputStats fails', async () => {
      const testError = new Error('Stats failed');
      mockedDb.getOutputStats.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await expect(result.current.getOutputStats()).rejects.toThrow('Stats failed');
      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });
  });

  describe('saveWorkflowToHistory', () => {
    it('should call db.saveWorkflowToHistory and return id', async () => {
      mockedDb.saveWorkflowToHistory.mockResolvedValueOnce(456);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      let savedId: number | null | undefined;
      await act(async () => {
        savedId = await result.current.saveWorkflowToHistory({
          name: 'Test Workflow',
          data: JSON.stringify({ nodes: [], edges: [] }),
        });
      });

      expect(mockedDb.saveWorkflowToHistory).toHaveBeenCalledWith({
        name: 'Test Workflow',
        data: JSON.stringify({ nodes: [], edges: [] }),
      });
      expect(savedId).toBe(456);
    });

    it('should set error and throw when saveWorkflowToHistory fails', async () => {
      const testError = new Error('Save workflow failed');
      mockedDb.saveWorkflowToHistory.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await expect(
        result.current.saveWorkflowToHistory({
          name: 'Test',
          data: '{}',
        })
      ).rejects.toThrow('Save workflow failed');
      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });
  });

  describe('getWorkflowHistory', () => {
    it('should call db.getWorkflowHistory with default options', async () => {
      mockedDb.getWorkflowHistory.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      let history: db.WorkflowHistoryEntry[];
      await act(async () => {
        history = await result.current.getWorkflowHistory();
      });

      expect(mockedDb.getWorkflowHistory).toHaveBeenCalledWith({});
      expect(history!).toEqual([]);
    });

    it('should pass options to db.getWorkflowHistory', async () => {
      const mockHistory: db.WorkflowHistoryEntry[] = [
        {
          id: 1,
          name: 'Workflow 1',
          data: '{}',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      mockedDb.getWorkflowHistory.mockResolvedValueOnce(mockHistory);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      let history: db.WorkflowHistoryEntry[];
      await act(async () => {
        history = await result.current.getWorkflowHistory({ limit: 5 });
      });

      expect(mockedDb.getWorkflowHistory).toHaveBeenCalledWith({ limit: 5 });
      expect(history!).toEqual(mockHistory);
    });

    it('should set error and throw when getWorkflowHistory fails', async () => {
      const testError = new Error('Get history failed');
      mockedDb.getWorkflowHistory.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await expect(result.current.getWorkflowHistory()).rejects.toThrow('Get history failed');
      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });
  });

  describe('deleteWorkflow', () => {
    it('should call db.deleteWorkflow', async () => {
      mockedDb.deleteWorkflow.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await act(async () => {
        await result.current.deleteWorkflow(1);
      });

      expect(mockedDb.deleteWorkflow).toHaveBeenCalledWith(1);
    });

    it('should set error and throw when deleteWorkflow fails', async () => {
      const testError = new Error('Delete workflow failed');
      mockedDb.deleteWorkflow.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useDatabase());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));

      await expect(result.current.deleteWorkflow(1)).rejects.toThrow('Delete workflow failed');
      await waitFor(() => {
        expect(result.current.error).toEqual(testError);
      });
    });
  });
});
