import { useState, useEffect, useCallback } from 'react';
import * as db from '../utils/database';

// Re-export types from database module for convenience
export type {
  OutputInput,
  OutputRow,
  OutputStatsRow,
  WorkflowHistoryInput,
  WorkflowHistoryEntry,
  GetOutputsOptions,
  GetWorkflowHistoryOptions,
} from '../utils/database';

export interface UseDatabaseReturn {
  isInitialized: boolean;
  error: Error | null;
  saveOutput: (output: db.OutputInput) => Promise<number | null | undefined>;
  getOutputs: (options?: db.GetOutputsOptions) => Promise<db.OutputRow[]>;
  getOutputById: (id: number) => Promise<db.OutputRow | null>;
  deleteOutput: (id: number) => Promise<void>;
  clearAllOutputs: () => Promise<void>;
  getOutputStats: () => Promise<db.OutputStatsRow[]>;
  saveWorkflowToHistory: (workflow: db.WorkflowHistoryInput) => Promise<number | null | undefined>;
  getWorkflowHistory: (
    options?: db.GetWorkflowHistoryOptions
  ) => Promise<db.WorkflowHistoryEntry[]>;
  deleteWorkflow: (id: number) => Promise<void>;
}

/**
 * React hook for interacting with the SQLite database
 */
export const useDatabase = (): UseDatabaseReturn => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize database on mount
  useEffect(() => {
    const init = async () => {
      console.log('[useDatabase] Starting database initialization...');
      try {
        await db.initDatabase();
        console.log('[useDatabase] Database initialized successfully');
        setIsInitialized(true);
      } catch (err) {
        console.error('[useDatabase] Database initialization error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    init();
  }, []);

  // Save output to database
  const saveOutput = useCallback(
    async (output: db.OutputInput): Promise<number | null | undefined> => {
      try {
        const id = await db.saveOutput(output);
        return id;
      } catch (err) {
        console.error('Error saving output:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    []
  );

  // Get outputs with optional filtering
  const getOutputs = useCallback(
    async (options: db.GetOutputsOptions = {}): Promise<db.OutputRow[]> => {
      try {
        const outputs = await db.getOutputs(options);
        return outputs;
      } catch (err) {
        console.error('Error getting outputs:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    []
  );

  // Get single output by ID
  const getOutputById = useCallback(async (id: number): Promise<db.OutputRow | null> => {
    try {
      const output = await db.getOutputById(id);
      return output;
    } catch (err) {
      console.error('Error getting output by ID:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  // Delete output
  const deleteOutput = useCallback(async (id: number): Promise<void> => {
    try {
      await db.deleteOutput(id);
    } catch (err) {
      console.error('Error deleting output:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  // Clear all outputs
  const clearAllOutputs = useCallback(async (): Promise<void> => {
    try {
      await db.clearAllOutputs();
    } catch (err) {
      console.error('Error clearing outputs:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  // Get output statistics
  const getOutputStats = useCallback(async (): Promise<db.OutputStatsRow[]> => {
    try {
      const stats = await db.getOutputStats();
      return stats;
    } catch (err) {
      console.error('Error getting output stats:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  // Save workflow to history
  const saveWorkflowToHistory = useCallback(
    async (workflow: db.WorkflowHistoryInput): Promise<number | null | undefined> => {
      try {
        const id = await db.saveWorkflowToHistory(workflow);
        return id;
      } catch (err) {
        console.error('Error saving workflow to history:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    []
  );

  // Get workflow history
  const getWorkflowHistory = useCallback(
    async (options: db.GetWorkflowHistoryOptions = {}): Promise<db.WorkflowHistoryEntry[]> => {
      try {
        const workflows = await db.getWorkflowHistory(options);
        return workflows;
      } catch (err) {
        console.error('Error getting workflow history:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    []
  );

  // Delete workflow
  const deleteWorkflow = useCallback(async (id: number): Promise<void> => {
    try {
      await db.deleteWorkflow(id);
    } catch (err) {
      console.error('Error deleting workflow:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  return {
    isInitialized,
    error,
    saveOutput,
    getOutputs,
    getOutputById,
    deleteOutput,
    clearAllOutputs,
    getOutputStats,
    saveWorkflowToHistory,
    getWorkflowHistory,
    deleteWorkflow,
  };
};

export default useDatabase;
