/**
 * Tests for useSidebarProps hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarProps, type SidebarPropsConfig } from './useSidebarProps';

// Mock the workflowSchema module
vi.mock('../utils/workflowSchema', () => ({
  LOCAL_WORKFLOW_KEY: 'noder-workflow',
}));

// Store original implementations
const originalConfirm = window.confirm;
const originalRemoveItem = Storage.prototype.removeItem;

describe('useSidebarProps', () => {
  let mockRemoveItem: ReturnType<typeof vi.fn>;
  let mockConfirm: ReturnType<typeof vi.fn>;

  const createDefaultConfig = (): SidebarPropsConfig => ({
    activeWorkflow: { id: 'test-workflow', name: 'Test Workflow', data: undefined },
    hasUnsavedChanges: false,
    workflowOutputs: [],
    workflowTemplates: [],
    loadWorkflow: vi.fn(),
    saveCurrentWorkflow: vi.fn().mockResolvedValue(undefined),
    saveWorkflow: vi.fn().mockResolvedValue({}),
    exportWorkflow: vi.fn(),
    handleLoadTemplate: vi.fn(),
    handleLoadWorkflow: vi.fn(),
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    showEditorToolbar: true,
    setShowEditorToolbar: vi.fn(),
    setShowWelcome: vi.fn(),
    setWelcomePinned: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    database: null,
    updateSupported: true,
    currentVersion: '1.0.0',
    updateStatus: 'idle',
    updateInfo: null,
    updatePath: null,
    updateError: null,
    lastUpdateCheck: null,
    checkForUpdate: vi.fn().mockResolvedValue({}),
    downloadUpdate: vi.fn().mockResolvedValue(null),
    installUpdate: vi.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.confirm
    mockConfirm = vi.fn(() => true);
    window.confirm = mockConfirm;

    // Mock localStorage.removeItem
    mockRemoveItem = vi.fn();
    Storage.prototype.removeItem = mockRemoveItem;
  });

  afterEach(() => {
    // Restore original implementations
    window.confirm = originalConfirm;
    Storage.prototype.removeItem = originalRemoveItem;
  });

  describe('sidebarProps initial values', () => {
    it('should contain correct isOpen value from sidebarOpen', () => {
      const config = createDefaultConfig();
      config.sidebarOpen = true;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.isOpen).toBe(true);
    });

    it('should contain correct isOpen value when sidebar is closed', () => {
      const config = createDefaultConfig();
      config.sidebarOpen = false;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.isOpen).toBe(false);
    });

    it('should contain activeWorkflow from config', () => {
      const config = createDefaultConfig();
      config.activeWorkflow = { id: 'workflow-123', name: 'My Workflow' };

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.activeWorkflow).toEqual({
        id: 'workflow-123',
        name: 'My Workflow',
      });
    });

    it('should contain hasUnsavedChanges from config', () => {
      const config = createDefaultConfig();
      config.hasUnsavedChanges = true;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.hasUnsavedChanges).toBe(true);
    });

    it('should contain workflowOutputs from config', () => {
      const config = createDefaultConfig();
      config.workflowOutputs = [
        { id: 'output-1', type: 'image', value: 'data:image/png;base64,...' },
      ];

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.workflowOutputs).toHaveLength(1);
      expect(result.current.sidebarProps.workflowOutputs[0]).toEqual({
        id: 'output-1',
        type: 'image',
        value: 'data:image/png;base64,...',
      });
    });

    it('should contain workflowTemplates from config', () => {
      const config = createDefaultConfig();
      config.workflowTemplates = [
        {
          id: 'template-1',
          name: 'Basic Template',
          description: 'A basic workflow template',
          icon: 'template',
          category: 'general',
          nodes: [],
          edges: [],
        },
      ];

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.workflowTemplates).toHaveLength(1);
      expect(result.current.sidebarProps.workflowTemplates[0].name).toBe('Basic Template');
    });

    it('should contain database from config', () => {
      const mockDatabase = { query: vi.fn() };
      const config = createDefaultConfig();
      config.database = mockDatabase;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.database).toBe(mockDatabase);
    });

    it('should contain showEditorToolbar from config', () => {
      const config = createDefaultConfig();
      config.showEditorToolbar = false;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.showEditorToolbar).toBe(false);
    });
  });

  describe('handleToggle', () => {
    it('should toggle isOpen state when onToggle is called', () => {
      const setSidebarOpen = vi.fn();
      const config = createDefaultConfig();
      config.sidebarOpen = false;
      config.setSidebarOpen = setSidebarOpen;

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onToggle();
      });

      expect(setSidebarOpen).toHaveBeenCalledTimes(1);
      // Verify it was called with a function that toggles the value
      const toggleFn = setSidebarOpen.mock.calls[0][0];
      expect(typeof toggleFn).toBe('function');
      expect(toggleFn(false)).toBe(true);
      expect(toggleFn(true)).toBe(false);
    });

    it('should toggle from open to closed', () => {
      const setSidebarOpen = vi.fn();
      const config = createDefaultConfig();
      config.sidebarOpen = true;
      config.setSidebarOpen = setSidebarOpen;

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onToggle();
      });

      const toggleFn = setSidebarOpen.mock.calls[0][0];
      expect(toggleFn(true)).toBe(false);
    });
  });

  describe('handleClearWorkflow', () => {
    it('should show confirmation dialog when onClearWorkflow is called', () => {
      const config = createDefaultConfig();

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onClearWorkflow();
      });

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to clear the current workflow?'
      );
    });

    it('should call setNodes with empty array when confirmed', () => {
      const setNodes = vi.fn();
      const config = createDefaultConfig();
      config.setNodes = setNodes;
      mockConfirm.mockReturnValue(true);

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onClearWorkflow();
      });

      expect(setNodes).toHaveBeenCalledWith([]);
    });

    it('should call setEdges with empty array when confirmed', () => {
      const setEdges = vi.fn();
      const config = createDefaultConfig();
      config.setEdges = setEdges;
      mockConfirm.mockReturnValue(true);

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onClearWorkflow();
      });

      expect(setEdges).toHaveBeenCalledWith([]);
    });

    it('should remove noder-nodes from localStorage when confirmed', () => {
      const config = createDefaultConfig();
      mockConfirm.mockReturnValue(true);

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onClearWorkflow();
      });

      expect(mockRemoveItem).toHaveBeenCalledWith('noder-nodes');
    });

    it('should remove noder-edges from localStorage when confirmed', () => {
      const config = createDefaultConfig();
      mockConfirm.mockReturnValue(true);

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onClearWorkflow();
      });

      expect(mockRemoveItem).toHaveBeenCalledWith('noder-edges');
    });

    it('should remove noder-workflow from localStorage when confirmed', () => {
      const config = createDefaultConfig();
      mockConfirm.mockReturnValue(true);

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onClearWorkflow();
      });

      expect(mockRemoveItem).toHaveBeenCalledWith('noder-workflow');
    });

    it('should not clear workflow when confirmation is cancelled', () => {
      const setNodes = vi.fn();
      const setEdges = vi.fn();
      const config = createDefaultConfig();
      config.setNodes = setNodes;
      config.setEdges = setEdges;
      mockConfirm.mockReturnValue(false);

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onClearWorkflow();
      });

      expect(setNodes).not.toHaveBeenCalled();
      expect(setEdges).not.toHaveBeenCalled();
      expect(mockRemoveItem).not.toHaveBeenCalled();
    });
  });

  describe('handleGoHome', () => {
    it('should set welcomePinned to true when onGoHome is called', () => {
      const setWelcomePinned = vi.fn();
      const config = createDefaultConfig();
      config.setWelcomePinned = setWelcomePinned;

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onGoHome();
      });

      expect(setWelcomePinned).toHaveBeenCalledWith(true);
    });

    it('should set showWelcome to true when onGoHome is called', () => {
      const setShowWelcome = vi.fn();
      const config = createDefaultConfig();
      config.setShowWelcome = setShowWelcome;

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onGoHome();
      });

      expect(setShowWelcome).toHaveBeenCalledWith(true);
    });

    it('should set welcomePinned before showWelcome', () => {
      const callOrder: string[] = [];
      const setWelcomePinned = vi.fn(() => callOrder.push('setWelcomePinned'));
      const setShowWelcome = vi.fn(() => callOrder.push('setShowWelcome'));
      const config = createDefaultConfig();
      config.setWelcomePinned = setWelcomePinned;
      config.setShowWelcome = setShowWelcome;

      const { result } = renderHook(() => useSidebarProps(config));

      act(() => {
        result.current.sidebarProps.onGoHome();
      });

      expect(callOrder).toEqual(['setWelcomePinned', 'setShowWelcome']);
    });
  });

  describe('updateState', () => {
    it('should contain supported field from updateSupported', () => {
      const config = createDefaultConfig();
      config.updateSupported = true;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.supported).toBe(true);
    });

    it('should contain currentVersion from config', () => {
      const config = createDefaultConfig();
      config.currentVersion = '2.0.0';

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.currentVersion).toBe('2.0.0');
    });

    it('should contain updateStatus from config', () => {
      const config = createDefaultConfig();
      config.updateStatus = 'downloading';

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.updateStatus).toBe('downloading');
    });

    it('should contain updateInfo from config', () => {
      const config = createDefaultConfig();
      config.updateInfo = { version: '2.1.0', publishedAt: '2024-01-01', notes: 'Bug fixes' };

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.updateInfo).toEqual({
        version: '2.1.0',
        publishedAt: '2024-01-01',
        notes: 'Bug fixes',
      });
    });

    it('should contain updatePath from config', () => {
      const config = createDefaultConfig();
      config.updatePath = '/path/to/update';

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.updatePath).toBe('/path/to/update');
    });

    it('should contain updateError from config', () => {
      const config = createDefaultConfig();
      config.updateError = 'Download failed';

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.updateError).toBe('Download failed');
    });

    it('should contain lastUpdateCheck from config', () => {
      const config = createDefaultConfig();
      config.lastUpdateCheck = 1704067200000;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.lastUpdateCheck).toBe(1704067200000);
    });
  });

  describe('updateActions', () => {
    it('should contain onCheck mapped to checkForUpdate', () => {
      const checkForUpdate = vi.fn().mockResolvedValue({ available: true });
      const config = createDefaultConfig();
      config.checkForUpdate = checkForUpdate;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateActions.onCheck).toBe(checkForUpdate);
    });

    it('should contain onDownload mapped to downloadUpdate', () => {
      const downloadUpdate = vi.fn().mockResolvedValue('/download/path');
      const config = createDefaultConfig();
      config.downloadUpdate = downloadUpdate;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateActions.onDownload).toBe(downloadUpdate);
    });

    it('should contain onInstall mapped to installUpdate', () => {
      const installUpdate = vi.fn().mockResolvedValue(undefined);
      const config = createDefaultConfig();
      config.installUpdate = installUpdate;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateActions.onInstall).toBe(installUpdate);
    });

    it('should call checkForUpdate when onCheck is invoked', async () => {
      const checkForUpdate = vi.fn().mockResolvedValue({ available: true });
      const config = createDefaultConfig();
      config.checkForUpdate = checkForUpdate;

      const { result } = renderHook(() => useSidebarProps(config));

      await act(async () => {
        await result.current.sidebarProps.updateActions.onCheck();
      });

      expect(checkForUpdate).toHaveBeenCalledTimes(1);
    });

    it('should call downloadUpdate when onDownload is invoked', async () => {
      const downloadUpdate = vi.fn().mockResolvedValue('/download/path');
      const config = createDefaultConfig();
      config.downloadUpdate = downloadUpdate;

      const { result } = renderHook(() => useSidebarProps(config));

      const updateInfo = { version: '2.0.0' };
      await act(async () => {
        await result.current.sidebarProps.updateActions.onDownload(updateInfo);
      });

      expect(downloadUpdate).toHaveBeenCalledWith(updateInfo);
    });

    it('should call installUpdate when onInstall is invoked', async () => {
      const installUpdate = vi.fn().mockResolvedValue(undefined);
      const config = createDefaultConfig();
      config.installUpdate = installUpdate;

      const { result } = renderHook(() => useSidebarProps(config));

      await act(async () => {
        await result.current.sidebarProps.updateActions.onInstall();
      });

      expect(installUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('gallery drag handlers', () => {
    it('should have onGalleryDragStart as a callable function', () => {
      const config = createDefaultConfig();

      const { result } = renderHook(() => useSidebarProps(config));

      expect(typeof result.current.sidebarProps.onGalleryDragStart).toBe('function');

      // Should not throw when called
      expect(() => {
        result.current.sidebarProps.onGalleryDragStart();
      }).not.toThrow();
    });

    it('should have onGalleryDragEnd as a callable function', () => {
      const config = createDefaultConfig();

      const { result } = renderHook(() => useSidebarProps(config));

      expect(typeof result.current.sidebarProps.onGalleryDragEnd).toBe('function');

      // Should not throw when called
      expect(() => {
        result.current.sidebarProps.onGalleryDragEnd();
      }).not.toThrow();
    });
  });

  describe('other sidebar props', () => {
    it('should contain onWorkflowLoad mapped to loadWorkflow', () => {
      const loadWorkflow = vi.fn();
      const config = createDefaultConfig();
      config.loadWorkflow = loadWorkflow;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.onWorkflowLoad).toBe(loadWorkflow);
    });

    it('should contain onSave mapped to saveCurrentWorkflow', () => {
      const saveCurrentWorkflow = vi.fn().mockResolvedValue(undefined);
      const config = createDefaultConfig();
      config.saveCurrentWorkflow = saveCurrentWorkflow;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.onSave).toBe(saveCurrentWorkflow);
    });

    it('should contain onSaveWorkflow mapped to saveWorkflow', () => {
      const saveWorkflow = vi.fn().mockResolvedValue({});
      const config = createDefaultConfig();
      config.saveWorkflow = saveWorkflow;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.onSaveWorkflow).toBe(saveWorkflow);
    });

    it('should contain onLoadWorkflow mapped to handleLoadWorkflow', () => {
      const handleLoadWorkflow = vi.fn();
      const config = createDefaultConfig();
      config.handleLoadWorkflow = handleLoadWorkflow;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.onLoadWorkflow).toBe(handleLoadWorkflow);
    });

    it('should contain onExportWorkflow mapped to exportWorkflow', () => {
      const exportWorkflow = vi.fn();
      const config = createDefaultConfig();
      config.exportWorkflow = exportWorkflow;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.onExportWorkflow).toBe(exportWorkflow);
    });

    it('should contain onLoadTemplate mapped to handleLoadTemplate', () => {
      const handleLoadTemplate = vi.fn();
      const config = createDefaultConfig();
      config.handleLoadTemplate = handleLoadTemplate;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.onLoadTemplate).toBe(handleLoadTemplate);
    });

    it('should contain onShowEditorToolbarChange mapped to setShowEditorToolbar', () => {
      const setShowEditorToolbar = vi.fn();
      const config = createDefaultConfig();
      config.setShowEditorToolbar = setShowEditorToolbar;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.onShowEditorToolbarChange).toBe(setShowEditorToolbar);
    });
  });

  describe('memoization', () => {
    it('should return stable sidebarProps when inputs do not change', () => {
      const config = createDefaultConfig();

      const { result, rerender } = renderHook(() => useSidebarProps(config));

      const firstProps = result.current.sidebarProps;

      rerender();

      const secondProps = result.current.sidebarProps;

      expect(firstProps).toBe(secondProps);
    });

    it('should return new sidebarProps when sidebarOpen changes', () => {
      const config = createDefaultConfig();
      config.sidebarOpen = false;

      const { result, rerender } = renderHook(
        (props: SidebarPropsConfig) => useSidebarProps(props),
        { initialProps: config }
      );

      const firstProps = result.current.sidebarProps;

      rerender({ ...config, sidebarOpen: true });

      const secondProps = result.current.sidebarProps;

      expect(firstProps).not.toBe(secondProps);
      expect(secondProps.isOpen).toBe(true);
    });

    it('should return new sidebarProps when hasUnsavedChanges changes', () => {
      const config = createDefaultConfig();
      config.hasUnsavedChanges = false;

      const { result, rerender } = renderHook(
        (props: SidebarPropsConfig) => useSidebarProps(props),
        { initialProps: config }
      );

      const firstProps = result.current.sidebarProps;

      rerender({ ...config, hasUnsavedChanges: true });

      const secondProps = result.current.sidebarProps;

      expect(firstProps).not.toBe(secondProps);
      expect(secondProps.hasUnsavedChanges).toBe(true);
    });

    it('should return stable updateState when update fields do not change', () => {
      const config = createDefaultConfig();

      const { result, rerender } = renderHook(() => useSidebarProps(config));

      const firstUpdateState = result.current.sidebarProps.updateState;

      rerender();

      const secondUpdateState = result.current.sidebarProps.updateState;

      expect(firstUpdateState).toBe(secondUpdateState);
    });

    it('should return new updateState when updateStatus changes', () => {
      const config = createDefaultConfig();
      config.updateStatus = 'idle';

      const { result, rerender } = renderHook(
        (props: SidebarPropsConfig) => useSidebarProps(props),
        { initialProps: config }
      );

      const firstUpdateState = result.current.sidebarProps.updateState;

      rerender({ ...config, updateStatus: 'downloading' });

      const secondUpdateState = result.current.sidebarProps.updateState;

      expect(firstUpdateState).not.toBe(secondUpdateState);
      expect(secondUpdateState.updateStatus).toBe('downloading');
    });

    it('should return stable updateActions when action callbacks do not change', () => {
      const config = createDefaultConfig();

      const { result, rerender } = renderHook(() => useSidebarProps(config));

      const firstUpdateActions = result.current.sidebarProps.updateActions;

      rerender();

      const secondUpdateActions = result.current.sidebarProps.updateActions;

      expect(firstUpdateActions).toBe(secondUpdateActions);
    });

    it('should return new updateActions when checkForUpdate changes', () => {
      const config = createDefaultConfig();
      const checkForUpdate1 = vi.fn();
      config.checkForUpdate = checkForUpdate1;

      const { result, rerender } = renderHook(
        (props: SidebarPropsConfig) => useSidebarProps(props),
        { initialProps: config }
      );

      const firstUpdateActions = result.current.sidebarProps.updateActions;

      const checkForUpdate2 = vi.fn();
      rerender({ ...config, checkForUpdate: checkForUpdate2 });

      const secondUpdateActions = result.current.sidebarProps.updateActions;

      expect(firstUpdateActions).not.toBe(secondUpdateActions);
      expect(secondUpdateActions.onCheck).toBe(checkForUpdate2);
    });
  });

  describe('callback stability', () => {
    it('should return stable handleToggle when setSidebarOpen does not change', () => {
      const config = createDefaultConfig();

      const { result, rerender } = renderHook(() => useSidebarProps(config));

      const firstOnToggle = result.current.sidebarProps.onToggle;

      rerender();

      const secondOnToggle = result.current.sidebarProps.onToggle;

      expect(firstOnToggle).toBe(secondOnToggle);
    });

    it('should return stable handleClearWorkflow when dependencies do not change', () => {
      const config = createDefaultConfig();

      const { result, rerender } = renderHook(() => useSidebarProps(config));

      const firstOnClear = result.current.sidebarProps.onClearWorkflow;

      rerender();

      const secondOnClear = result.current.sidebarProps.onClearWorkflow;

      expect(firstOnClear).toBe(secondOnClear);
    });

    it('should return stable handleGoHome when dependencies do not change', () => {
      const config = createDefaultConfig();

      const { result, rerender } = renderHook(() => useSidebarProps(config));

      const firstOnGoHome = result.current.sidebarProps.onGoHome;

      rerender();

      const secondOnGoHome = result.current.sidebarProps.onGoHome;

      expect(firstOnGoHome).toBe(secondOnGoHome);
    });
  });

  describe('null and undefined handling', () => {
    it('should handle null activeWorkflow', () => {
      const config = createDefaultConfig();
      config.activeWorkflow = null;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.activeWorkflow).toBeNull();
    });

    it('should handle null updateInfo', () => {
      const config = createDefaultConfig();
      config.updateInfo = null;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.updateInfo).toBeNull();
    });

    it('should handle undefined updateInfo', () => {
      const config = createDefaultConfig();
      config.updateInfo = undefined;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.updateInfo).toBeUndefined();
    });

    it('should handle null updatePath', () => {
      const config = createDefaultConfig();
      config.updatePath = null;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.updatePath).toBeNull();
    });

    it('should handle null updateError', () => {
      const config = createDefaultConfig();
      config.updateError = null;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.updateError).toBeNull();
    });

    it('should handle null lastUpdateCheck', () => {
      const config = createDefaultConfig();
      config.lastUpdateCheck = null;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.updateState.lastUpdateCheck).toBeNull();
    });

    it('should handle null database', () => {
      const config = createDefaultConfig();
      config.database = null;

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.database).toBeNull();
    });
  });

  describe('empty arrays handling', () => {
    it('should handle empty workflowOutputs', () => {
      const config = createDefaultConfig();
      config.workflowOutputs = [];

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.workflowOutputs).toEqual([]);
    });

    it('should handle empty workflowTemplates', () => {
      const config = createDefaultConfig();
      config.workflowTemplates = [];

      const { result } = renderHook(() => useSidebarProps(config));

      expect(result.current.sidebarProps.workflowTemplates).toEqual([]);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow clear and go home sequence', () => {
      const setNodes = vi.fn();
      const setEdges = vi.fn();
      const setWelcomePinned = vi.fn();
      const setShowWelcome = vi.fn();
      const config = createDefaultConfig();
      config.setNodes = setNodes;
      config.setEdges = setEdges;
      config.setWelcomePinned = setWelcomePinned;
      config.setShowWelcome = setShowWelcome;
      mockConfirm.mockReturnValue(true);

      const { result } = renderHook(() => useSidebarProps(config));

      // Clear workflow
      act(() => {
        result.current.sidebarProps.onClearWorkflow();
      });

      expect(setNodes).toHaveBeenCalledWith([]);
      expect(setEdges).toHaveBeenCalledWith([]);

      // Go home
      act(() => {
        result.current.sidebarProps.onGoHome();
      });

      expect(setWelcomePinned).toHaveBeenCalledWith(true);
      expect(setShowWelcome).toHaveBeenCalledWith(true);
    });

    it('should correctly wire all action callbacks', async () => {
      const loadWorkflow = vi.fn();
      const saveCurrentWorkflow = vi.fn().mockResolvedValue(undefined);
      const saveWorkflow = vi.fn().mockResolvedValue({});
      const exportWorkflow = vi.fn();
      const handleLoadTemplate = vi.fn();

      const config = createDefaultConfig();
      config.loadWorkflow = loadWorkflow;
      config.saveCurrentWorkflow = saveCurrentWorkflow;
      config.saveWorkflow = saveWorkflow;
      config.exportWorkflow = exportWorkflow;
      config.handleLoadTemplate = handleLoadTemplate;

      const { result } = renderHook(() => useSidebarProps(config));

      const mockWorkflow = { id: 'test', name: 'Test' };
      result.current.sidebarProps.onWorkflowLoad(mockWorkflow);
      expect(loadWorkflow).toHaveBeenCalledWith(mockWorkflow);

      await act(async () => {
        await result.current.sidebarProps.onSave();
      });
      expect(saveCurrentWorkflow).toHaveBeenCalled();

      await act(async () => {
        await result.current.sidebarProps.onSaveWorkflow();
      });
      expect(saveWorkflow).toHaveBeenCalled();

      result.current.sidebarProps.onExportWorkflow();
      expect(exportWorkflow).toHaveBeenCalled();

      const mockTemplate = {
        id: 't1',
        name: 'Template',
        description: 'Desc',
        icon: 'icon',
        category: 'cat',
        nodes: [],
        edges: [],
      };
      result.current.sidebarProps.onLoadTemplate(mockTemplate);
      expect(handleLoadTemplate).toHaveBeenCalledWith(mockTemplate);
    });
  });
});
