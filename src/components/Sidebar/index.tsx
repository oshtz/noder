/**
 * Sidebar component exports.
 * Re-exports from the main Sidebar.tsx for backwards compatibility.
 */

// Re-export the main Sidebar component
export { default } from '../Sidebar';
export { default as Sidebar } from '../Sidebar';

// Export sub-components for modular use
export { WorkflowItem } from './WorkflowItem';
export { WorkflowsPopover } from './WorkflowsPopover';
export { TemplateCard } from './TemplateCard';
export { TemplatesPopover } from './TemplatesPopover';

// Export types
export type {
  Workflow,
  WorkflowOutput,
  Template,
  TemplateCategory,
  PopoverType,
  WorkflowSortBy,
  TemplateIndicatorStyle,
  SidebarProps,
  WorkflowItemProps,
  WorkflowsPopoverProps,
  TemplatesPopoverProps,
  TemplateCardProps,
} from './types';
