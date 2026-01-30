import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all Tauri API calls
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

describe('stores index', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('exports', () => {
    it('should export useSettingsStore and hooks', async () => {
      const stores = await import('../index');

      expect(stores.useSettingsStore).toBeDefined();
      expect(stores.useOpenAIApiKey).toBeDefined();
      expect(stores.useReplicateApiKey).toBeDefined();
      expect(stores.useCurrentTheme).toBeDefined();
      expect(stores.useEdgeType).toBeDefined();
      expect(stores.useShowAssistantPanel).toBeDefined();
      expect(stores.useShowEditorToolbar).toBeDefined();
    });

    it('should export useUIStore and hooks', async () => {
      const stores = await import('../index');

      expect(stores.useUIStore).toBeDefined();
      expect(stores.useSidebarOpen).toBeDefined();
      expect(stores.useShowGallery).toBeDefined();
      expect(stores.useShowWelcome).toBeDefined();
      expect(stores.useSelectedNodeId).toBeDefined();
      expect(stores.useValidationErrors).toBeDefined();
      expect(stores.useHelperLines).toBeDefined();
    });

    it('should export useWorkflowStore and hooks', async () => {
      const stores = await import('../index');

      expect(stores.useWorkflowStore).toBeDefined();
      expect(stores.useNodes).toBeDefined();
      expect(stores.useEdges).toBeDefined();
      expect(stores.useViewport).toBeDefined();
      expect(stores.useActiveWorkflow).toBeDefined();
      expect(stores.useWorkflowMetadata).toBeDefined();
      expect(stores.useHasUnsavedChanges).toBeDefined();
      expect(stores.useWorkflowOutputs).toBeDefined();
      expect(stores.useNode).toBeDefined();
      expect(stores.useNodeData).toBeDefined();
      expect(stores.useNodeEdges).toBeDefined();
      expect(stores.useIncomingEdges).toBeDefined();
      expect(stores.useOutgoingEdges).toBeDefined();
    });

    it('should export useExecutionStore and hooks', async () => {
      const stores = await import('../index');

      expect(stores.useExecutionStore).toBeDefined();
      expect(stores.useIsProcessing).toBeDefined();
      expect(stores.useCurrentWorkflowId).toBeDefined();
      expect(stores.useFailedNodes).toBeDefined();
      expect(stores.useShowErrorRecovery).toBeDefined();
      expect(stores.useExecutionProgress).toBeDefined();
    });
  });

  describe('initializeStores', () => {
    it('should be exported as a function', async () => {
      const stores = await import('../index');
      expect(typeof stores.initializeStores).toBe('function');
    });

    it('should call loadFromTauri on settings store', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValue({});

      const { initializeStores } = await import('../index');
      await initializeStores();

      // loadFromTauri calls invoke('load_settings')
      expect(mockedInvoke).toHaveBeenCalledWith('load_settings');
    });
  });

  describe('type exports', () => {
    it('should export SettingsStore types', async () => {
      // Type-only imports won't be in runtime, but we can verify module structure
      const stores = await import('../index');

      // These are runtime exports that prove types are accessible
      expect(stores).toHaveProperty('useSettingsStore');
    });

    it('should export UIStore types', async () => {
      const stores = await import('../index');
      expect(stores).toHaveProperty('useUIStore');
    });

    it('should export WorkflowStore types', async () => {
      const stores = await import('../index');
      expect(stores).toHaveProperty('useWorkflowStore');
    });

    it('should export ExecutionStore types', async () => {
      const stores = await import('../index');
      expect(stores).toHaveProperty('useExecutionStore');
    });
  });
});
