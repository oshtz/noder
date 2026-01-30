/**
 * Tests for errorLogger utility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  logError,
  logNodeError,
  logWorkflowError,
  logApiError,
  getErrorLog,
  clearErrorLog,
  getErrorStats,
  exportErrorLog,
  ErrorLevel,
  ErrorCategory,
} from './errorLogger';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('errorLogger', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Silence console output during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ErrorLevel', () => {
    it('has correct level values', () => {
      expect(ErrorLevel.DEBUG).toBe('debug');
      expect(ErrorLevel.INFO).toBe('info');
      expect(ErrorLevel.WARNING).toBe('warning');
      expect(ErrorLevel.ERROR).toBe('error');
      expect(ErrorLevel.CRITICAL).toBe('critical');
    });
  });

  describe('ErrorCategory', () => {
    it('has correct category values', () => {
      expect(ErrorCategory.NODE).toBe('node');
      expect(ErrorCategory.WORKFLOW).toBe('workflow');
      expect(ErrorCategory.API).toBe('api');
      expect(ErrorCategory.UI).toBe('ui');
      expect(ErrorCategory.PERSISTENCE).toBe('persistence');
      expect(ErrorCategory.NETWORK).toBe('network');
      expect(ErrorCategory.UNKNOWN).toBe('unknown');
    });
  });

  describe('logError', () => {
    it('logs an error with default options', () => {
      const error = new Error('Test error');
      const entry = logError(error);

      expect(entry).toBeDefined();
      expect(entry.message).toBe('Test error');
      expect(entry.level).toBe(ErrorLevel.ERROR);
      expect(entry.category).toBe(ErrorCategory.UNKNOWN);
      expect(entry.count).toBe(1);
      expect(entry.id).toMatch(/^error-/);
      expect(entry.timestamp).toBeDefined();
    });

    it('logs a string as an error', () => {
      const entry = logError('String error message');

      expect(entry.message).toBe('String error message');
    });

    it('logs with custom level and category', () => {
      const error = new Error('Warning message');
      const entry = logError(error, {
        level: ErrorLevel.WARNING,
        category: ErrorCategory.UI,
      });

      expect(entry.level).toBe(ErrorLevel.WARNING);
      expect(entry.category).toBe(ErrorCategory.UI);
    });

    it('logs with context information', () => {
      const error = new Error('Context error');
      const entry = logError(error, {
        context: {
          nodeId: 'node-123',
          nodeType: 'image',
        },
      });

      expect(entry.context.nodeId).toBe('node-123');
      expect(entry.context.nodeType).toBe('image');
    });

    it('deduplicates errors by default', () => {
      const error = new Error('Duplicate error');

      const entry1 = logError(error);
      const entry2 = logError(error);

      expect(entry1.id).toBe(entry2.id);
      expect(entry2.count).toBe(2);
      expect(entry2.lastOccurrence).toBeDefined();
    });

    it('does not deduplicate when dedupe is false', () => {
      const error = new Error('No dedupe error');

      const entry1 = logError(error, { dedupe: false });
      const entry2 = logError(error, { dedupe: false });

      expect(entry1.id).not.toBe(entry2.id);
    });

    it('stores errors in localStorage', () => {
      const error = new Error('Storage test');
      logError(error);

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const errors = getErrorLog();
      expect(errors.length).toBe(1);
    });
  });

  describe('logNodeError', () => {
    it('logs a node error with correct category and context', () => {
      const error = new Error('Node failed');
      const entry = logNodeError(error, 'node-123', 'image');

      expect(entry.category).toBe(ErrorCategory.NODE);
      expect(entry.context.nodeId).toBe('node-123');
      expect(entry.context.nodeType).toBe('image');
    });

    it('merges additional context', () => {
      const entry = logNodeError('Node error', 'node-456', 'text', {
        workflowId: 'workflow-789',
      });

      expect(entry.context.nodeId).toBe('node-456');
      expect(entry.context.workflowId).toBe('workflow-789');
    });
  });

  describe('logWorkflowError', () => {
    it('logs a workflow error with correct category and context', () => {
      const error = new Error('Workflow failed');
      const entry = logWorkflowError(error, 'workflow-123');

      expect(entry.category).toBe(ErrorCategory.WORKFLOW);
      expect(entry.context.workflowId).toBe('workflow-123');
    });

    it('accepts string error message', () => {
      const entry = logWorkflowError('Workflow execution failed', 'workflow-456');

      expect(entry.message).toBe('Workflow execution failed');
    });
  });

  describe('logApiError', () => {
    it('logs an API error with correct category and context', () => {
      const error = new Error('API request failed');
      const entry = logApiError(error, '/api/replicate');

      expect(entry.category).toBe(ErrorCategory.API);
      expect(entry.context.endpoint).toBe('/api/replicate');
    });

    it('includes additional API context', () => {
      const entry = logApiError('Rate limited', '/api/openrouter', {
        statusCode: 429,
      });

      expect(entry.context.endpoint).toBe('/api/openrouter');
      expect(entry.context.statusCode).toBe(429);
    });
  });

  describe('getErrorLog', () => {
    it('returns empty array when no errors logged', () => {
      const errors = getErrorLog();
      expect(errors).toEqual([]);
    });

    it('returns logged errors', () => {
      logError('Error 1');
      logError('Error 2');
      logError('Error 3');

      const errors = getErrorLog();
      expect(errors.length).toBe(3);
    });

    it('handles invalid JSON in localStorage', () => {
      localStorageMock.store['noder-error-log'] = 'invalid json';

      const errors = getErrorLog();
      expect(errors).toEqual([]);
    });
  });

  describe('clearErrorLog', () => {
    it('removes all errors from localStorage', () => {
      logError('Error 1');
      logError('Error 2');

      clearErrorLog();

      const errors = getErrorLog();
      expect(errors).toEqual([]);
    });
  });

  describe('getErrorStats', () => {
    it('returns correct stats for empty log', () => {
      const stats = getErrorStats();

      expect(stats.total).toBe(0);
      expect(stats.byLevel).toEqual({});
      expect(stats.byCategory).toEqual({});
      expect(stats.last24h).toBe(0);
      expect(stats.lastHour).toBe(0);
    });

    it('counts errors by level', () => {
      logError('Error 1', { level: ErrorLevel.ERROR });
      logError('Warning 1', { level: ErrorLevel.WARNING });
      logError('Error 2', { level: ErrorLevel.ERROR, dedupe: false });

      const stats = getErrorStats();

      expect(stats.byLevel[ErrorLevel.ERROR]).toBe(2);
      expect(stats.byLevel[ErrorLevel.WARNING]).toBe(1);
    });

    it('counts errors by category', () => {
      logError('Node error', { category: ErrorCategory.NODE });
      logError('API error 1', { category: ErrorCategory.API });
      logError('API error 2', { category: ErrorCategory.API, dedupe: false });

      const stats = getErrorStats();

      expect(stats.byCategory[ErrorCategory.NODE]).toBe(1);
      expect(stats.byCategory[ErrorCategory.API]).toBe(2);
    });

    it('counts recent errors', () => {
      logError('Recent error');

      const stats = getErrorStats();

      expect(stats.last24h).toBe(1);
      expect(stats.lastHour).toBe(1);
    });
  });

  describe('exportErrorLog', () => {
    it('exports errors as JSON string', () => {
      logError('Export test error');

      const exported = exportErrorLog();
      const parsed = JSON.parse(exported);

      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.stats).toBeDefined();
      expect(parsed.errors).toBeDefined();
      expect(parsed.errors.length).toBe(1);
    });

    it('includes stats in export', () => {
      logError('Error 1', { category: ErrorCategory.API });
      logError('Error 2', { category: ErrorCategory.NODE });

      const exported = exportErrorLog();
      const parsed = JSON.parse(exported);

      expect(parsed.stats.total).toBe(2);
    });
  });

  describe('error trimming', () => {
    it('trims old errors when exceeding MAX_ERRORS', () => {
      // Log 105 unique errors (MAX_ERRORS is 100)
      for (let i = 0; i < 105; i++) {
        logError(`Error ${i}`, { dedupe: false });
      }

      const errors = getErrorLog();
      expect(errors.length).toBe(100);
    });
  });

  describe('console logging', () => {
    it('logs errors to console.error for ERROR level', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      logError('Test error', { level: ErrorLevel.ERROR });

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('logs warnings to console.warn for WARNING level', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      logError('Test warning', { level: ErrorLevel.WARNING });

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('logs info to console.log for INFO level', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logError('Test info', { level: ErrorLevel.INFO });

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
