import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface NodeSelectorContext {
  position: { x: number; y: number };
  clickPosition: { x: number; y: number };
  connectionContext?: {
    sourceNode: string;
    sourceHandle: string;
    handleType: string;
  };
}

export interface UIState {
  // Sidebar
  sidebarOpen: boolean;

  // Gallery
  showGallery: boolean;

  // Welcome screen
  showWelcome: boolean;
  welcomePinned: boolean;
  hideEmptyHint: boolean;

  // Node selector
  nodeSelectorOpen: boolean;
  nodeSelectorContext: NodeSelectorContext | null;

  // Connection state (while dragging)
  connectingNodeId: string | null;
  connectingHandleId: string | null;
  connectingHandleType: string | null;

  // Selection state
  selectedNodeId: string | null;

  // Helper lines for alignment
  helperLines: {
    horizontal: number | null;
    vertical: number | null;
  };

  // Validation errors panel
  validationErrors: Array<{
    type: string;
    message: string;
    edgeId?: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
}

export interface UIActions {
  // Sidebar
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Gallery
  setShowGallery: (show: boolean) => void;
  toggleGallery: () => void;

  // Welcome screen
  setShowWelcome: (show: boolean) => void;
  setWelcomePinned: (pinned: boolean) => void;
  setHideEmptyHint: (hide: boolean) => void;
  dismissWelcome: () => void;

  // Node selector
  openNodeSelector: (context: NodeSelectorContext) => void;
  closeNodeSelector: () => void;

  // Connection state
  startConnection: (nodeId: string, handleId: string, handleType: string) => void;
  clearConnection: () => void;

  // Selection
  setSelectedNodeId: (nodeId: string | null) => void;

  // Helper lines
  setHelperLines: (lines: { horizontal: number | null; vertical: number | null }) => void;
  clearHelperLines: () => void;

  // Validation errors
  setValidationErrors: (errors: UIState['validationErrors']) => void;
  addValidationError: (error: UIState['validationErrors'][0]) => void;
  dismissValidationError: (index: number) => void;
  clearValidationErrors: () => void;

  // Reset
  reset: () => void;
}

export type UIStore = UIState & UIActions;

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_STATE: UIState = {
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
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useUIStore = create<UIStore>()(
  persist(
    (set, _get) => ({
      ...DEFAULT_STATE,

      // Sidebar
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Gallery
      setShowGallery: (show) => set({ showGallery: show }),
      toggleGallery: () => set((state) => ({ showGallery: !state.showGallery })),

      // Welcome screen
      setShowWelcome: (show) => set({ showWelcome: show }),
      setWelcomePinned: (pinned) => set({ welcomePinned: pinned }),
      setHideEmptyHint: (hide) => set({ hideEmptyHint: hide }),
      dismissWelcome: () =>
        set({
          showWelcome: false,
          welcomePinned: false,
        }),

      // Node selector
      openNodeSelector: (context) =>
        set({
          nodeSelectorOpen: true,
          nodeSelectorContext: context,
        }),
      closeNodeSelector: () =>
        set({
          nodeSelectorOpen: false,
          nodeSelectorContext: null,
        }),

      // Connection state
      startConnection: (nodeId, handleId, handleType) =>
        set({
          connectingNodeId: nodeId,
          connectingHandleId: handleId,
          connectingHandleType: handleType,
        }),
      clearConnection: () =>
        set({
          connectingNodeId: null,
          connectingHandleId: null,
          connectingHandleType: null,
        }),

      // Selection
      setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),

      // Helper lines
      setHelperLines: (lines) => set({ helperLines: lines }),
      clearHelperLines: () => set({ helperLines: { horizontal: null, vertical: null } }),

      // Validation errors
      setValidationErrors: (errors) => set({ validationErrors: errors }),
      addValidationError: (error) =>
        set((state) => ({
          validationErrors: [...state.validationErrors, error],
        })),
      dismissValidationError: (index) =>
        set((state) => ({
          validationErrors: state.validationErrors.filter((_, i) => i !== index),
        })),
      clearValidationErrors: () => set({ validationErrors: [] }),

      // Reset
      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'noder-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist some UI preferences
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

// Export selector hooks for convenience
export const useSidebarOpen = () => useUIStore((s) => s.sidebarOpen);
export const useShowGallery = () => useUIStore((s) => s.showGallery);
export const useShowWelcome = () => useUIStore((s) => s.showWelcome);
export const useSelectedNodeId = () => useUIStore((s) => s.selectedNodeId);
export const useValidationErrors = () => useUIStore((s) => s.validationErrors);
export const useHelperLines = () => useUIStore((s) => s.helperLines);

export default useUIStore;
