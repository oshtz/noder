/**
 * Tests for database utility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create mock functions at the top level
const mockExecute = vi.fn();
const mockSelect = vi.fn();
const mockLoad = vi.fn();

// Mock the Tauri SQL plugin before any imports
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: () => mockLoad(),
  },
}));

describe('database', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Silence console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock - return a database object
    mockLoad.mockResolvedValue({
      execute: mockExecute,
      select: mockSelect,
    });
    mockExecute.mockResolvedValue({ lastInsertId: 1 });
    mockSelect.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('initDatabase', () => {
    it('initializes database and creates tables', async () => {
      const { initDatabase } = await import('./database');

      const db = await initDatabase();

      expect(db).toBeDefined();
      expect(mockExecute).toHaveBeenCalled();
      // Should create outputs table
      const calls = mockExecute.mock.calls.map((call) => call[0]);
      expect(calls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS outputs'))).toBe(true);
    });

    it('creates workflow_history table', async () => {
      const { initDatabase } = await import('./database');

      await initDatabase();

      const calls = mockExecute.mock.calls.map((call) => call[0]);
      expect(calls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS workflow_history'))).toBe(
        true
      );
    });

    it('creates indexes', async () => {
      const { initDatabase } = await import('./database');

      await initDatabase();

      const calls = mockExecute.mock.calls.map((call) => call[0]);
      expect(
        calls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_outputs_timestamp'))
      ).toBe(true);
      expect(calls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_outputs_type'))).toBe(
        true
      );
    });

    it('returns existing connection on subsequent calls', async () => {
      const { initDatabase } = await import('./database');

      const db1 = await initDatabase();
      const db2 = await initDatabase();

      expect(db1).toBe(db2);
    });

    it('throws error on database load failure', async () => {
      mockLoad.mockResolvedValue(null);
      const { initDatabase } = await import('./database');

      await expect(initDatabase()).rejects.toThrow('Database failed to load');
    });
  });

  describe('saveOutput', () => {
    it('saves an output to the database', async () => {
      mockExecute.mockResolvedValue({ lastInsertId: 42 });
      const { saveOutput } = await import('./database');

      const id = await saveOutput({
        type: 'image',
        value: '/path/to/image.png',
        prompt: 'a beautiful sunset',
        model: 'flux-2-klein-4b',
        nodeId: 'node-123',
        workflowId: 'workflow-456',
      });

      expect(id).toBe(42);
      // Find the INSERT call
      const insertCall = mockExecute.mock.calls.find((call) =>
        call[0].includes('INSERT INTO outputs')
      );
      expect(insertCall).toBeDefined();
      expect(insertCall?.[1]).toEqual(expect.arrayContaining(['image', '/path/to/image.png']));
    });

    it('saves output with original URL', async () => {
      mockExecute.mockResolvedValue({ lastInsertId: 43 });
      const { saveOutput } = await import('./database');

      await saveOutput({
        type: 'image',
        value: '/local/path.png',
        originalUrl: 'https://replicate.delivery/image.png',
      });

      const insertCall = mockExecute.mock.calls.find((call) =>
        call[0].includes('INSERT INTO outputs')
      );
      expect(insertCall?.[1]).toContain('https://replicate.delivery/image.png');
    });

    it('uses current timestamp when not provided', async () => {
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const { saveOutput } = await import('./database');

      await saveOutput({
        type: 'text',
        value: 'Generated text',
      });

      const insertCall = mockExecute.mock.calls.find((call) =>
        call[0].includes('INSERT INTO outputs')
      );
      expect(insertCall?.[1]).toContain(now);
    });

    it('throws error on database failure', async () => {
      // First let init succeed, then fail on save
      let callCount = 0;
      mockExecute.mockImplementation(() => {
        callCount++;
        // Init makes several calls, fail on INSERT
        if (callCount > 5) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve({ lastInsertId: 1 });
      });
      const { saveOutput } = await import('./database');

      await expect(saveOutput({ type: 'image', value: 'test' })).rejects.toThrow('Database error');
    });
  });

  describe('getOutputs', () => {
    it('returns all outputs with default options', async () => {
      const mockOutputs = [
        { id: 1, type: 'image', value: '/path1.png', timestamp: 1000 },
        { id: 2, type: 'text', value: 'text output', timestamp: 2000 },
      ];
      mockSelect.mockResolvedValue(mockOutputs);
      const { getOutputs } = await import('./database');

      const outputs = await getOutputs();

      expect(outputs).toEqual(mockOutputs);
    });

    it('filters by type', async () => {
      mockSelect.mockResolvedValue([]);
      const { getOutputs } = await import('./database');

      await getOutputs({ type: 'image' });

      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('WHERE type = ?'),
        expect.arrayContaining(['image'])
      );
    });

    it('applies pagination', async () => {
      mockSelect.mockResolvedValue([]);
      const { getOutputs } = await import('./database');

      await getOutputs({ limit: 10, offset: 20 });

      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('getOutputById', () => {
    it('returns output when found', async () => {
      const mockOutput = { id: 1, type: 'image', value: '/path.png' };
      mockSelect.mockResolvedValue([mockOutput]);
      const { getOutputById } = await import('./database');

      const output = await getOutputById(1);

      expect(output).toEqual(mockOutput);
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?'), [1]);
    });

    it('returns null when not found', async () => {
      mockSelect.mockResolvedValue([]);
      const { getOutputById } = await import('./database');

      const output = await getOutputById(999);

      expect(output).toBeNull();
    });
  });

  describe('deleteOutput', () => {
    it('deletes output by ID', async () => {
      const { deleteOutput } = await import('./database');

      await deleteOutput(123);

      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM outputs WHERE id = ?', [123]);
    });
  });

  describe('clearAllOutputs', () => {
    it('deletes all outputs', async () => {
      const { clearAllOutputs } = await import('./database');

      await clearAllOutputs();

      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM outputs');
    });
  });

  describe('getOutputStats', () => {
    it('returns count grouped by type', async () => {
      const mockStats = [
        { type: 'image', count: 10 },
        { type: 'text', count: 5 },
      ];
      mockSelect.mockResolvedValue(mockStats);
      const { getOutputStats } = await import('./database');

      const result = await getOutputStats();

      expect(result).toEqual(mockStats);
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('GROUP BY type'));
    });
  });

  describe('saveWorkflowToHistory', () => {
    it('saves workflow with serialized nodes and edges', async () => {
      mockExecute.mockResolvedValue({ lastInsertId: 100 });
      const { saveWorkflowToHistory } = await import('./database');

      const id = await saveWorkflowToHistory({
        name: 'My Workflow',
        description: 'Test workflow',
        nodes: [{ id: 'n1' }],
        edges: [{ id: 'e1' }],
        thumbnail: 'data:image/png;base64,...',
      });

      expect(id).toBe(100);
      const insertCall = mockExecute.mock.calls.find((call) =>
        call[0].includes('INSERT INTO workflow_history')
      );
      expect(insertCall).toBeDefined();
      expect(insertCall?.[1]).toContain('My Workflow');
      expect(insertCall?.[1]).toContain(JSON.stringify([{ id: 'n1' }]));
    });

    it('uses default name when not provided', async () => {
      const { saveWorkflowToHistory } = await import('./database');

      await saveWorkflowToHistory({
        nodes: [],
        edges: [],
      });

      const insertCall = mockExecute.mock.calls.find((call) =>
        call[0].includes('INSERT INTO workflow_history')
      );
      expect(insertCall?.[1]).toContain('Untitled Workflow');
    });
  });

  describe('getWorkflowHistory', () => {
    it('returns workflows with parsed JSON', async () => {
      const mockWorkflows = [
        {
          id: 1,
          name: 'Workflow 1',
          nodes: '[{"id":"n1"}]',
          edges: '[{"id":"e1"}]',
          created_at: '2024-01-01',
        },
      ];
      mockSelect.mockResolvedValue(mockWorkflows);
      const { getWorkflowHistory } = await import('./database');

      const workflows = await getWorkflowHistory();

      expect(workflows[0].nodes).toEqual([{ id: 'n1' }]);
      expect(workflows[0].edges).toEqual([{ id: 'e1' }]);
    });

    it('applies pagination', async () => {
      mockSelect.mockResolvedValue([]);
      const { getWorkflowHistory } = await import('./database');

      await getWorkflowHistory({ limit: 10, offset: 5 });

      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('LIMIT ? OFFSET ?'), [10, 5]);
    });
  });

  describe('deleteWorkflow', () => {
    it('deletes workflow from history', async () => {
      const { deleteWorkflow } = await import('./database');

      await deleteWorkflow(123);

      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM workflow_history WHERE id = ?', [123]);
    });
  });
});
