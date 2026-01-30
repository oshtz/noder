import React from 'react';
import './UploadProgress.css';

// =============================================================================
// Types
// =============================================================================

export interface UploadProgressProps {
  /** Progress percentage (0-100), or null for indeterminate */
  progress?: number | null;
  /** Label to display (e.g., "Uploading..." or filename) */
  label?: string;
  /** Whether to show the progress bar */
  visible?: boolean;
  /** Size variant */
  size?: 'small' | 'medium';
}

// =============================================================================
// Component
// =============================================================================

/**
 * UploadProgress - Progress bar component for file uploads
 *
 * Supports both determinate (with percentage) and indeterminate (loading) states.
 * Uses CSS animations for smooth visual feedback.
 *
 * @example
 * ```tsx
 * // Indeterminate (no progress tracking)
 * <UploadProgress visible={isUploading} label="Uploading..." />
 *
 * // Determinate (with progress tracking)
 * <UploadProgress visible={isUploading} progress={45} label="Uploading image.png" />
 * ```
 */
export const UploadProgress: React.FC<UploadProgressProps> = ({
  progress = null,
  label = 'Uploading...',
  visible = true,
  size = 'medium',
}) => {
  if (!visible) return null;

  const isIndeterminate = progress === null || progress === undefined;
  const progressValue = isIndeterminate ? 0 : Math.min(100, Math.max(0, progress));

  return (
    <div className={`upload-progress upload-progress--${size}`}>
      {label && <span className="upload-progress-label">{label}</span>}
      <div className="upload-progress-bar-container">
        <div
          className={`upload-progress-bar ${isIndeterminate ? 'upload-progress-bar--indeterminate' : ''}`}
          style={isIndeterminate ? undefined : { width: `${progressValue}%` }}
          role="progressbar"
          aria-valuenow={isIndeterminate ? undefined : progressValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
      {!isIndeterminate && (
        <span className="upload-progress-percentage">{Math.round(progressValue)}%</span>
      )}
    </div>
  );
};

export default UploadProgress;
