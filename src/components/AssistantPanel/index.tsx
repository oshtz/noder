/**
 * AssistantPanel component exports.
 * Re-exports from the main AssistantPanel.tsx for backwards compatibility.
 */

// Re-export the main AssistantPanel component
export { default } from '../AssistantPanel';
export { default as AssistantPanel } from '../AssistantPanel';

// Export sub-components for modular use
export { MessageDisplay } from './MessageDisplay';
export { MessageComposer } from './MessageComposer';
export { ModelPickerPanel } from './ModelPickerPanel';

// Export constants
export {
  MODEL_CATALOG,
  MAX_TOOL_ROUNDS,
  MAX_RECENT_MODELS,
  PANEL_OPEN_STORAGE_KEY,
} from './constants';

// Export types
export type {
  Message,
  ModelCatalogEntry,
  ToolResult,
  AssistantPanelProps,
  ModelPickerPanelProps,
  MessageDisplayProps,
  MessageComposerProps,
} from './types';
