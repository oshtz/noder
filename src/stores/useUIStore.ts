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

  // App feedback
  notifications: AppNotification[];
  activeDialog: AppDialog | null;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

export interface PromptDialogOptions {
  title: string;
  message: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
}

export type AppDialog =
  | (ConfirmDialogOptions & {
      id: string;
      kind: 'confirm';
      resolve: (value: boolean) => void;
    })
  | (PromptDialogOptions & {
      id: string;
      kind: 'prompt';
      resolve: (value: string | null) => void;
    });

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

  // App feedback
  addNotification: (notification: Omit<AppNotification, 'id'>) => string;
  dismissNotification: (id: string) => void;
  showConfirmDialog: (options: ConfirmDialogOptions) => Promise<boolean>;
  showPromptDialog: (options: PromptDialogOptions) => Promise<string | null>;
  resolveDialog: (value: boolean | string | null) => void;

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
  notifications: [],
  activeDialog: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
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

      // App feedback
      addNotification: (notification) => {
        const id = `notification-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          notifications: [...state.notifications, { ...notification, id }].slice(-5),
        }));
        window.setTimeout(() => get().dismissNotification(id), 7000);
        return id;
      },
      dismissNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((notification) => notification.id !== id),
        })),
      showConfirmDialog: (options) =>
        new Promise<boolean>((resolve) => {
          const id = `dialog-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          set({ activeDialog: { ...options, id, kind: 'confirm', resolve } });
        }),
      showPromptDialog: (options) =>
        new Promise<string | null>((resolve) => {
          const id = `dialog-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          set({ activeDialog: { ...options, id, kind: 'prompt', resolve } });
        }),
      resolveDialog: (value) => {
        const dialog = get().activeDialog;
        if (!dialog) return;

        if (dialog.kind === 'confirm') {
          dialog.resolve(Boolean(value));
        } else {
          dialog.resolve(typeof value === 'string' ? value : null);
        }

        set({ activeDialog: null });
      },

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
