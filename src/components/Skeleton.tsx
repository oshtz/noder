import React from 'react';
import './Skeleton.css';

// =============================================================================
// Types
// =============================================================================

export interface SkeletonProps {
  /** Width of the skeleton (CSS value) */
  width?: string | number;
  /** Height of the skeleton (CSS value) */
  height?: string | number;
  /** Border radius (CSS value) */
  borderRadius?: string | number;
  /** Variant type */
  variant?: 'text' | 'rectangular' | 'circular';
  /** Number of lines for text variant */
  lines?: number;
  /** Custom className */
  className?: string;
  /** Animation type */
  animation?: 'pulse' | 'wave' | 'none';
}

export interface SkeletonCardProps {
  /** Show image placeholder */
  showImage?: boolean;
  /** Number of text lines */
  lines?: number;
  /** Custom className */
  className?: string;
}

export interface SkeletonListProps {
  /** Number of items to show */
  count?: number;
  /** Height per item */
  itemHeight?: number;
  /** Gap between items */
  gap?: number;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Skeleton Component
// =============================================================================

/**
 * Skeleton - Loading placeholder component
 *
 * @example
 * ```tsx
 * // Text skeleton
 * <Skeleton variant="text" width="80%" />
 *
 * // Rectangular skeleton
 * <Skeleton variant="rectangular" width={200} height={100} />
 *
 * // Circular skeleton (avatar)
 * <Skeleton variant="circular" width={40} height={40} />
 *
 * // Multiple text lines
 * <Skeleton variant="text" lines={3} />
 * ```
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius,
  variant = 'text',
  lines = 1,
  className = '',
  animation = 'pulse',
}) => {
  const getStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {};

    if (width !== undefined) {
      style.width = typeof width === 'number' ? `${width}px` : width;
    }

    if (height !== undefined) {
      style.height = typeof height === 'number' ? `${height}px` : height;
    }

    if (borderRadius !== undefined) {
      style.borderRadius = typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;
    } else if (variant === 'circular') {
      style.borderRadius = '50%';
    } else if (variant === 'text') {
      style.borderRadius = '4px';
    }

    return style;
  };

  const baseClass = `skeleton skeleton--${variant} skeleton--${animation} ${className}`.trim();

  if (variant === 'text' && lines > 1) {
    return (
      <div className="skeleton-text-group">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={baseClass}
            style={{
              ...getStyle(),
              width: index === lines - 1 ? '60%' : width || '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return <div className={baseClass} style={getStyle()} />;
};

// =============================================================================
// SkeletonCard Component
// =============================================================================

/**
 * SkeletonCard - Card-shaped loading placeholder
 *
 * @example
 * ```tsx
 * <SkeletonCard showImage lines={2} />
 * ```
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showImage = true,
  lines = 2,
  className = '',
}) => {
  return (
    <div className={`skeleton-card ${className}`}>
      {showImage && <Skeleton variant="rectangular" width="100%" height={120} />}
      <div className="skeleton-card-content">
        <Skeleton variant="text" width="60%" height={16} />
        <Skeleton variant="text" lines={lines} />
      </div>
    </div>
  );
};

// =============================================================================
// SkeletonList Component
// =============================================================================

/**
 * SkeletonList - List loading placeholder
 *
 * @example
 * ```tsx
 * <SkeletonList count={5} itemHeight={48} />
 * ```
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 3,
  itemHeight: _itemHeight = 48,
  gap = 8,
  className = '',
}) => {
  return (
    <div className={`skeleton-list ${className}`} style={{ gap: `${gap}px` }}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-list-item">
          <Skeleton variant="circular" width={32} height={32} />
          <div className="skeleton-list-item-content">
            <Skeleton variant="text" width="40%" height={14} />
            <Skeleton variant="text" width="70%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// SkeletonWorkflowList Component
// =============================================================================

/**
 * SkeletonWorkflowList - Workflow list loading placeholder
 */
export const SkeletonWorkflowList: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="skeleton-workflow-list">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-workflow-item">
          <div className="skeleton-workflow-item-icon">
            <Skeleton variant="rectangular" width={24} height={24} borderRadius={4} />
          </div>
          <div className="skeleton-workflow-item-content">
            <Skeleton variant="text" width="60%" height={14} />
            <Skeleton variant="text" width="40%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// SkeletonModelPicker Component
// =============================================================================

/**
 * SkeletonModelPicker - Model picker loading placeholder
 */
export const SkeletonModelPicker: React.FC = () => {
  return (
    <div className="skeleton-model-picker">
      <Skeleton variant="rectangular" width="100%" height={36} borderRadius={6} />
      <div className="skeleton-model-picker-list">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="skeleton-model-picker-item">
            <Skeleton variant="circular" width={20} height={20} />
            <div className="skeleton-model-picker-item-content">
              <Skeleton variant="text" width="50%" height={12} />
              <Skeleton variant="text" width="80%" height={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
