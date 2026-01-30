import { Component, ErrorInfo, ReactNode, CSSProperties, ComponentType } from 'react';
import { logError, ErrorLevel, ErrorCategory } from '../utils/errorLogger';

// =============================================================================
// Types
// =============================================================================

type BoundaryLevel = 'component' | 'node' | 'canvas' | 'panel';

interface FallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retry: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  level?: BoundaryLevel;
  fallback?: (props: FallbackProps) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface Styles {
  container: CSSProperties;
  content: CSSProperties;
  icon: CSSProperties;
  title: CSSProperties;
  message: CSSProperties;
  actions: CSSProperties;
  retryButton: CSSProperties;
  details: CSSProperties;
  summary: CSSProperties;
  stack: CSSProperties;
}

interface NodeErrorStyles {
  container: CSSProperties;
  icon: CSSProperties;
  text: CSSProperties;
  button: CSSProperties;
}

interface NodeErrorBoundaryProps {
  children: ReactNode;
  nodeId?: string;
  nodeType?: string;
}

// =============================================================================
// ErrorBoundary Component
// =============================================================================

/**
 * Error Boundary component to catch JavaScript errors in child components
 * Displays a fallback UI instead of crashing the entire application
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to structured error logger
    const { level = 'component' } = this.props;
    logError(error, {
      level: ErrorLevel.ERROR,
      category: level === 'node' ? ErrorCategory.NODE : ErrorCategory.UI,
      context: {
        componentStack: errorInfo?.componentStack,
        boundaryLevel: level,
      },
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI provided via props
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          retry: this.handleRetry,
        });
      }

      // Default fallback UI
      const { level = 'component' } = this.props;

      return (
        <div style={styles.container} data-error-boundary={level}>
          <div style={styles.content}>
            <div style={styles.icon}>!</div>
            <h3 style={styles.title}>Something went wrong</h3>
            <p style={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div style={styles.actions}>
              <button onClick={this.handleRetry} style={styles.retryButton}>
                Try Again
              </button>
              {this.props.showDetails && this.state.errorInfo && (
                <details style={styles.details}>
                  <summary style={styles.summary}>Error Details</summary>
                  <pre style={styles.stack}>
                    {this.state.error?.toString()}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles: Styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    minHeight: '100px',
    backgroundColor: 'var(--bg-secondary, #1e1e1e)',
    borderRadius: '8px',
    border: '1px solid var(--error-color, #ff4444)',
  },
  content: {
    textAlign: 'center',
    maxWidth: '400px',
  },
  icon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'var(--error-color, #ff4444)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 auto 12px',
  },
  title: {
    margin: '0 0 8px 0',
    color: 'var(--text-primary, #ffffff)',
    fontSize: '16px',
  },
  message: {
    margin: '0 0 16px 0',
    color: 'var(--text-secondary, #888888)',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: 'var(--accent-color, #007bff)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  details: {
    width: '100%',
    textAlign: 'left',
  },
  summary: {
    cursor: 'pointer',
    color: 'var(--text-secondary, #888888)',
    fontSize: '12px',
  },
  stack: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: 'var(--bg-tertiary, #0a0a0a)',
    borderRadius: '4px',
    fontSize: '10px',
    overflow: 'auto',
    maxHeight: '150px',
    color: 'var(--text-secondary, #888888)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};

// =============================================================================
// Higher-Order Component
// =============================================================================

/**
 * Higher-order component to wrap a component with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryProps, 'children'> = {}
): ComponentType<P> {
  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundary;
}

// =============================================================================
// Node Error Boundary
// =============================================================================

const nodeErrorStyles: NodeErrorStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: '4px',
    border: '1px solid var(--error-color, #ff4444)',
  },
  icon: {
    color: 'var(--error-color, #ff4444)',
    fontWeight: 'bold',
  },
  text: {
    color: 'var(--text-secondary, #888888)',
    fontSize: '12px',
  },
  button: {
    marginLeft: 'auto',
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: 'var(--accent-color, #007bff)',
    border: '1px solid var(--accent-color, #007bff)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
  },
};

/**
 * Node-specific error boundary with minimal UI
 */
export function NodeErrorBoundary({
  children,
  nodeId,
  nodeType,
}: NodeErrorBoundaryProps): JSX.Element {
  return (
    <ErrorBoundary
      level="node"
      onError={(error) => {
        // Additional context logging for node errors (main logging done in ErrorBoundary)
        logError(error, {
          level: ErrorLevel.ERROR,
          category: ErrorCategory.NODE,
          context: { nodeId, nodeType },
        });
      }}
      fallback={({ retry }) => (
        <div style={nodeErrorStyles.container}>
          <span style={nodeErrorStyles.icon}>!</span>
          <span style={nodeErrorStyles.text}>Error</span>
          <button onClick={retry} style={nodeErrorStyles.button}>
            Retry
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
