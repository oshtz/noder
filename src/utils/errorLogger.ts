/**
 * Structured Error Logging System
 *
 * Provides centralized error logging with:
 * - Local storage persistence
 * - Error categorization
 * - Stack trace capture
 * - Timestamp tracking
 * - Error deduplication
 */

const ERROR_LOG_KEY = 'noder-error-log';
const MAX_ERRORS = 100;

// =============================================================================
// Types
// =============================================================================

/** Error severity levels */
export const ErrorLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export type ErrorLevelType = (typeof ErrorLevel)[keyof typeof ErrorLevel];

/** Error categories */
export const ErrorCategory = {
  NODE: 'node',
  WORKFLOW: 'workflow',
  API: 'api',
  UI: 'ui',
  PERSISTENCE: 'persistence',
  NETWORK: 'network',
  UNKNOWN: 'unknown',
} as const;

export type ErrorCategoryType = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/** Additional context for error logging */
export interface ErrorContext {
  nodeId?: string;
  nodeType?: string;
  workflowId?: string;
  endpoint?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  type?: string;
  [key: string]: unknown;
}

/** Options for logging an error */
export interface LogErrorOptions {
  level?: ErrorLevelType;
  category?: ErrorCategoryType;
  context?: ErrorContext;
  dedupe?: boolean;
}

/** Stored error entry structure */
export interface ErrorEntry {
  id: string;
  timestamp: string;
  level: ErrorLevelType;
  category: ErrorCategoryType;
  message: string;
  stack?: string;
  context: ErrorContext;
  hash: string;
  count: number;
  lastOccurrence?: string;
}

/** Error statistics */
export interface ErrorStats {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  last24h: number;
  lastHour: number;
}

/** Exported error log structure */
export interface ErrorLogExport {
  exportedAt: string;
  stats: ErrorStats;
  errors: ErrorEntry[];
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Get all logged errors
 */
export function getErrorLog(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(ERROR_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[ErrorLogger] Failed to read error log:', e);
    return [];
  }
}

/**
 * Save error log to storage
 */
function saveErrorLog(errors: ErrorEntry[]): void {
  try {
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(errors));
  } catch (e) {
    console.warn('[ErrorLogger] Failed to save error log:', e);
  }
}

/**
 * Generate a hash for error deduplication
 */
function generateErrorHash(error: Error): string {
  const message = error.message || '';
  const stack = error.stack || '';
  const firstStackLine = stack.split('\n')[1] || '';
  return `${message}:${firstStackLine}`.substring(0, 200);
}

/**
 * Log an error
 *
 * @param error - The error to log
 * @param options - Additional options
 * @returns The error entry that was logged or updated
 */
export function logError(error: Error | string, options: LogErrorOptions = {}): ErrorEntry {
  const {
    level = ErrorLevel.ERROR,
    category = ErrorCategory.UNKNOWN,
    context = {},
    dedupe = true,
  } = options;

  const errorObj = error instanceof Error ? error : new Error(String(error));
  const errorHash = generateErrorHash(errorObj);

  const errorEntry: ErrorEntry = {
    id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message: errorObj.message,
    stack: errorObj.stack,
    context,
    hash: errorHash,
    count: 1,
  };

  // Log to console as well
  const consoleMethod =
    level === ErrorLevel.CRITICAL || level === ErrorLevel.ERROR
      ? console.error
      : level === ErrorLevel.WARNING
        ? console.warn
        : console.log;

  consoleMethod(`[ErrorLogger] [${level.toUpperCase()}] [${category}]`, errorObj.message, context);

  // Get existing errors
  const errors = getErrorLog();

  // Check for duplicate if dedupe is enabled
  if (dedupe) {
    const existingIndex = errors.findIndex((e) => e.hash === errorHash);
    if (existingIndex !== -1) {
      const existingEntry = errors[existingIndex];
      // Update existing entry count and timestamp
      existingEntry.count += 1;
      existingEntry.lastOccurrence = errorEntry.timestamp;
      saveErrorLog(errors);
      return existingEntry;
    }
  }

  // Add new error at the beginning
  errors.unshift(errorEntry);

  // Trim to max size
  const trimmedErrors = errors.slice(0, MAX_ERRORS);
  saveErrorLog(trimmedErrors);

  return errorEntry;
}

/**
 * Log a node error
 */
export function logNodeError(
  error: Error | string,
  nodeId: string,
  nodeType: string,
  additionalContext: ErrorContext = {}
): ErrorEntry {
  return logError(error, {
    level: ErrorLevel.ERROR,
    category: ErrorCategory.NODE,
    context: {
      nodeId,
      nodeType,
      ...additionalContext,
    },
  });
}

/**
 * Log a workflow error
 */
export function logWorkflowError(
  error: Error | string,
  workflowId: string,
  additionalContext: ErrorContext = {}
): ErrorEntry {
  return logError(error, {
    level: ErrorLevel.ERROR,
    category: ErrorCategory.WORKFLOW,
    context: {
      workflowId,
      ...additionalContext,
    },
  });
}

/**
 * Log an API error
 */
export function logApiError(
  error: Error | string,
  endpoint: string,
  additionalContext: ErrorContext = {}
): ErrorEntry {
  return logError(error, {
    level: ErrorLevel.ERROR,
    category: ErrorCategory.API,
    context: {
      endpoint,
      ...additionalContext,
    },
  });
}

/**
 * Clear all logged errors
 */
export function clearErrorLog(): void {
  try {
    localStorage.removeItem(ERROR_LOG_KEY);
    console.log('[ErrorLogger] Error log cleared');
  } catch (e) {
    console.warn('[ErrorLogger] Failed to clear error log:', e);
  }
}

/**
 * Get error statistics
 */
export function getErrorStats(): ErrorStats {
  const errors = getErrorLog();

  const stats: ErrorStats = {
    total: errors.length,
    byLevel: {},
    byCategory: {},
    last24h: 0,
    lastHour: 0,
  };

  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;

  errors.forEach((error) => {
    // Count by level
    stats.byLevel[error.level] = (stats.byLevel[error.level] || 0) + error.count;

    // Count by category
    stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + error.count;

    // Count recent errors
    const errorTime = new Date(error.timestamp).getTime();
    if (errorTime > dayAgo) stats.last24h += error.count;
    if (errorTime > hourAgo) stats.lastHour += error.count;
  });

  return stats;
}

/**
 * Export error log as JSON string
 */
export function exportErrorLog(): string {
  const errors = getErrorLog();
  const stats = getErrorStats();

  const exportData: ErrorLogExport = {
    exportedAt: new Date().toISOString(),
    stats,
    errors,
  };

  return JSON.stringify(exportData, null, 2);
}

// Set up global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logError(event.error || event.message, {
      level: ErrorLevel.ERROR,
      category: ErrorCategory.UNKNOWN,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason || 'Unhandled Promise rejection', {
      level: ErrorLevel.ERROR,
      category: ErrorCategory.UNKNOWN,
      context: {
        type: 'unhandledrejection',
      },
    });
  });
}
