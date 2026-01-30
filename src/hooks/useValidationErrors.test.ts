/**
 * Tests for useValidationErrors hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationErrors } from './useValidationErrors';
import type { ValidationError } from '../types/components';

describe('useValidationErrors', () => {
  describe('initialization', () => {
    it('should initialize with empty errors array by default', () => {
      const { result } = renderHook(() => useValidationErrors());

      expect(result.current.validationErrors).toEqual([]);
    });

    it('should initialize with provided errors', () => {
      const initialErrors: ValidationError[] = [
        { type: 'type-mismatch', message: 'Error 1' },
        { type: 'data-flow', message: 'Error 2' },
      ];

      const { result } = renderHook(() => useValidationErrors(initialErrors));

      expect(result.current.validationErrors).toEqual(initialErrors);
    });
  });

  describe('setValidationErrors', () => {
    it('should set validation errors directly', () => {
      const { result } = renderHook(() => useValidationErrors());

      const newErrors: ValidationError[] = [{ type: 'invalid-edge', message: 'Invalid edge' }];

      act(() => {
        result.current.setValidationErrors(newErrors);
      });

      expect(result.current.validationErrors).toEqual(newErrors);
    });

    it('should update errors using callback function', () => {
      const initialErrors: ValidationError[] = [{ type: 'error-1', message: 'Error 1' }];

      const { result } = renderHook(() => useValidationErrors(initialErrors));

      act(() => {
        result.current.setValidationErrors((prev) => [
          ...prev,
          { type: 'error-2', message: 'Error 2' },
        ]);
      });

      expect(result.current.validationErrors).toHaveLength(2);
    });
  });

  describe('handleDismissError', () => {
    it('should dismiss error at specific index', () => {
      const initialErrors: ValidationError[] = [
        { type: 'error-0', message: 'Error 0' },
        { type: 'error-1', message: 'Error 1' },
        { type: 'error-2', message: 'Error 2' },
      ];

      const { result } = renderHook(() => useValidationErrors(initialErrors));

      act(() => {
        result.current.handleDismissError(1);
      });

      expect(result.current.validationErrors).toHaveLength(2);
      expect(result.current.validationErrors[0].type).toBe('error-0');
      expect(result.current.validationErrors[1].type).toBe('error-2');
    });

    it('should clear all errors when index is undefined', () => {
      const initialErrors: ValidationError[] = [
        { type: 'error-0', message: 'Error 0' },
        { type: 'error-1', message: 'Error 1' },
      ];

      const { result } = renderHook(() => useValidationErrors(initialErrors));

      act(() => {
        result.current.handleDismissError(undefined);
      });

      expect(result.current.validationErrors).toEqual([]);
    });

    it('should dismiss first error when index is 0', () => {
      const initialErrors: ValidationError[] = [
        { type: 'error-0', message: 'Error 0' },
        { type: 'error-1', message: 'Error 1' },
      ];

      const { result } = renderHook(() => useValidationErrors(initialErrors));

      act(() => {
        result.current.handleDismissError(0);
      });

      expect(result.current.validationErrors).toHaveLength(1);
      expect(result.current.validationErrors[0].type).toBe('error-1');
    });

    it('should dismiss last error', () => {
      const initialErrors: ValidationError[] = [
        { type: 'error-0', message: 'Error 0' },
        { type: 'error-1', message: 'Error 1' },
      ];

      const { result } = renderHook(() => useValidationErrors(initialErrors));

      act(() => {
        result.current.handleDismissError(1);
      });

      expect(result.current.validationErrors).toHaveLength(1);
      expect(result.current.validationErrors[0].type).toBe('error-0');
    });

    it('should handle out-of-bounds index gracefully', () => {
      const initialErrors: ValidationError[] = [{ type: 'error-0', message: 'Error 0' }];

      const { result } = renderHook(() => useValidationErrors(initialErrors));

      act(() => {
        result.current.handleDismissError(100);
      });

      // Array filter with out-of-bounds index just returns all elements
      expect(result.current.validationErrors).toHaveLength(1);
    });
  });

  describe('clearAllErrors', () => {
    it('should clear all errors', () => {
      const initialErrors: ValidationError[] = [
        { type: 'error-0', message: 'Error 0' },
        { type: 'error-1', message: 'Error 1' },
        { type: 'error-2', message: 'Error 2' },
      ];

      const { result } = renderHook(() => useValidationErrors(initialErrors));

      act(() => {
        result.current.clearAllErrors();
      });

      expect(result.current.validationErrors).toEqual([]);
    });

    it('should be idempotent on empty array', () => {
      const { result } = renderHook(() => useValidationErrors());

      act(() => {
        result.current.clearAllErrors();
      });

      expect(result.current.validationErrors).toEqual([]);
    });
  });

  describe('addMigrationErrors', () => {
    it('should add migration errors from string array', () => {
      const { result } = renderHook(() => useValidationErrors());

      act(() => {
        result.current.addMigrationErrors(['Migration error 1', 'Migration error 2']);
      });

      expect(result.current.validationErrors).toHaveLength(2);
      expect(result.current.validationErrors[0]).toEqual({
        type: 'migration',
        message: 'Migration error 1',
      });
      expect(result.current.validationErrors[1]).toEqual({
        type: 'migration',
        message: 'Migration error 2',
      });
    });

    it('should replace existing errors', () => {
      const initialErrors: ValidationError[] = [{ type: 'old-error', message: 'Old error' }];

      const { result } = renderHook(() => useValidationErrors(initialErrors));

      act(() => {
        result.current.addMigrationErrors(['New migration error']);
      });

      expect(result.current.validationErrors).toHaveLength(1);
      expect(result.current.validationErrors[0].type).toBe('migration');
    });

    it('should handle empty array', () => {
      const { result } = renderHook(() => useValidationErrors());

      act(() => {
        result.current.addMigrationErrors([]);
      });

      expect(result.current.validationErrors).toEqual([]);
    });
  });

  describe('callback stability', () => {
    it('should maintain stable callback references', () => {
      const { result, rerender } = renderHook(() => useValidationErrors());

      const firstHandleDismissError = result.current.handleDismissError;
      const firstClearAllErrors = result.current.clearAllErrors;
      const firstAddMigrationErrors = result.current.addMigrationErrors;

      rerender();

      expect(result.current.handleDismissError).toBe(firstHandleDismissError);
      expect(result.current.clearAllErrors).toBe(firstClearAllErrors);
      expect(result.current.addMigrationErrors).toBe(firstAddMigrationErrors);
    });
  });
});
