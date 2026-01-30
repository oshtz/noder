import { useState, useCallback } from 'react';
import type { ValidationError } from '../types/components';

export interface ValidationErrorsResult {
  validationErrors: ValidationError[];
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  handleDismissError: (index: number | undefined) => void;
  clearAllErrors: () => void;
  addMigrationErrors: (errors: string[]) => void;
}

/**
 * Hook that manages validation errors state and provides handlers for
 * dismissing individual errors or clearing all errors.
 */
export function useValidationErrors(initialErrors: ValidationError[] = []): ValidationErrorsResult {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(initialErrors);

  const handleDismissError = useCallback((index: number | undefined): void => {
    if (typeof index === 'number') {
      setValidationErrors((prev) => prev.filter((_, i) => i !== index));
    } else {
      setValidationErrors([]);
    }
  }, []);

  const clearAllErrors = useCallback((): void => {
    setValidationErrors([]);
  }, []);

  const addMigrationErrors = useCallback((errors: string[]): void => {
    setValidationErrors(errors.map((msg) => ({ type: 'migration', message: msg })));
  }, []);

  return {
    validationErrors,
    setValidationErrors,
    handleDismissError,
    clearAllErrors,
    addMigrationErrors,
  };
}
