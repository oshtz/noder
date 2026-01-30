/**
 * Shared hook for model picker state management.
 * Handles open/close state and outside-click detection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseModelPickerOptions {
  /** Initial model value */
  initialModel?: string;
  /** Callback when model is selected */
  onModelChange?: (model: string) => void;
}

interface UseModelPickerReturn {
  /** Whether the model picker is open */
  isOpen: boolean;
  /** Open the model picker */
  open: () => void;
  /** Close the model picker */
  close: () => void;
  /** Toggle the model picker */
  toggle: () => void;
  /** Currently selected model */
  selectedModel: string;
  /** Set the selected model */
  setSelectedModel: (model: string) => void;
  /** Handle model selection (sets model and closes picker) */
  handleSelect: (model: string) => void;
  /** Ref to attach to the picker container for outside-click detection */
  pickerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook for managing model picker state with outside-click detection.
 *
 * @example
 * ```tsx
 * const { isOpen, open, handleSelect, pickerRef } = useModelPicker({
 *   initialModel: formState.model,
 *   onModelChange: (model) => {
 *     setFormState(prev => ({ ...prev, model }));
 *     data.model = model;
 *   },
 * });
 * ```
 */
export function useModelPicker({
  initialModel = '',
  onModelChange,
}: UseModelPickerOptions = {}): UseModelPickerReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync selected model with initial model when it changes
  useEffect(() => {
    setSelectedModel(initialModel);
  }, [initialModel]);

  // Handle outside click to close picker
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Element;

      // Check if click is inside the model picker or metadata badge
      const modelPicker = target.closest('.replicate-model-picker');
      const metadataBadge = target.closest('.node-metadata-badge');
      const pickerContainer = pickerRef.current;

      if (pickerContainer && pickerContainer.contains(target)) {
        return;
      }

      if (!modelPicker && !metadataBadge) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleSelect = useCallback(
    (model: string): void => {
      setSelectedModel(model);
      setIsOpen(false);
      onModelChange?.(model);
    },
    [onModelChange]
  );

  return {
    isOpen,
    open,
    close,
    toggle,
    selectedModel,
    setSelectedModel,
    handleSelect,
    pickerRef,
  };
}

export default useModelPicker;
