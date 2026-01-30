import Database from '@tauri-apps/plugin-sql';

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

/**
 * Initialize the SQLite database and create tables if they don't exist
 */
export async function initDatabase(): Promise<SqlDatabase> {
  if (db) {
    console.log('[Database] Already initialized, returning existing connection');
    return db;
  }

  try {
    console.log('[Database] Initializing database...');
    // Load or create the database
    const loaded = await Database.load('sqlite:noder.db');
    db = loaded as SqlDatabase;
    const database = db;
    if (!database) {
      throw new Error('Database failed to load');
    }
    console.log('[Database] Database loaded successfully');

    // Create outputs table
    console.log('[Database] Creating outputs table...');
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
      console.log('[Database] Added original_url column');
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
      console.log('[Database] Current outputs count:', count[0]?.count || 0);

      // Show latest output if any
      if (count[0]?.count > 0) {
        const latest = await database.select<
          Pick<OutputRow, 'id' | 'type' | 'value' | 'timestamp'>
        >('SELECT id, type, value, timestamp FROM outputs ORDER BY timestamp DESC LIMIT 1');
        console.log('[Database] Latest output:', latest[0]);
      }
    } catch (e) {
      console.log('[Database] Could not get count:', e);
    }

    console.log('[Database] Database initialized successfully');
    return database;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Save an output to the database
 */
export async function saveOutput(output: OutputInput): Promise<number | null | undefined> {
  console.log('[Database] saveOutput called with:', output);
  const database = await initDatabase();

  try {
    console.log('[Database] Executing INSERT with params:', {
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

    console.log('[Database] Output saved successfully. ID:', result.lastInsertId);
    return result.lastInsertId;
  } catch (error) {
    console.error('[Database] Failed to save output:', error);
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
  console.log('[Database] getOutputs called with:', { type, limit, offset });
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

    console.log('[Database] Executing query:', query, 'params:', params);

    const outputs = await database.select<OutputRow>(query, params);
    console.log('[Database] Query returned', outputs?.length || 0, 'outputs');
    return outputs;
  } catch (error) {
    console.error('Failed to get outputs:', error);
    throw error;
  }
}

/**
 * Get a single output by ID
 */
export async function getOutputById(id: number): Promise<OutputRow | null> {
  const database = await initDatabase();

  try {
    const outputs = await database.select<OutputRow>('SELECT * FROM outputs WHERE id = ?', [id]);
    return outputs[0] || null;
  } catch (error) {
    console.error('Failed to get output by ID:', error);
    throw error;
  }
}

/**
 * Delete an output by ID
 */
export async function deleteOutput(id: number): Promise<void> {
  const database = await initDatabase();

  try {
    await database.execute('DELETE FROM outputs WHERE id = ?', [id]);
    console.log('Output deleted:', id);
  } catch (error) {
    console.error('Failed to delete output:', error);
    throw error;
  }
}

/**
 * Delete all outputs
 */
export async function clearAllOutputs(): Promise<void> {
  const database = await initDatabase();

  try {
    await database.execute('DELETE FROM outputs');
    console.log('All outputs cleared');
  } catch (error) {
    console.error('Failed to clear outputs:', error);
    throw error;
  }
}

/**
 * Get output count by type
 */
export async function getOutputStats(): Promise<OutputStatsRow[]> {
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
    console.error('Failed to get output stats:', error);
    throw error;
  }
}

/**
 * Save a workflow to history
 */
export async function saveWorkflowToHistory(
  workflow: WorkflowHistoryInput
): Promise<number | null | undefined> {
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

    console.log('Workflow saved to history:', result);
    return result.lastInsertId;
  } catch (error) {
    console.error('Failed to save workflow to history:', error);
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
    console.error('Failed to get workflow history:', error);
    throw error;
  }
}

/**
 * Delete a workflow from history
 */
export async function deleteWorkflow(id: number): Promise<void> {
  const database = await initDatabase();

  try {
    await database.execute('DELETE FROM workflow_history WHERE id = ?', [id]);
    console.log('Workflow deleted:', id);
  } catch (error) {
    console.error('Failed to delete workflow:', error);
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
