import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../useUIStore';

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useUIStore.setState({
      sidebarOpen: true,
      showGallery: false,
      showWelcome: false,
      welcomePinned: false,
      hideEmptyHint: false,
      nodeSelectorOpen: false,
      nodeSelectorContext: null,
      connectingNodeId: null,
      connectingHandleId: null,
      connectingHandleType: null,
      selectedNodeId: null,
      helperLines: { horizontal: null, vertical: null },
      validationErrors: [],
    });
  });

  describe('sidebar', () => {
    it('should toggle sidebar', () => {
      const store = useUIStore.getState();

      expect(store.sidebarOpen).toBe(true);

      store.toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      store.toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('should set sidebar state directly', () => {
      const store = useUIStore.getState();

      store.setSidebarOpen(false);
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      store.setSidebarOpen(true);
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe('gallery', () => {
    it('should toggle gallery', () => {
      const store = useUIStore.getState();

      expect(store.showGallery).toBe(false);

      store.toggleGallery();
      expect(useUIStore.getState().showGallery).toBe(true);

      store.toggleGallery();
      expect(useUIStore.getState().showGallery).toBe(false);
    });
  });

  describe('welcome screen', () => {
    it('should dismiss welcome', () => {
      useUIStore.setState({
        showWelcome: true,
        welcomePinned: true,
      });

      const store = useUIStore.getState();
      store.dismissWelcome();

      const state = useUIStore.getState();
      expect(state.showWelcome).toBe(false);
      expect(state.welcomePinned).toBe(false);
    });
  });

  describe('node selector', () => {
    it('should open node selector with context', () => {
      const store = useUIStore.getState();

      const context = {
        position: { x: 100, y: 200 },
        clickPosition: { x: 50, y: 100 },
        connectionContext: {
          sourceNode: 'node-1',
          sourceHandle: 'out',
          handleType: 'image',
        },
      };

      store.openNodeSelector(context);

      const state = useUIStore.getState();
      expect(state.nodeSelectorOpen).toBe(true);
      expect(state.nodeSelectorContext).toEqual(context);
    });

    it('should close node selector', () => {
      useUIStore.setState({
        nodeSelectorOpen: true,
        nodeSelectorContext: {
          position: { x: 0, y: 0 },
          clickPosition: { x: 0, y: 0 },
        },
      });

      const store = useUIStore.getState();
      store.closeNodeSelector();

      const state = useUIStore.getState();
      expect(state.nodeSelectorOpen).toBe(false);
      expect(state.nodeSelectorContext).toBeNull();
    });
  });

  describe('connection state', () => {
    it('should start and clear connection', () => {
      const store = useUIStore.getState();

      store.startConnection('node-1', 'out', 'image');

      let state = useUIStore.getState();
      expect(state.connectingNodeId).toBe('node-1');
      expect(state.connectingHandleId).toBe('out');
      expect(state.connectingHandleType).toBe('image');

      store.clearConnection();

      state = useUIStore.getState();
      expect(state.connectingNodeId).toBeNull();
      expect(state.connectingHandleId).toBeNull();
      expect(state.connectingHandleType).toBeNull();
    });
  });

  describe('selection', () => {
    it('should set selected node id', () => {
      const store = useUIStore.getState();

      store.setSelectedNodeId('node-123');
      expect(useUIStore.getState().selectedNodeId).toBe('node-123');

      store.setSelectedNodeId(null);
      expect(useUIStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('helper lines', () => {
    it('should set and clear helper lines', () => {
      const store = useUIStore.getState();

      store.setHelperLines({ horizontal: 100, vertical: 200 });
      expect(useUIStore.getState().helperLines).toEqual({
        horizontal: 100,
        vertical: 200,
      });

      store.clearHelperLines();
      expect(useUIStore.getState().helperLines).toEqual({
        horizontal: null,
        vertical: null,
      });
    });
  });

  describe('validation errors', () => {
    it('should set validation errors', () => {
      const store = useUIStore.getState();
      const errors = [
        { type: 'incompatible', message: 'Type mismatch' },
        { type: 'missing', message: 'Missing handle' },
      ];

      store.setValidationErrors(errors);
      expect(useUIStore.getState().validationErrors).toEqual(errors);
    });

    it('should add validation error', () => {
      const store = useUIStore.getState();

      store.addValidationError({ type: 'error1', message: 'First error' });
      store.addValidationError({ type: 'error2', message: 'Second error' });

      expect(useUIStore.getState().validationErrors).toHaveLength(2);
    });

    it('should dismiss validation error by index', () => {
      useUIStore.setState({
        validationErrors: [
          { type: 'error1', message: 'First' },
          { type: 'error2', message: 'Second' },
          { type: 'error3', message: 'Third' },
        ],
      });

      const store = useUIStore.getState();
      store.dismissValidationError(1);

      const errors = useUIStore.getState().validationErrors;
      expect(errors).toHaveLength(2);
      expect(errors[0].type).toBe('error1');
      expect(errors[1].type).toBe('error3');
    });

    it('should clear all validation errors', () => {
      useUIStore.setState({
        validationErrors: [
          { type: 'error1', message: 'First' },
          { type: 'error2', message: 'Second' },
        ],
      });

      const store = useUIStore.getState();
      store.clearValidationErrors();

      expect(useUIStore.getState().validationErrors).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should reset all UI state', () => {
      useUIStore.setState({
        sidebarOpen: false,
        showGallery: true,
        selectedNodeId: 'node-1',
        validationErrors: [{ type: 'error', message: 'test' }],
      });

      const store = useUIStore.getState();
      store.reset();

      const state = useUIStore.getState();
      expect(state.sidebarOpen).toBe(true);
      expect(state.showGallery).toBe(false);
      expect(state.selectedNodeId).toBeNull();
      expect(state.validationErrors).toHaveLength(0);
    });
  });
});
