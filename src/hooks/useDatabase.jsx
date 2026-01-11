import { useState, useEffect, useCallback } from 'react';
import * as db from '../utils/database';

/**
 * React hook for interacting with the SQLite database
 */
export const useDatabase = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);

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
        setError(err);
      }
    };
    init();
  }, []);

  // Save output to database
  const saveOutput = useCallback(async (output) => {
    try {
      const id = await db.saveOutput(output);
      return id;
    } catch (err) {
      console.error('Error saving output:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Get outputs with optional filtering
  const getOutputs = useCallback(async (options = {}) => {
    try {
      const outputs = await db.getOutputs(options);
      return outputs;
    } catch (err) {
      console.error('Error getting outputs:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Get single output by ID
  const getOutputById = useCallback(async (id) => {
    try {
      const output = await db.getOutputById(id);
      return output;
    } catch (err) {
      console.error('Error getting output by ID:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Delete output
  const deleteOutput = useCallback(async (id) => {
    try {
      await db.deleteOutput(id);
    } catch (err) {
      console.error('Error deleting output:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Clear all outputs
  const clearAllOutputs = useCallback(async () => {
    try {
      await db.clearAllOutputs();
    } catch (err) {
      console.error('Error clearing outputs:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Get output statistics
  const getOutputStats = useCallback(async () => {
    try {
      const stats = await db.getOutputStats();
      return stats;
    } catch (err) {
      console.error('Error getting output stats:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Save workflow to history
  const saveWorkflowToHistory = useCallback(async (workflow) => {
    try {
      const id = await db.saveWorkflowToHistory(workflow);
      return id;
    } catch (err) {
      console.error('Error saving workflow to history:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Get workflow history
  const getWorkflowHistory = useCallback(async (options = {}) => {
    try {
      const workflows = await db.getWorkflowHistory(options);
      return workflows;
    } catch (err) {
      console.error('Error getting workflow history:', err);
      setError(err);
      throw err;
    }
  }, []);

  // Delete workflow
  const deleteWorkflow = useCallback(async (id) => {
    try {
      await db.deleteWorkflow(id);
    } catch (err) {
      console.error('Error deleting workflow:', err);
      setError(err);
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
    deleteWorkflow
  };
};

export default useDatabase;
