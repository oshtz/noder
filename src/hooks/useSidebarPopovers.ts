/**
 * Hook for managing sidebar popover state.
 * Handles which popover is open and template category selection.
 */

import { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export type PopoverType = 'workflows' | 'templates' | 'gallery' | null;

interface TemplateIndicatorStyle {
  width: number;
  transform: string;
  opacity: number;
}

interface UseSidebarPopoversReturn {
  /** Currently active popover */
  activePopover: PopoverType;
  /** Set active popover */
  setActivePopover: (popover: PopoverType) => void;
  /** Toggle a specific popover */
  togglePopover: (popover: PopoverType) => void;
  /** Close active popover */
  closePopover: () => void;
  /** Whether the new workflow popover is shown */
  showNewWorkflowPopover: boolean;
  /** Set new workflow popover visibility */
  setShowNewWorkflowPopover: (show: boolean) => void;
  /** Whether creating a new workflow */
  creatingWorkflow: boolean;
  /** Set creating workflow state */
  setCreatingWorkflow: (creating: boolean) => void;
  /** New workflow name input */
  newWorkflowName: string;
  /** Set new workflow name */
  setNewWorkflowName: (name: string) => void;
  /** Reset new workflow popover state */
  resetNewWorkflowPopover: () => void;
  /** Selected template category */
  selectedTemplateCategory: string;
  /** Set selected template category */
  setSelectedTemplateCategory: (category: string) => void;
  /** Template indicator style */
  templateIndicatorStyle: TemplateIndicatorStyle;
  /** Ref for template categories container */
  templateCategoriesRef: React.RefObject<HTMLDivElement>;
  /** Refs for template category buttons */
  templateCategoryButtonRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  /** Update template indicator position */
  updateTemplateIndicator: () => void;
  /** Whether gallery is currently being dragged */
  isGalleryDragging: boolean;
  /** Set gallery dragging state */
  setIsGalleryDragging: (dragging: boolean) => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing sidebar popover state and interactions.
 */
export function useSidebarPopovers(): UseSidebarPopoversReturn {
  const [activePopover, setActivePopover] = useState<PopoverType>(null);
  const [showNewWorkflowPopover, setShowNewWorkflowPopover] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState('beginner');
  const [templateIndicatorStyle, setTemplateIndicatorStyle] = useState<TemplateIndicatorStyle>({
    width: 0,
    transform: 'translateX(0px)',
    opacity: 0,
  });
  const [isGalleryDragging, setIsGalleryDragging] = useState(false);

  const templateCategoriesRef = useRef<HTMLDivElement>(null);
  const templateCategoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const togglePopover = useCallback((popover: PopoverType) => {
    setActivePopover((current) => (current === popover ? null : popover));
  }, []);

  const closePopover = useCallback(() => {
    setActivePopover(null);
  }, []);

  const resetNewWorkflowPopover = useCallback(() => {
    setShowNewWorkflowPopover(false);
    setCreatingWorkflow(false);
    setNewWorkflowName('');
  }, []);

  const updateTemplateIndicator = useCallback(() => {
    const container = templateCategoriesRef.current;
    const button = templateCategoryButtonRefs.current[selectedTemplateCategory];
    if (!container || !button) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const left = buttonRect.left - containerRect.left;

    setTemplateIndicatorStyle({
      width: buttonRect.width,
      transform: `translateX(${left}px)`,
      opacity: 1,
    });
  }, [selectedTemplateCategory]);

  // Update indicator when templates popover opens
  useLayoutEffect(() => {
    if (activePopover !== 'templates') return;
    updateTemplateIndicator();
  }, [activePopover, updateTemplateIndicator]);

  // Watch for resize changes in template categories
  useEffect(() => {
    if (activePopover !== 'templates') return undefined;
    const container = templateCategoriesRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(() => updateTemplateIndicator());
    observer.observe(container);
    return () => observer.disconnect();
  }, [activePopover, updateTemplateIndicator]);

  return {
    activePopover,
    setActivePopover,
    togglePopover,
    closePopover,
    showNewWorkflowPopover,
    setShowNewWorkflowPopover,
    creatingWorkflow,
    setCreatingWorkflow,
    newWorkflowName,
    setNewWorkflowName,
    resetNewWorkflowPopover,
    selectedTemplateCategory,
    setSelectedTemplateCategory,
    templateIndicatorStyle,
    templateCategoriesRef,
    templateCategoryButtonRefs,
    updateTemplateIndicator,
    isGalleryDragging,
    setIsGalleryDragging,
  };
}

export default useSidebarPopovers;
