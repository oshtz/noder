/**
 * Tests for useUIStore Zustand store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore, type NodeSelectorContext } from './useUIStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useUIStore.getState().reset();
    localStorageMock.clear();
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useUIStore.getState();

      expect(state.sidebarOpen).toBe(true);
      expect(state.showGallery).toBe(false);
      expect(state.showWelcome).toBe(false);
      expect(state.welcomePinned).toBe(false);
      expect(state.hideEmptyHint).toBe(false);
      expect(state.nodeSelectorOpen).toBe(false);
      expect(state.nodeSelectorContext).toBeNull();
      expect(state.connectingNodeId).toBeNull();
      expect(state.connectingHandleId).toBeNull();
      expect(state.connectingHandleType).toBeNull();
      expect(state.selectedNodeId).toBeNull();
      expect(state.helperLines).toEqual({ horizontal: null, vertical: null });
      expect(state.validationErrors).toEqual([]);
    });
  });

  describe('sidebar', () => {
    it('should set sidebar open state', () => {
      useUIStore.getState().setSidebarOpen(false);
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      useUIStore.getState().setSidebarOpen(true);
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('should toggle sidebar', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true);

      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe('gallery', () => {
    it('should set gallery visibility', () => {
      useUIStore.getState().setShowGallery(true);
      expect(useUIStore.getState().showGallery).toBe(true);

      useUIStore.getState().setShowGallery(false);
      expect(useUIStore.getState().showGallery).toBe(false);
    });

    it('should toggle gallery', () => {
      expect(useUIStore.getState().showGallery).toBe(false);

      useUIStore.getState().toggleGallery();
      expect(useUIStore.getState().showGallery).toBe(true);

      useUIStore.getState().toggleGallery();
      expect(useUIStore.getState().showGallery).toBe(false);
    });
  });

  describe('welcome screen', () => {
    it('should set welcome screen visibility', () => {
      useUIStore.getState().setShowWelcome(true);
      expect(useUIStore.getState().showWelcome).toBe(true);
    });

    it('should set welcome pinned state', () => {
      useUIStore.getState().setWelcomePinned(true);
      expect(useUIStore.getState().welcomePinned).toBe(true);
    });

    it('should set hide empty hint', () => {
      useUIStore.getState().setHideEmptyHint(true);
      expect(useUIStore.getState().hideEmptyHint).toBe(true);
    });

    it('should dismiss welcome and reset pinned', () => {
      useUIStore.getState().setShowWelcome(true);
      useUIStore.getState().setWelcomePinned(true);

      useUIStore.getState().dismissWelcome();

      expect(useUIStore.getState().showWelcome).toBe(false);
      expect(useUIStore.getState().welcomePinned).toBe(false);
    });
  });

  describe('node selector', () => {
    it('should open node selector with context', () => {
      const context: NodeSelectorContext = {
        position: { x: 100, y: 200 },
        clickPosition: { x: 150, y: 250 },
        connectionContext: {
          sourceNode: 'node-1',
          sourceHandle: 'out',
          handleType: 'output',
        },
      };

      useUIStore.getState().openNodeSelector(context);

      expect(useUIStore.getState().nodeSelectorOpen).toBe(true);
      expect(useUIStore.getState().nodeSelectorContext).toEqual(context);
    });

    it('should close node selector and clear context', () => {
      const context: NodeSelectorContext = {
        position: { x: 100, y: 200 },
        clickPosition: { x: 150, y: 250 },
      };

      useUIStore.getState().openNodeSelector(context);
      useUIStore.getState().closeNodeSelector();

      expect(useUIStore.getState().nodeSelectorOpen).toBe(false);
      expect(useUIStore.getState().nodeSelectorContext).toBeNull();
    });
  });

  describe('connection state', () => {
    it('should start connection', () => {
      useUIStore.getState().startConnection('node-1', 'handle-out', 'output');

      expect(useUIStore.getState().connectingNodeId).toBe('node-1');
      expect(useUIStore.getState().connectingHandleId).toBe('handle-out');
      expect(useUIStore.getState().connectingHandleType).toBe('output');
    });

    it('should clear connection', () => {
      useUIStore.getState().startConnection('node-1', 'handle-out', 'output');
      useUIStore.getState().clearConnection();

      expect(useUIStore.getState().connectingNodeId).toBeNull();
      expect(useUIStore.getState().connectingHandleId).toBeNull();
      expect(useUIStore.getState().connectingHandleType).toBeNull();
    });
  });

  describe('selection', () => {
    it('should set selected node ID', () => {
      useUIStore.getState().setSelectedNodeId('node-1');
      expect(useUIStore.getState().selectedNodeId).toBe('node-1');

      useUIStore.getState().setSelectedNodeId(null);
      expect(useUIStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('helper lines', () => {
    it('should set helper lines', () => {
      useUIStore.getState().setHelperLines({ horizontal: 100, vertical: 200 });

      expect(useUIStore.getState().helperLines).toEqual({
        horizontal: 100,
        vertical: 200,
      });
    });

    it('should clear helper lines', () => {
      useUIStore.getState().setHelperLines({ horizontal: 100, vertical: 200 });
      useUIStore.getState().clearHelperLines();

      expect(useUIStore.getState().helperLines).toEqual({
        horizontal: null,
        vertical: null,
      });
    });

    it('should handle partial helper lines', () => {
      useUIStore.getState().setHelperLines({ horizontal: 50, vertical: null });

      expect(useUIStore.getState().helperLines).toEqual({
        horizontal: 50,
        vertical: null,
      });
    });
  });

  describe('validation errors', () => {
    it('should set validation errors', () => {
      const errors = [
        { type: 'type-mismatch', message: 'Type mismatch', edgeId: 'e1' },
        { type: 'missing-handle', message: 'Missing handle' },
      ];

      useUIStore.getState().setValidationErrors(errors);
      expect(useUIStore.getState().validationErrors).toEqual(errors);
    });

    it('should add validation error', () => {
      const error1 = { type: 'error-1', message: 'Error 1' };
      const error2 = { type: 'error-2', message: 'Error 2' };

      useUIStore.getState().addValidationError(error1);
      useUIStore.getState().addValidationError(error2);

      expect(useUIStore.getState().validationErrors).toHaveLength(2);
      expect(useUIStore.getState().validationErrors[0]).toEqual(error1);
      expect(useUIStore.getState().validationErrors[1]).toEqual(error2);
    });

    it('should dismiss validation error by index', () => {
      const errors = [
        { type: 'error-1', message: 'Error 1' },
        { type: 'error-2', message: 'Error 2' },
        { type: 'error-3', message: 'Error 3' },
      ];

      useUIStore.getState().setValidationErrors(errors);
      useUIStore.getState().dismissValidationError(1);

      expect(useUIStore.getState().validationErrors).toHaveLength(2);
      expect(useUIStore.getState().validationErrors[0].type).toBe('error-1');
      expect(useUIStore.getState().validationErrors[1].type).toBe('error-3');
    });

    it('should clear all validation errors', () => {
      useUIStore.getState().setValidationErrors([
        { type: 'error-1', message: 'Error 1' },
        { type: 'error-2', message: 'Error 2' },
      ]);

      useUIStore.getState().clearValidationErrors();

      expect(useUIStore.getState().validationErrors).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      // Modify various state values
      useUIStore.getState().setSidebarOpen(false);
      useUIStore.getState().setShowGallery(true);
      useUIStore.getState().setShowWelcome(true);
      useUIStore.getState().setSelectedNodeId('node-1');
      useUIStore.getState().startConnection('node-1', 'out', 'output');
      useUIStore.getState().addValidationError({ type: 'error', message: 'test' });

      // Reset
      useUIStore.getState().reset();

      // Verify all values are back to default
      const state = useUIStore.getState();
      expect(state.sidebarOpen).toBe(true);
      expect(state.showGallery).toBe(false);
      expect(state.showWelcome).toBe(false);
      expect(state.selectedNodeId).toBeNull();
      expect(state.connectingNodeId).toBeNull();
      expect(state.validationErrors).toEqual([]);
    });
  });
});
