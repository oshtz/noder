import { isTauriRuntime } from './runtime';

import { logger } from './logger';
type ExecuteResult = {
  lastInsertId?: number | null;
};

type SqlDatabase = {
  execute: (query: string, params?: unknown[]) => Promise<ExecuteResult>;
  select: <T = unknown>(query: string, params?: unknown[]) => Promise<T[]>;
};

export type OutputInput = {
  type: string;
  value: string;
  originalUrl?: string | null;
  prompt?: string | null;
  model?: string | null;
  nodeId?: string | null;
  workflowId?: string | null;
  timestamp?: number;
};

export type OutputRow = {
  id: number;
  type: string;
  value: string;
  original_url: string | null;
  prompt: string | null;
  model: string | null;
  node_id: string | null;
  workflow_id: string | null;
  timestamp: number;
  created_at: string;
};

export type OutputStatsRow = {
  type: string;
  count: number;
};

export type WorkflowHistoryInput = {
  name?: string;
  description?: string | null;
  nodes: unknown;
  edges: unknown;
  thumbnail?: string | null;
};

export type WorkflowHistoryRow = {
  id: number;
  name: string | null;
  description: string | null;
  nodes: string;
  edges: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowHistoryEntry = Omit<WorkflowHistoryRow, 'nodes' | 'edges'> & {
  nodes: unknown;
  edges: unknown;
};

export type GetOutputsOptions = {
  type?: string | null;
  limit?: number;
  offset?: number;
};

export type GetWorkflowHistoryOptions = {
  limit?: number;
  offset?: number;
};

let db: SqlDatabase | null = null;
let webOutputId = 1;
const webOutputs: OutputRow[] = [];

/**
 * Initialize the SQLite database and create tables if they don't exist
 */
export async function initDatabase(): Promise<SqlDatabase> {
  if (!isTauriRuntime()) {
    throw new Error('SQLite database is unavailable outside the Tauri desktop runtime');
  }

  if (db) {
    logger.debug('[Database] Already initialized, returning existing connection');
    return db;
  }

  try {
    logger.debug('[Database] Initializing database...');
    // Load or create the database
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    const loaded = await Database.load('sqlite:noder.db');
    db = loaded as SqlDatabase;
    const database = db;
    if (!database) {
      throw new Error('Database failed to load');
    }
    logger.debug('[Database] Database loaded successfully');

    // Create outputs table
    logger.debug('[Database] Creating outputs table...');
    await database.execute(`
      CREATE TABLE IF NOT EXISTS outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        original_url TEXT,
        prompt TEXT,
        model TEXT,
        node_id TEXT,
        workflow_id TEXT,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add original_url column if it doesn't exist (migration for existing databases)
    try {
      await database.execute(`ALTER TABLE outputs ADD COLUMN original_url TEXT`);
      logger.debug('[Database] Added original_url column');
    } catch (e) {
      // Column likely already exists, ignore
    }

    // Create workflow_history table for saved workflows
    await database.execute(`
      CREATE TABLE IF NOT EXISTS workflow_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        nodes TEXT NOT NULL,
        edges TEXT NOT NULL,
        thumbnail TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster queries
    await database.execute(`
      CREATE INDEX IF NOT EXISTS idx_outputs_timestamp ON outputs(timestamp DESC)
    `);

    await database.execute(`
      CREATE INDEX IF NOT EXISTS idx_outputs_type ON outputs(type)
    `);

    // Debug: Check how many outputs exist in the database
    try {
      const count = await database.select<{ count: number }>(
        'SELECT COUNT(*) as count FROM outputs'
      );
      logger.debug('[Database] Current outputs count:', count[0]?.count || 0);

      // Show latest output if any
      if (count[0]?.count > 0) {
        const latest = await database.select<
          Pick<OutputRow, 'id' | 'type' | 'value' | 'timestamp'>
        >('SELECT id, type, value, timestamp FROM outputs ORDER BY timestamp DESC LIMIT 1');
        logger.debug('[Database] Latest output:', latest[0]);
      }
    } catch (e) {
      logger.debug('[Database] Could not get count:', e);
    }

    logger.debug('[Database] Database initialized successfully');
    return database;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Save an output to the database
 */
export async function saveOutput(output: OutputInput): Promise<number | null | undefined> {
  if (!isTauriRuntime()) {
    const id = webOutputId++;
    webOutputs.unshift({
      id,
      type: output.type,
      value: output.value,
      original_url: output.originalUrl || null,
      prompt: output.prompt || null,
      model: output.model || null,
      node_id: output.nodeId || null,
      workflow_id: output.workflowId || null,
      timestamp: output.timestamp || Date.now(),
      created_at: new Date().toISOString(),
    });
    return id;
  }

  logger.debug('[Database] saveOutput called with:', output);
  const database = await initDatabase();

  try {
    logger.debug('[Database] Executing INSERT with params:', {
      type: output.type,
      value: output.value?.substring(0, 50) + '...',
      originalUrl: output.originalUrl ? output.originalUrl.substring(0, 50) + '...' : null,
      prompt: output.prompt,
      model: output.model,
      nodeId: output.nodeId,
      workflowId: output.workflowId,
      timestamp: output.timestamp || Date.now(),
    });

    const result = await database.execute(
      `INSERT INTO outputs (type, value, original_url, prompt, model, node_id, workflow_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        output.type,
        output.value,
        output.originalUrl || null,
        output.prompt || null,
        output.model || null,
        output.nodeId || null,
        output.workflowId || null,
        output.timestamp || Date.now(),
      ]
    );

    logger.debug('[Database] Output saved successfully. ID:', result.lastInsertId);
    return result.lastInsertId;
  } catch (error) {
    logger.error('[Database] Failed to save output:', error);
    throw error;
  }
}

/**
 * Get all outputs with optional filtering and pagination
 */
export async function getOutputs({
  type = null,
  limit = 100,
  offset = 0,
}: GetOutputsOptions = {}): Promise<OutputRow[]> {
  if (!isTauriRuntime()) {
    const filtered = type ? webOutputs.filter((output) => output.type === type) : webOutputs;
    return filtered.slice(offset, offset + limit);
  }

  logger.debug('[Database] getOutputs called with:', { type, limit, offset });
  const database = await initDatabase();

  try {
    let query = 'SELECT * FROM outputs';
    const params: Array<string | number> = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    if (offset) {
      query += ' OFFSET ?';
      params.push(offset);
    }

    logger.debug('[Database] Executing query:', query, 'params:', params);

    const outputs = await database.select<OutputRow>(query, params);
    logger.debug('[Database] Query returned', outputs?.length || 0, 'outputs');
    return outputs;
  } catch (error) {
    logger.error('Failed to get outputs:', error);
    throw error;
  }
}

/**
 * Get a single output by ID
 */
export async function getOutputById(id: number): Promise<OutputRow | null> {
  if (!isTauriRuntime()) {
    return webOutputs.find((output) => output.id === id) || null;
  }

  const database = await initDatabase();

  try {
    const outputs = await database.select<OutputRow>('SELECT * FROM outputs WHERE id = ?', [id]);
    return outputs[0] || null;
  } catch (error) {
    logger.error('Failed to get output by ID:', error);
    throw error;
  }
}

/**
 * Delete an output by ID
 */
export async function deleteOutput(id: number): Promise<void> {
  if (!isTauriRuntime()) {
    const index = webOutputs.findIndex((output) => output.id === id);
    if (index >= 0) webOutputs.splice(index, 1);
    return;
  }

  const database = await initDatabase();

  try {
    await database.execute('DELETE FROM outputs WHERE id = ?', [id]);
    logger.debug('Output deleted:', id);
  } catch (error) {
    logger.error('Failed to delete output:', error);
    throw error;
  }
}

/**
 * Delete all outputs
 */
export async function clearAllOutputs(): Promise<void> {
  if (!isTauriRuntime()) {
    webOutputs.splice(0, webOutputs.length);
    return;
  }

  const database = await initDatabase();

  try {
    await database.execute('DELETE FROM outputs');
    logger.debug('All outputs cleared');
  } catch (error) {
    logger.error('Failed to clear outputs:', error);
    throw error;
  }
}

/**
 * Get output count by type
 */
export async function getOutputStats(): Promise<OutputStatsRow[]> {
  if (!isTauriRuntime()) {
    const counts = webOutputs.reduce<Record<string, number>>((acc, output) => {
      acc[output.type] = (acc[output.type] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([type, count]) => ({ type, count }));
  }

  const database = await initDatabase();

  try {
    const stats = await database.select<OutputStatsRow>(`
      SELECT 
        type,
        COUNT(*) as count
      FROM outputs
      GROUP BY type
    `);
    return stats;
  } catch (error) {
    logger.error('Failed to get output stats:', error);
    throw error;
  }
}

/**
 * Save a workflow to history
 */
export async function saveWorkflowToHistory(
  workflow: WorkflowHistoryInput
): Promise<number | null | undefined> {
  if (!isTauriRuntime()) {
    return null;
  }

  const database = await initDatabase();

  try {
    const result = await database.execute(
      `INSERT INTO workflow_history (name, description, nodes, edges, thumbnail)
       VALUES (?, ?, ?, ?, ?)`,
      [
        workflow.name || 'Untitled Workflow',
        workflow.description || null,
        JSON.stringify(workflow.nodes),
        JSON.stringify(workflow.edges),
        workflow.thumbnail || null,
      ]
    );

    logger.debug('Workflow saved to history:', result);
    return result.lastInsertId;
  } catch (error) {
    logger.error('Failed to save workflow to history:', error);
    throw error;
  }
}

/**
 * Get all saved workflows
 */
export async function getWorkflowHistory({
  limit = 50,
  offset = 0,
}: GetWorkflowHistoryOptions = {}): Promise<WorkflowHistoryEntry[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  const database = await initDatabase();

  try {
    const workflows = await database.select<WorkflowHistoryRow>(
      `SELECT * FROM workflow_history
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Parse JSON strings back to objects
    return workflows.map((wf) => ({
      ...wf,
      nodes: JSON.parse(wf.nodes),
      edges: JSON.parse(wf.edges),
    }));
  } catch (error) {
    logger.error('Failed to get workflow history:', error);
    throw error;
  }
}

/**
 * Delete a workflow from history
 */
export async function deleteWorkflow(id: number): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const database = await initDatabase();

  try {
    await database.execute('DELETE FROM workflow_history WHERE id = ?', [id]);
    logger.debug('Workflow deleted:', id);
  } catch (error) {
    logger.error('Failed to delete workflow:', error);
    throw error;
  }
}

export default {
  initDatabase,
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
