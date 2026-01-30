/**
 * Tests for workflows API
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  listWorkflows,
  loadWorkflow,
  saveWorkflow,
  deleteWorkflow,
  exportWorkflowToFile,
  importWorkflowFromFile,
} from './workflows';
import { invoke } from '../types/tauri';
import type { WorkflowDocument } from '../utils/workflowSchema';

// Mock the invoke function
vi.mock('../types/tauri', () => ({
  invoke: vi.fn(),
}));

// Mock errorLogger to prevent console noise
vi.mock('../utils/errorLogger', () => ({
  logApiError: vi.fn(),
}));

describe('workflows API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listWorkflows', () => {
    it('returns list of workflows', async () => {
      const mockWorkflows = [
        { id: 'workflow-1', name: 'Test 1', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'workflow-2', name: 'Test 2', created_at: '2024-01-02', updated_at: '2024-01-02' },
      ];
      vi.mocked(invoke).mockResolvedValue(mockWorkflows);

      const result = await listWorkflows();

      expect(invoke).toHaveBeenCalledWith('list_workflows');
      expect(result).toEqual(mockWorkflows);
    });

    it('throws and logs error on failure', async () => {
      const error = new Error('Database error');
      vi.mocked(invoke).mockRejectedValue(error);

      await expect(listWorkflows()).rejects.toThrow('Database error');
    });

    it('converts non-Error failures to Error', async () => {
      vi.mocked(invoke).mockRejectedValue('string error');

      await expect(listWorkflows()).rejects.toThrow('string error');
    });
  });

  describe('loadWorkflow', () => {
    it('loads a workflow by ID', async () => {
      const mockWorkflow = {
        id: 'workflow-123',
        name: 'Test Workflow',
        data: { nodes: [], edges: [] },
      };
      vi.mocked(invoke).mockResolvedValue(mockWorkflow);

      const result = await loadWorkflow('workflow-123');

      expect(invoke).toHaveBeenCalledWith('load_workflow', { id: 'workflow-123' });
      expect(result).toEqual(mockWorkflow);
    });

    it('throws error when workflow not found', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Workflow not found'));

      await expect(loadWorkflow('nonexistent')).rejects.toThrow('Workflow not found');
    });
  });

  describe('saveWorkflow', () => {
    it('saves a workflow', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const data = { nodes: [], edges: [], metadata: {} };
      await saveWorkflow('My Workflow', data);

      expect(invoke).toHaveBeenCalledWith('save_workflow', {
        name: 'My Workflow',
        data,
      });
    });

    it('throws error on save failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Save failed'));

      await expect(saveWorkflow('Test', {})).rejects.toThrow('Save failed');
    });
  });

  describe('deleteWorkflow', () => {
    it('deletes a workflow by ID', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await deleteWorkflow('workflow-123');

      expect(invoke).toHaveBeenCalledWith('delete_workflow', { id: 'workflow-123' });
    });

    it('throws error on delete failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Delete failed'));

      await expect(deleteWorkflow('workflow-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('exportWorkflowToFile', () => {
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockAppendChild: ReturnType<typeof vi.fn>;
    let mockRemoveChild: ReturnType<typeof vi.fn>;
    let mockClick: ReturnType<typeof vi.fn>;
    let mockLink: { href: string; download: string; click: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
      mockRevokeObjectURL = vi.fn();
      mockAppendChild = vi.fn();
      mockRemoveChild = vi.fn();
      mockClick = vi.fn();
      mockLink = { href: '', download: '', click: mockClick };

      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      vi.spyOn(window.document, 'createElement').mockReturnValue(
        mockLink as unknown as HTMLElement
      );
      vi.spyOn(window.document.body, 'appendChild').mockImplementation(mockAppendChild);
      vi.spyOn(window.document.body, 'removeChild').mockImplementation(mockRemoveChild);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates and triggers download link', () => {
      const document: WorkflowDocument = {
        version: '1.0',
        nodes: [],
        edges: [],
        metadata: { name: 'Test' },
      };

      exportWorkflowToFile(document, 'test-workflow');

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('sanitizes filename', () => {
      const document: WorkflowDocument = {
        version: '1.0',
        nodes: [],
        edges: [],
        metadata: { name: 'Test' },
      };

      exportWorkflowToFile(document, 'Test Workflow!@#');

      expect(mockLink.download).toMatch(/^test-workflow---/);
    });

    it('uses default filename when not provided', () => {
      const document: WorkflowDocument = {
        version: '1.0',
        nodes: [],
        edges: [],
        metadata: {},
      };

      exportWorkflowToFile(document);

      expect(mockLink.download).toMatch(/^workflow-/);
    });
  });

  describe('importWorkflowFromFile', () => {
    it('imports valid JSON workflow file', async () => {
      const mockDocument: WorkflowDocument = {
        version: '1.0',
        nodes: [{ id: 'node-1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
        metadata: { name: 'Imported' },
      };

      const file = new File([JSON.stringify(mockDocument)], 'workflow.json', {
        type: 'application/json',
      });

      const result = await importWorkflowFromFile(file);

      expect(result).toEqual(mockDocument);
    });

    it('rejects invalid JSON', async () => {
      const file = new File(['not valid json'], 'workflow.json', { type: 'application/json' });

      await expect(importWorkflowFromFile(file)).rejects.toThrow('Invalid workflow file format');
    });

    it('rejects when file read fails', async () => {
      // Create a mock File that will cause FileReader to error
      const file = new File(['test'], 'workflow.json');

      // Mock FileReader to simulate error
      const originalFileReader = global.FileReader;
      const mockFileReader = vi.fn(() => ({
        onload: null,
        onerror: null,
        readAsText: function () {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        },
      }));
      global.FileReader = mockFileReader as unknown as typeof FileReader;

      await expect(importWorkflowFromFile(file)).rejects.toThrow('Failed to read workflow file');

      global.FileReader = originalFileReader;
    });
  });
});
