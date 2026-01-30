import React from 'react';
import { X } from 'react-feather';
import { useUIStore } from '../stores/useUIStore';
import type { ValidationError } from '../types/components';

// Store error type from useUIStore
type StoreValidationError = {
  type: string;
  message: string;
  edgeId?: string;
  sourceHandle?: string;
  targetHandle?: string;
};

// Union type for both error formats
type AnyValidationError = ValidationError | StoreValidationError;

export interface ValidationErrorsPanelProps {
  /** Optional external errors (for backward compatibility) */
  errors?: AnyValidationError[];
  /** Optional external dismiss handler */
  onDismiss?: (index?: number) => void;
  /** Optional external clear all handler */
  onClearAll?: () => void;
}

// Type guard to check if error is ValidationError with edge property
const hasEdge = (error: AnyValidationError): error is ValidationError => {
  return 'edge' in error && error.edge !== undefined;
};

// Type guard to check if error is ValidationError with errors property
const hasErrors = (error: AnyValidationError): error is ValidationError => {
  return 'errors' in error && error.errors !== undefined;
};

/**
 * ValidationErrorsPanel - Displays connection validation errors
 * Shows a list of invalid edge connections with dismiss functionality
 * Now reads from useUIStore by default, with optional props for backward compatibility
 */
const ValidationErrorsPanel: React.FC<ValidationErrorsPanelProps> = ({
  errors: externalErrors,
  onDismiss: externalOnDismiss,
  onClearAll: externalOnClearAll,
}) => {
  // Read from store
  const storeErrors = useUIStore((s) => s.validationErrors);
  const dismissValidationError = useUIStore((s) => s.dismissValidationError);
  const clearValidationErrors = useUIStore((s) => s.clearValidationErrors);

  // Use external props if provided, otherwise use store
  const errors: AnyValidationError[] = externalErrors ?? storeErrors;
  const onDismiss =
    externalOnDismiss ??
    ((index?: number) => {
      if (index !== undefined) {
        dismissValidationError(index);
      }
    });
  const onClearAll = externalOnClearAll ?? clearValidationErrors;

  if (!errors.length) return null;

  return (
    <div className="validation-errors-panel">
      <div className="panel-header">
        <h3>Connection Issues ({errors.length})</h3>
        <div className="panel-actions">
          <button onClick={onClearAll} className="panel-button" title="Clear all">
            Clear All
          </button>
          <button onClick={() => onDismiss()} className="panel-button" title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="error-list">
        {errors.map((error, index) => {
          // Handle both error formats
          const sourceLabel = hasEdge(error) ? error.edge?.source : 'Unknown';
          const targetLabel = hasEdge(error) ? error.edge?.target : 'Unknown';
          const errorList = hasErrors(error) ? error.errors?.join(', ') : 'Unknown error';

          return (
            <div
              key={`${sourceLabel || 'unknown'}-${targetLabel || 'unknown'}-${index}`}
              className="error-item"
            >
              <div className="error-header">
                <span className="edge-label">
                  {sourceLabel || 'Unknown'} → {targetLabel || 'Unknown'}
                </span>
                <button onClick={() => onDismiss(index)} className="dismiss-button">
                  ×
                </button>
              </div>
              <div className="error-details">
                {error.message || `Failed validations: ${errorList}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ValidationErrorsPanel;
