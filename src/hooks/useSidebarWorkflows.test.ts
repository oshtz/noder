/**
 * Tests for useSidebarWorkflows hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSidebarWorkflows, Workflow, WorkflowSortBy } from './useSidebarWorkflows';
import { invoke } from '@tauri-apps/api/core';

// invoke is mocked in test-setup.js

describe('useSidebarWorkflows', () => {
  const mockOnWorkflowLoad = vi.fn();
  const mockWorkflows: Workflow[] = [
    {
      id: 'workflow-1',
      name: 'Workflow 1',
      created: 1000,
      modified: 2000,
      lastAccessed: 3000,
    },
    {
      id: 'workflow-2',
      name: 'Workflow 2',
      created: 2000,
      modified: 3000,
      lastAccessed: 2500,
    },
    {
      id: 'workflow-3',
      name: 'Alpha Workflow',
      created: 500,
      modified: 1000,
      lastAccessed: 1500,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Silence console output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock window.alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Mock window.confirm - default to true
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    // Default mock for invoke - resolve with empty array
    vi.mocked(invoke).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty workflows array', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.workflows).toEqual([]);
    });

    it('should initialize with isLoading true before load completes', () => {
      // Make invoke never resolve to keep loading state
      vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('should initialize with default sort by recent', async () => {
      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      expect(result.current.sortBy).toBe('recent');
    });

    it('should initialize with null editingId', async () => {
      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      expect(result.current.editingId).toBeNull();
    });

    it('should initialize with empty editingName', async () => {
      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      expect(result.current.editingName).toBe('');
    });

    it('should call list_workflows on mount', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('list_workflows');
      });
    });

    it('should load workflows on mount', async () => {
      vi.mocked(invoke).mockResolvedValue(mockWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.workflows).toEqual(mockWorkflows);
    });
  });

  describe('loadWorkflows', () => {
    it('should set isLoading to false after load completes', async () => {
      vi.mocked(invoke).mockResolvedValue(mockWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle load error gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.workflows).toEqual([]);
    });

    it('should allow manual reload via loadWorkflows', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(mockWorkflows)
        .mockResolvedValueOnce([...mockWorkflows, { id: 'new', name: 'New Workflow' }]);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.workflows).toHaveLength(3);
      });

      await act(async () => {
        await result.current.loadWorkflows();
      });

      expect(result.current.workflows).toHaveLength(4);
    });
  });

  describe('sortedWorkflows', () => {
    it('should sort by recent (lastAccessed/modified/created)', async () => {
      vi.mocked(invoke).mockResolvedValue(mockWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // workflow-1 has lastAccessed: 3000 (highest)
      // workflow-2 has lastAccessed: 2500
      // workflow-3 has lastAccessed: 1500
      expect(result.current.sortedWorkflows[0].id).toBe('workflow-1');
      expect(result.current.sortedWorkflows[1].id).toBe('workflow-2');
      expect(result.current.sortedWorkflows[2].id).toBe('workflow-3');
    });

    it('should sort by name alphabetically', async () => {
      vi.mocked(invoke).mockResolvedValue(mockWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSortBy('name');
      });

      // Alpha Workflow, Workflow 1, Workflow 2
      expect(result.current.sortedWorkflows[0].name).toBe('Alpha Workflow');
      expect(result.current.sortedWorkflows[1].name).toBe('Workflow 1');
      expect(result.current.sortedWorkflows[2].name).toBe('Workflow 2');
    });

    it('should sort by created date', async () => {
      vi.mocked(invoke).mockResolvedValue(mockWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSortBy('created');
      });

      // workflow-2 created: 2000 (highest)
      // workflow-1 created: 1000
      // workflow-3 created: 500
      expect(result.current.sortedWorkflows[0].id).toBe('workflow-2');
      expect(result.current.sortedWorkflows[1].id).toBe('workflow-1');
      expect(result.current.sortedWorkflows[2].id).toBe('workflow-3');
    });

    it('should return empty array for empty workflows', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.sortedWorkflows).toEqual([]);
    });

    it('should handle workflows without timestamps', async () => {
      vi.mocked(invoke).mockResolvedValue([
        { id: 'no-times', name: 'No Times' },
        { id: 'with-times', name: 'With Times', created: 1000, modified: 2000 },
      ]);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not throw
      expect(result.current.sortedWorkflows).toHaveLength(2);
    });
  });

  describe('setSortBy', () => {
    it('should update sortBy state', async () => {
      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      act(() => {
        result.current.setSortBy('name');
      });

      expect(result.current.sortBy).toBe('name');
    });

    it('should accept all sort options', async () => {
      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      const sortOptions: WorkflowSortBy[] = ['recent', 'name', 'created'];

      for (const option of sortOptions) {
        act(() => {
          result.current.setSortBy(option);
        });
        expect(result.current.sortBy).toBe(option);
      }
    });
  });

  describe('editing state', () => {
    it('should set editingId', async () => {
      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      act(() => {
        result.current.setEditingId('workflow-1');
      });

      expect(result.current.editingId).toBe('workflow-1');
    });

    it('should set editingName', async () => {
      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      act(() => {
        result.current.setEditingName('New Name');
      });

      expect(result.current.editingName).toBe('New Name');
    });

    it('should clear editingId', async () => {
      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      act(() => {
        result.current.setEditingId('workflow-1');
      });

      act(() => {
        result.current.setEditingId(null);
      });

      expect(result.current.editingId).toBeNull();
    });
  });

  describe('handleRename', () => {
    it('should call rename_workflow with correct args', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(mockWorkflows) // Initial load
        .mockResolvedValueOnce(undefined) // rename_workflow
        .mockResolvedValueOnce(mockWorkflows); // Reload after rename

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleRename('workflow-1', 'Renamed Workflow');
      });

      expect(invoke).toHaveBeenCalledWith('rename_workflow', {
        id: 'workflow-1',
        newName: 'Renamed Workflow',
      });
    });

    it('should trim whitespace from name', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(mockWorkflows)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleRename('workflow-1', '  Trimmed Name  ');
      });

      expect(invoke).toHaveBeenCalledWith('rename_workflow', {
        id: 'workflow-1',
        newName: 'Trimmed Name',
      });
    });

    it('should not rename with empty string', async () => {
      vi.mocked(invoke).mockResolvedValue(mockWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleRename('workflow-1', '   ');
      });

      // rename_workflow should not have been called
      expect(invoke).not.toHaveBeenCalledWith('rename_workflow', expect.anything());
    });

    it('should clear editingId after successful rename', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(mockWorkflows)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setEditingId('workflow-1');
      });

      await act(async () => {
        await result.current.handleRename('workflow-1', 'New Name');
      });

      expect(result.current.editingId).toBeNull();
    });
  });

  describe('handleDelete', () => {
    it('should call delete_workflow when confirmed', async () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValueOnce(mockWorkflows).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleDelete('workflow-1');
      });

      expect(invoke).toHaveBeenCalledWith('delete_workflow', { id: 'workflow-1' });
    });

    it('should not delete if user cancels confirmation', async () => {
      vi.mocked(window.confirm).mockReturnValue(false);
      vi.mocked(invoke).mockResolvedValue(mockWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleDelete('workflow-1');
      });

      expect(invoke).not.toHaveBeenCalledWith('delete_workflow', expect.anything());
    });

    it('should rollback on delete error', async () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      vi.mocked(invoke)
        .mockResolvedValueOnce(mockWorkflows)
        .mockRejectedValueOnce(new Error('Delete failed'));

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.workflows).toHaveLength(3);
      });

      await act(async () => {
        await result.current.handleDelete('workflow-1');
      });

      // Should rollback to original state
      expect(result.current.workflows).toHaveLength(3);
    });
  });

  describe('handleLoad', () => {
    it('should call load_workflow and onWorkflowLoad', async () => {
      const workflowData = { data: { nodes: [{ id: 'node-1' }], edges: [] } };

      vi.mocked(invoke).mockResolvedValueOnce(mockWorkflows).mockResolvedValueOnce(workflowData);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleLoad(mockWorkflows[0]);
      });

      expect(invoke).toHaveBeenCalledWith('load_workflow', { id: 'workflow-1' });
      expect(mockOnWorkflowLoad).toHaveBeenCalledWith({
        id: 'workflow-1',
        name: 'Workflow 1',
        data: { nodes: [{ id: 'node-1' }], edges: [] },
      });
    });

    it('should handle load workflow error', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(mockWorkflows)
        .mockRejectedValueOnce(new Error('Load failed'));

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleLoad(mockWorkflows[0]);
      });

      expect(mockOnWorkflowLoad).not.toHaveBeenCalled();
    });

    it('should handle workflow data without nested data property', async () => {
      const workflowData = { nodes: [{ id: 'node-1' }], edges: [] };

      vi.mocked(invoke).mockResolvedValueOnce(mockWorkflows).mockResolvedValueOnce(workflowData);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleLoad(mockWorkflows[0]);
      });

      expect(mockOnWorkflowLoad).toHaveBeenCalledWith({
        id: 'workflow-1',
        name: 'Workflow 1',
        data: { nodes: [{ id: 'node-1' }], edges: [] },
      });
    });
  });

  describe('handleNewWorkflow', () => {
    it('should create new workflow and call save_workflow', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce([]) // Initial load - empty
        .mockResolvedValueOnce(undefined); // save_workflow

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleNewWorkflow('My New Workflow');
      });

      expect(invoke).toHaveBeenCalledWith('save_workflow', {
        name: 'My New Workflow',
        data: { nodes: [], edges: [] },
      });
      expect(mockOnWorkflowLoad).toHaveBeenCalled();
    });

    it('should use default name when empty string provided', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleNewWorkflow('');
      });

      expect(invoke).toHaveBeenCalledWith('save_workflow', {
        name: 'Untitled Workflow',
        data: { nodes: [], edges: [] },
      });
    });

    it('should generate unique name if name already exists', async () => {
      // The ID must match toSafeWorkflowId("Test Workflow") which is "Test Workflow" (with space)
      vi.mocked(invoke)
        .mockResolvedValueOnce([{ id: 'Test Workflow', name: 'Test Workflow' }])
        .mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleNewWorkflow('Test Workflow');
      });

      expect(invoke).toHaveBeenCalledWith('save_workflow', {
        name: 'Test Workflow 2',
        data: { nodes: [], edges: [] },
      });
    });

    it('should rollback on create error', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Save failed'));

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleNewWorkflow('New Workflow');
      });

      // Should rollback
      expect(result.current.workflows).toHaveLength(0);
    });

    it('should load new workflow immediately after creation', async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleNewWorkflow('New Workflow');
      });

      expect(mockOnWorkflowLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Workflow',
          data: { nodes: [], edges: [] },
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle rapid sort changes', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Rapid sort changes
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.setSortBy(i % 2 === 0 ? 'name' : 'recent');
        });
      }

      expect(result.current.sortBy).toBe('recent');
    });

    it('should handle workflows with special characters in name', async () => {
      const specialWorkflows = [{ id: 'special', name: 'Test & <test> "Workflow"', created: 1000 }];

      vi.mocked(invoke).mockResolvedValue(specialWorkflows);

      const { result } = renderHook(() =>
        useSidebarWorkflows({
          onWorkflowLoad: mockOnWorkflowLoad,
          activeWorkflow: null,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.workflows[0].name).toBe('Test & <test> "Workflow"');
    });
  });
});
