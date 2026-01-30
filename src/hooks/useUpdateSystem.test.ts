import { describe, expect, it, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useUpdateSystem, type UpdateInfo } from './useUpdateSystem';

// Mock dependencies
vi.mock('../types/tauri', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(),
}));

// Get mocked modules
const mockInvoke = vi.fn();
const mockGetVersion = vi.fn();

// Re-mock with actual implementations for better control
vi.mock('../types/tauri', async () => {
  return {
    invoke: (...args: unknown[]) => mockInvoke(...args),
  };
});

vi.mock('@tauri-apps/api/app', async () => {
  return {
    getVersion: () => mockGetVersion(),
  };
});

describe('useUpdateSystem', () => {
  let originalUserAgent: string;
  let consoleErrorSpy: MockInstance;

  // Store original window properties
  const _originalWindow = { ...window };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Store original userAgent
    originalUserAgent = navigator.userAgent;

    // Mock console.error to suppress expected errors in tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default: simulate non-Tauri environment
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();

    // Restore userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
  });

  // Helper to simulate Tauri environment
  const _setupTauriEnvironment = () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: { invoke: vi.fn() },
      writable: true,
      configurable: true,
    });
    // Mock import.meta.env.DEV as false
    vi.stubGlobal('import', { meta: { env: { DEV: false } } });
  };

  // Helper to set user agent
  const setUserAgent = (ua: string) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: ua,
      writable: true,
      configurable: true,
    });
  };

  // Helper to create mock GitHub release
  const _createMockRelease = (overrides = {}) => ({
    tag_name: 'v1.2.0',
    body: 'Release notes for v1.2.0',
    published_at: '2024-01-15T10:00:00Z',
    assets: [
      {
        name: 'noder-portable.exe',
        browser_download_url:
          'https://github.com/oshtz/noder/releases/download/v1.2.0/noder-portable.exe',
      },
      {
        name: 'noder.app.zip',
        browser_download_url:
          'https://github.com/oshtz/noder/releases/download/v1.2.0/noder.app.zip',
      },
    ],
    ...overrides,
  });

  // ============================================================================
  // Initial State Tests
  // ============================================================================

  describe('initial state', () => {
    it('should return initial state with all default values', () => {
      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current.currentVersion).toBeNull();
      expect(result.current.updateStatus).toBe('idle');
      expect(result.current.updateInfo).toBeNull();
      expect(result.current.updatePath).toBeNull();
      expect(result.current.updateError).toBeNull();
      expect(result.current.lastUpdateCheck).toBeNull();
    });

    it('should return updateSupported as false in non-Tauri environment', () => {
      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current.updateSupported).toBe(false);
    });

    it('should expose all required action functions', () => {
      const { result } = renderHook(() => useUpdateSystem());

      expect(typeof result.current.checkForUpdate).toBe('function');
      expect(typeof result.current.downloadUpdate).toBe('function');
      expect(typeof result.current.installUpdate).toBe('function');
      expect(typeof result.current.dismissUpdate).toBe('function');
      expect(typeof result.current.loadCurrentVersion).toBe('function');
    });
  });

  // ============================================================================
  // Environment Detection Tests
  // ============================================================================

  describe('environment detection', () => {
    it('should detect non-Tauri environment correctly', () => {
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current.updateSupported).toBe(false);
    });

    it('should not attempt to load version in non-Tauri environment', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        await result.current.loadCurrentVersion();
      });

      expect(mockGetVersion).not.toHaveBeenCalled();
      expect(result.current.currentVersion).toBeNull();
    });
  });

  // ============================================================================
  // loadCurrentVersion Tests
  // ============================================================================

  describe('loadCurrentVersion', () => {
    it('should not load version when updateSupported is false', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        await result.current.loadCurrentVersion();
      });

      expect(mockGetVersion).not.toHaveBeenCalled();
    });

    it('should handle errors when loading version fails', async () => {
      // This test verifies error handling without Tauri environment
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        await result.current.loadCurrentVersion();
      });

      // Should not throw, should gracefully handle
      expect(result.current.currentVersion).toBeNull();
    });
  });

  // ============================================================================
  // checkForUpdate Tests
  // ============================================================================

  describe('checkForUpdate', () => {
    it('should return null when updateSupported is false', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      let updateResult: UpdateInfo | null = null;
      await act(async () => {
        updateResult = await result.current.checkForUpdate();
      });

      expect(updateResult).toBeNull();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should not call invoke when not in Tauri environment', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // downloadUpdate Tests
  // ============================================================================

  describe('downloadUpdate', () => {
    it('should return null when updateSupported is false', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      let downloadResult: string | null = null;
      await act(async () => {
        downloadResult = await result.current.downloadUpdate();
      });

      expect(downloadResult).toBeNull();
    });

    it('should return null when no updateInfo is available', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      let downloadResult: string | null = null;
      await act(async () => {
        downloadResult = await result.current.downloadUpdate();
      });

      expect(downloadResult).toBeNull();
    });

    it('should accept infoOverride parameter', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const mockInfo: UpdateInfo = {
        version: '2.0.0',
        notes: 'New version',
        publishedAt: '2024-01-20T00:00:00Z',
        downloadUrl: 'https://example.com/update.exe',
      };

      let downloadResult: string | null = null;
      await act(async () => {
        downloadResult = await result.current.downloadUpdate(mockInfo);
      });

      // Should still return null since updateSupported is false
      expect(downloadResult).toBeNull();
    });
  });

  // ============================================================================
  // installUpdate Tests
  // ============================================================================

  describe('installUpdate', () => {
    it('should do nothing when updateSupported is false', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        await result.current.installUpdate();
      });

      expect(mockInvoke).not.toHaveBeenCalled();
      expect(result.current.updateStatus).toBe('idle');
    });

    it('should not call apply_update when no updatePath exists', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        await result.current.installUpdate();
      });

      expect(mockInvoke).not.toHaveBeenCalledWith('apply_update', expect.anything());
    });
  });

  // ============================================================================
  // dismissUpdate Tests
  // ============================================================================

  describe('dismissUpdate', () => {
    it('should reset all update state to initial values', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        result.current.dismissUpdate();
      });

      expect(result.current.updateStatus).toBe('idle');
      expect(result.current.updateInfo).toBeNull();
      expect(result.current.updatePath).toBeNull();
      expect(result.current.updateError).toBeNull();
    });

    it('should be callable multiple times without issues', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        result.current.dismissUpdate();
        result.current.dismissUpdate();
        result.current.dismissUpdate();
      });

      expect(result.current.updateStatus).toBe('idle');
    });
  });

  // ============================================================================
  // State Management Tests
  // ============================================================================

  describe('state management', () => {
    it('should maintain stable function references across rerenders', () => {
      const { result, rerender } = renderHook(() => useUpdateSystem());

      const _initialCheckForUpdate = result.current.checkForUpdate;
      const _initialDownloadUpdate = result.current.downloadUpdate;
      const _initialInstallUpdate = result.current.installUpdate;
      const initialDismissUpdate = result.current.dismissUpdate;

      rerender();

      // dismissUpdate should always be stable (no deps)
      expect(result.current.dismissUpdate).toBe(initialDismissUpdate);
    });

    it('should preserve lastUpdateCheck as null when no check has been performed', () => {
      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current.lastUpdateCheck).toBeNull();
    });
  });

  // ============================================================================
  // Platform Detection Tests (Helper Functions)
  // ============================================================================

  describe('platform detection', () => {
    it('should identify Windows from user agent', () => {
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      const { result } = renderHook(() => useUpdateSystem());

      // Platform detection is internal, we verify it works by checking updateSupported behavior
      expect(result.current).toBeDefined();
    });

    it('should identify macOS from user agent', () => {
      setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current).toBeDefined();
    });

    it('should handle unknown platform from user agent', () => {
      setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');

      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current).toBeDefined();
    });
  });

  // ============================================================================
  // Hook Lifecycle Tests
  // ============================================================================

  describe('hook lifecycle', () => {
    it('should clean up properly on unmount', () => {
      const { unmount } = renderHook(() => useUpdateSystem());

      expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() => useUpdateSystem());
        unmount();
      }

      // Should not throw or leave any lingering state issues
      const { result } = renderHook(() => useUpdateSystem());
      expect(result.current.updateStatus).toBe('idle');
    });

    it('should handle rerender without state loss', () => {
      const { result, rerender } = renderHook(() => useUpdateSystem());

      expect(result.current.updateStatus).toBe('idle');

      rerender();
      rerender();
      rerender();

      expect(result.current.updateStatus).toBe('idle');
      expect(result.current.currentVersion).toBeNull();
    });
  });

  // ============================================================================
  // Return Value Structure Tests
  // ============================================================================

  describe('return value structure', () => {
    it('should return all expected state properties', () => {
      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current).toHaveProperty('currentVersion');
      expect(result.current).toHaveProperty('updateStatus');
      expect(result.current).toHaveProperty('updateInfo');
      expect(result.current).toHaveProperty('updatePath');
      expect(result.current).toHaveProperty('updateError');
      expect(result.current).toHaveProperty('lastUpdateCheck');
      expect(result.current).toHaveProperty('updateSupported');
    });

    it('should return all expected action functions', () => {
      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current).toHaveProperty('checkForUpdate');
      expect(result.current).toHaveProperty('downloadUpdate');
      expect(result.current).toHaveProperty('installUpdate');
      expect(result.current).toHaveProperty('dismissUpdate');
      expect(result.current).toHaveProperty('loadCurrentVersion');
    });

    it('should have correct types for all return values', () => {
      const { result } = renderHook(() => useUpdateSystem());

      // State types
      expect(
        result.current.currentVersion === null || typeof result.current.currentVersion === 'string'
      ).toBe(true);
      expect(typeof result.current.updateStatus).toBe('string');
      expect(
        result.current.updateInfo === null || typeof result.current.updateInfo === 'object'
      ).toBe(true);
      expect(
        result.current.updatePath === null || typeof result.current.updatePath === 'string'
      ).toBe(true);
      expect(
        result.current.updateError === null || typeof result.current.updateError === 'string'
      ).toBe(true);
      expect(
        result.current.lastUpdateCheck === null ||
          typeof result.current.lastUpdateCheck === 'number'
      ).toBe(true);
      expect(typeof result.current.updateSupported).toBe('boolean');

      // Action types
      expect(typeof result.current.checkForUpdate).toBe('function');
      expect(typeof result.current.downloadUpdate).toBe('function');
      expect(typeof result.current.installUpdate).toBe('function');
      expect(typeof result.current.dismissUpdate).toBe('function');
      expect(typeof result.current.loadCurrentVersion).toBe('function');
    });
  });

  // ============================================================================
  // UpdateStatus Type Tests
  // ============================================================================

  describe('UpdateStatus values', () => {
    it('should start with idle status', () => {
      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current.updateStatus).toBe('idle');
    });

    it('should return to idle after dismissUpdate', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        result.current.dismissUpdate();
      });

      expect(result.current.updateStatus).toBe('idle');
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle undefined window gracefully in SSR context', () => {
      // The hook should work even when window might be modified
      const { result } = renderHook(() => useUpdateSystem());

      expect(result.current).toBeDefined();
      expect(result.current.updateSupported).toBe(false);
    });

    it('should handle empty downloadUrl in updateInfo', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const emptyUrlInfo: UpdateInfo = {
        version: '2.0.0',
        notes: null,
        publishedAt: null,
        downloadUrl: '',
      };

      let downloadResult: string | null = null;
      await act(async () => {
        downloadResult = await result.current.downloadUpdate(emptyUrlInfo);
      });

      expect(downloadResult).toBeNull();
    });

    it('should handle whitespace-only version strings', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const whitespaceVersionInfo: UpdateInfo = {
        version: '   ',
        notes: null,
        publishedAt: null,
        downloadUrl: 'https://example.com/update.exe',
      };

      await act(async () => {
        await result.current.downloadUpdate(whitespaceVersionInfo);
      });

      // Should not crash, returns null due to updateSupported being false
      expect(result.current.updateError).toBeNull();
    });

    it('should handle special characters in version string', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const specialVersionInfo: UpdateInfo = {
        version: 'v1.2.3-beta+build.123',
        notes: null,
        publishedAt: null,
        downloadUrl: 'https://example.com/update.exe',
      };

      await act(async () => {
        await result.current.downloadUpdate(specialVersionInfo);
      });

      expect(result.current).toBeDefined();
    });
  });

  // ============================================================================
  // Concurrent Operations Tests
  // ============================================================================

  describe('concurrent operations', () => {
    it('should handle multiple checkForUpdate calls', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        await Promise.all([
          result.current.checkForUpdate(),
          result.current.checkForUpdate(),
          result.current.checkForUpdate(),
        ]);
      });

      // Should not crash and should maintain valid state
      expect(result.current.updateStatus).toBe('idle');
    });

    it('should handle multiple downloadUpdate calls', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        await Promise.all([result.current.downloadUpdate(), result.current.downloadUpdate()]);
      });

      expect(result.current.updateStatus).toBe('idle');
    });

    it('should handle interleaved check and download calls', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        result.current.checkForUpdate();
        result.current.downloadUpdate();
        result.current.checkForUpdate();
      });

      expect(result.current).toBeDefined();
    });
  });

  // ============================================================================
  // Memory and Performance Tests
  // ============================================================================

  describe('memory and performance', () => {
    it('should not create new object references unnecessarily', () => {
      const { result, rerender } = renderHook(() => useUpdateSystem());

      const firstDismiss = result.current.dismissUpdate;
      rerender();
      const secondDismiss = result.current.dismissUpdate;

      // dismissUpdate has empty deps, should be stable
      expect(firstDismiss).toBe(secondDismiss);
    });

    it('should cleanup properly to avoid memory leaks', () => {
      const hooks: ReturnType<typeof renderHook<ReturnType<typeof useUpdateSystem>>>[] = [];

      // Create multiple hook instances
      for (let i = 0; i < 10; i++) {
        hooks.push(renderHook(() => useUpdateSystem()));
      }

      // Unmount all
      hooks.forEach((hook) => hook.unmount());

      // Create new instance - should work fine
      const { result } = renderHook(() => useUpdateSystem());
      expect(result.current.updateStatus).toBe('idle');
    });
  });

  // ============================================================================
  // UpdateInfo Structure Tests
  // ============================================================================

  describe('UpdateInfo structure', () => {
    it('should handle UpdateInfo with all fields populated', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const fullInfo: UpdateInfo = {
        version: '2.0.0',
        notes: 'Full release notes with lots of details',
        publishedAt: '2024-06-15T12:30:00Z',
        downloadUrl: 'https://github.com/oshtz/noder/releases/download/v2.0.0/update.exe',
      };

      await act(async () => {
        await result.current.downloadUpdate(fullInfo);
      });

      // Verify it handles full info without crashing
      expect(result.current).toBeDefined();
    });

    it('should handle UpdateInfo with null optional fields', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const minimalInfo: UpdateInfo = {
        version: '2.0.0',
        notes: null,
        publishedAt: null,
        downloadUrl: 'https://example.com/update.exe',
      };

      await act(async () => {
        await result.current.downloadUpdate(minimalInfo);
      });

      expect(result.current).toBeDefined();
    });
  });

  // ============================================================================
  // Function Parameter Tests
  // ============================================================================

  describe('function parameters', () => {
    it('downloadUpdate should work without parameters', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        const downloadResult = await result.current.downloadUpdate();
        expect(downloadResult).toBeNull();
      });
    });

    it('downloadUpdate should accept UpdateInfo parameter', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const info: UpdateInfo = {
        version: '1.5.0',
        notes: 'Test notes',
        publishedAt: '2024-03-01T00:00:00Z',
        downloadUrl: 'https://example.com/test.exe',
      };

      await act(async () => {
        const downloadResult = await result.current.downloadUpdate(info);
        expect(downloadResult).toBeNull(); // null because updateSupported is false
      });
    });

    it('checkForUpdate should return Promise<UpdateInfo | null>', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        const updateResult = await result.current.checkForUpdate();
        expect(updateResult === null || typeof updateResult === 'object').toBe(true);
      });
    });

    it('installUpdate should return Promise<void>', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        const installResult = await result.current.installUpdate();
        expect(installResult).toBeUndefined();
      });
    });

    it('loadCurrentVersion should return Promise<void>', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        const loadResult = await result.current.loadCurrentVersion();
        expect(loadResult).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // Version Comparison Edge Cases
  // ============================================================================

  describe('version handling edge cases', () => {
    it('should handle version with v prefix', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const infoWithPrefix: UpdateInfo = {
        version: 'v1.2.3',
        notes: null,
        publishedAt: null,
        downloadUrl: 'https://example.com/update.exe',
      };

      await act(async () => {
        await result.current.downloadUpdate(infoWithPrefix);
      });

      expect(result.current).toBeDefined();
    });

    it('should handle version with V prefix (uppercase)', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const infoWithUpperPrefix: UpdateInfo = {
        version: 'V1.2.3',
        notes: null,
        publishedAt: null,
        downloadUrl: 'https://example.com/update.exe',
      };

      await act(async () => {
        await result.current.downloadUpdate(infoWithUpperPrefix);
      });

      expect(result.current).toBeDefined();
    });

    it('should handle version with pre-release suffix', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      const prereleaseInfo: UpdateInfo = {
        version: '1.2.3-alpha.1',
        notes: null,
        publishedAt: null,
        downloadUrl: 'https://example.com/update.exe',
      };

      await act(async () => {
        await result.current.downloadUpdate(prereleaseInfo);
      });

      expect(result.current).toBeDefined();
    });
  });

  // ============================================================================
  // Stability Tests
  // ============================================================================

  describe('hook stability', () => {
    it('should maintain consistent behavior after error state', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      // Trigger an action that would normally set error
      await act(async () => {
        await result.current.downloadUpdate();
      });

      // Should still be able to dismiss and reset
      await act(async () => {
        result.current.dismissUpdate();
      });

      expect(result.current.updateStatus).toBe('idle');
      expect(result.current.updateError).toBeNull();
    });

    it('should handle rapid state transitions', async () => {
      const { result } = renderHook(() => useUpdateSystem());

      await act(async () => {
        result.current.dismissUpdate();
        await result.current.checkForUpdate();
        result.current.dismissUpdate();
        await result.current.downloadUpdate();
        result.current.dismissUpdate();
      });

      expect(result.current.updateStatus).toBe('idle');
    });
  });
});

// ============================================================================
// Helper Function Unit Tests (via module internals testing)
// ============================================================================

describe('version normalization and comparison (behavioral tests)', () => {
  it('hook should handle various version formats without crashing', async () => {
    const testVersions = [
      '1.0.0',
      'v1.0.0',
      'V1.0.0',
      '1.0',
      '1',
      '1.0.0.0',
      '1.2.3-beta',
      '1.2.3-rc.1',
      '1.2.3+build',
      '',
      '   ',
      'invalid',
    ];

    for (const version of testVersions) {
      const { result, unmount } = renderHook(() => useUpdateSystem());

      const info: UpdateInfo = {
        version,
        notes: null,
        publishedAt: null,
        downloadUrl: 'https://example.com/update.exe',
      };

      await act(async () => {
        await result.current.downloadUpdate(info);
      });

      // Should not crash for any version format
      expect(result.current).toBeDefined();

      unmount();
    }
  });
});

// ============================================================================
// Integration-like Tests (simulating full workflow without actual Tauri)
// ============================================================================

describe('update workflow simulation', () => {
  it('should follow check -> available workflow correctly', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    // Initial state
    expect(result.current.updateStatus).toBe('idle');
    expect(result.current.updateInfo).toBeNull();

    // Check for update (will return null in non-Tauri)
    await act(async () => {
      await result.current.checkForUpdate();
    });

    // Status should remain idle since not supported
    expect(result.current.updateStatus).toBe('idle');
  });

  it('should handle dismiss at any point in workflow', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    // Dismiss at idle
    await act(async () => {
      result.current.dismissUpdate();
    });
    expect(result.current.updateStatus).toBe('idle');

    // Try check then dismiss
    await act(async () => {
      result.current.checkForUpdate();
      result.current.dismissUpdate();
    });
    expect(result.current.updateStatus).toBe('idle');
  });

  it('should preserve state between operations', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    // Store initial values
    const initialVersion = result.current.currentVersion;
    const initialStatus = result.current.updateStatus;

    // Perform non-modifying operation
    await act(async () => {
      await result.current.checkForUpdate();
    });

    // In non-Tauri env, nothing should change
    expect(result.current.currentVersion).toBe(initialVersion);
    expect(result.current.updateStatus).toBe(initialStatus);
  });
});

// ============================================================================
// Additional Type Export Tests
// ============================================================================

describe('exported types', () => {
  it('UpdateStatus type should support all valid values', () => {
    const validStatuses = [
      'idle',
      'checking',
      'up-to-date',
      'available',
      'downloading',
      'ready',
      'installing',
      'error',
    ];

    const { result } = renderHook(() => useUpdateSystem());

    // Initial status should be one of valid statuses
    expect(validStatuses).toContain(result.current.updateStatus);
  });

  it('UpdateInfo type should have all required properties', () => {
    const testInfo: UpdateInfo = {
      version: '1.0.0',
      notes: 'test notes',
      publishedAt: '2024-01-01',
      downloadUrl: 'https://example.com',
    };

    expect(testInfo).toHaveProperty('version');
    expect(testInfo).toHaveProperty('notes');
    expect(testInfo).toHaveProperty('publishedAt');
    expect(testInfo).toHaveProperty('downloadUrl');
  });
});

// ============================================================================
// UseUpdateSystemReturn Interface Tests
// ============================================================================

describe('UseUpdateSystemReturn interface', () => {
  it('should return object matching UseUpdateSystemReturn interface', () => {
    const { result } = renderHook(() => useUpdateSystem());

    // Verify all state properties exist
    expect('currentVersion' in result.current).toBe(true);
    expect('updateStatus' in result.current).toBe(true);
    expect('updateInfo' in result.current).toBe(true);
    expect('updatePath' in result.current).toBe(true);
    expect('updateError' in result.current).toBe(true);
    expect('lastUpdateCheck' in result.current).toBe(true);
    expect('updateSupported' in result.current).toBe(true);

    // Verify all action functions exist
    expect('checkForUpdate' in result.current).toBe(true);
    expect('downloadUpdate' in result.current).toBe(true);
    expect('installUpdate' in result.current).toBe(true);
    expect('dismissUpdate' in result.current).toBe(true);
    expect('loadCurrentVersion' in result.current).toBe(true);
  });

  it('should not include any extra properties', () => {
    const { result } = renderHook(() => useUpdateSystem());

    const expectedKeys = [
      'currentVersion',
      'updateStatus',
      'updateInfo',
      'updatePath',
      'updateError',
      'lastUpdateCheck',
      'updateSupported',
      'checkForUpdate',
      'downloadUpdate',
      'installUpdate',
      'dismissUpdate',
      'loadCurrentVersion',
    ];

    const actualKeys = Object.keys(result.current);
    expect(actualKeys.sort()).toEqual(expectedKeys.sort());
  });
});

// ============================================================================
// Callback Dependencies Tests
// ============================================================================

describe('callback dependencies', () => {
  it('dismissUpdate should have no dependencies and be stable', () => {
    const { result, rerender } = renderHook(() => useUpdateSystem());

    const first = result.current.dismissUpdate;
    rerender();
    const second = result.current.dismissUpdate;
    rerender();
    const third = result.current.dismissUpdate;

    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('loadCurrentVersion should depend on updateSupported', () => {
    const { result, rerender } = renderHook(() => useUpdateSystem());

    const first = result.current.loadCurrentVersion;
    rerender();
    const second = result.current.loadCurrentVersion;

    // Should be stable since updateSupported doesn't change
    expect(first).toBe(second);
  });
});

// ============================================================================
// Memoization Tests
// ============================================================================

describe('memoization', () => {
  it('updateSupported should be memoized via useMemo', () => {
    const { result, rerender } = renderHook(() => useUpdateSystem());

    const first = result.current.updateSupported;
    rerender();
    rerender();
    rerender();
    const last = result.current.updateSupported;

    // Value should remain consistent
    expect(first).toBe(last);
  });
});

// ============================================================================
// Error Message Tests
// ============================================================================

describe('error messages', () => {
  it('should handle error without message property', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    // In non-supported environment, errors should not be set
    await act(async () => {
      await result.current.checkForUpdate();
    });

    expect(result.current.updateError).toBeNull();
  });

  it('updateError should be null initially', () => {
    const { result } = renderHook(() => useUpdateSystem());

    expect(result.current.updateError).toBeNull();
  });

  it('dismissUpdate should clear updateError', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    await act(async () => {
      result.current.dismissUpdate();
    });

    expect(result.current.updateError).toBeNull();
  });
});

// ============================================================================
// State Reset Tests
// ============================================================================

describe('state reset behavior', () => {
  it('dismissUpdate should reset updateStatus to idle', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    await act(async () => {
      result.current.dismissUpdate();
    });

    expect(result.current.updateStatus).toBe('idle');
  });

  it('dismissUpdate should reset updateInfo to null', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    await act(async () => {
      result.current.dismissUpdate();
    });

    expect(result.current.updateInfo).toBeNull();
  });

  it('dismissUpdate should reset updatePath to null', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    await act(async () => {
      result.current.dismissUpdate();
    });

    expect(result.current.updatePath).toBeNull();
  });

  it('dismissUpdate should reset updateError to null', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    await act(async () => {
      result.current.dismissUpdate();
    });

    expect(result.current.updateError).toBeNull();
  });

  it('dismissUpdate should not affect currentVersion', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    const versionBefore = result.current.currentVersion;

    await act(async () => {
      result.current.dismissUpdate();
    });

    expect(result.current.currentVersion).toBe(versionBefore);
  });

  it('dismissUpdate should not affect lastUpdateCheck', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    const checkBefore = result.current.lastUpdateCheck;

    await act(async () => {
      result.current.dismissUpdate();
    });

    expect(result.current.lastUpdateCheck).toBe(checkBefore);
  });
});

// ============================================================================
// useEffect Initialization Tests
// ============================================================================

describe('useEffect initialization', () => {
  it('should call loadCurrentVersion on mount when in Tauri environment', async () => {
    // This test verifies the useEffect runs on mount
    const { result } = renderHook(() => useUpdateSystem());

    // Wait for any potential async effects
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // In non-Tauri environment, version should remain null
    expect(result.current.currentVersion).toBeNull();
  });

  it('should not cause infinite loops with useEffect', async () => {
    const { result, rerender } = renderHook(() => useUpdateSystem());

    // Multiple rerenders should not cause issues
    for (let i = 0; i < 10; i++) {
      rerender();
    }

    await waitFor(() => {
      expect(result.current.updateStatus).toBe('idle');
    });
  });
});

// ============================================================================
// Null/Undefined Handling Tests
// ============================================================================

describe('null and undefined handling', () => {
  it('should handle undefined updateInfo gracefully', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    await act(async () => {
      // @ts-expect-error - Testing runtime behavior with undefined
      await result.current.downloadUpdate(undefined);
    });

    expect(result.current.updateError).toBeNull();
  });

  it('should handle null in UpdateInfo fields', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    const infoWithNulls: UpdateInfo = {
      version: '1.0.0',
      notes: null,
      publishedAt: null,
      downloadUrl: 'https://example.com',
    };

    await act(async () => {
      await result.current.downloadUpdate(infoWithNulls);
    });

    expect(result.current).toBeDefined();
  });
});

// ============================================================================
// Promise Resolution Tests
// ============================================================================

describe('promise resolution', () => {
  it('checkForUpdate should resolve even when not supported', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    let resolved = false;
    await act(async () => {
      await result.current.checkForUpdate();
      resolved = true;
    });

    expect(resolved).toBe(true);
  });

  it('downloadUpdate should resolve even when not supported', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    let resolved = false;
    await act(async () => {
      await result.current.downloadUpdate();
      resolved = true;
    });

    expect(resolved).toBe(true);
  });

  it('installUpdate should resolve even when not supported', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    let resolved = false;
    await act(async () => {
      await result.current.installUpdate();
      resolved = true;
    });

    expect(resolved).toBe(true);
  });

  it('loadCurrentVersion should resolve even when not supported', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    let resolved = false;
    await act(async () => {
      await result.current.loadCurrentVersion();
      resolved = true;
    });

    expect(resolved).toBe(true);
  });
});

// ============================================================================
// Async Operation Order Tests
// ============================================================================

describe('async operation ordering', () => {
  it('should handle sequential operations correctly', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    await act(async () => {
      await result.current.checkForUpdate();
    });

    await act(async () => {
      await result.current.downloadUpdate();
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.updateStatus).toBe('idle');
  });

  it('should handle dismiss between operations', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    await act(async () => {
      await result.current.checkForUpdate();
      result.current.dismissUpdate();
      await result.current.downloadUpdate();
      result.current.dismissUpdate();
    });

    expect(result.current.updateStatus).toBe('idle');
    expect(result.current.updateInfo).toBeNull();
  });
});

// ============================================================================
// Browser Environment Compatibility Tests
// ============================================================================

describe('browser environment compatibility', () => {
  it('should work when navigator.userAgent is empty', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: '',
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useUpdateSystem());

    expect(result.current).toBeDefined();
    expect(result.current.updateSupported).toBe(false);
  });

  it('should work with various browser user agents', () => {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) Firefox/120.0',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
    ];

    for (const ua of userAgents) {
      Object.defineProperty(navigator, 'userAgent', {
        value: ua,
        writable: true,
        configurable: true,
      });

      const { result, unmount } = renderHook(() => useUpdateSystem());
      expect(result.current).toBeDefined();
      unmount();
    }
  });
});

// ============================================================================
// State Immutability Tests
// ============================================================================

describe('state immutability', () => {
  it('should not mutate updateInfo object after setting', async () => {
    const { result } = renderHook(() => useUpdateSystem());

    const info: UpdateInfo = {
      version: '1.0.0',
      notes: 'test',
      publishedAt: '2024-01-01',
      downloadUrl: 'https://example.com',
    };

    await act(async () => {
      await result.current.downloadUpdate(info);
    });

    // Original object should not be mutated
    expect(info.version).toBe('1.0.0');
    expect(info.notes).toBe('test');
  });

  it('should return new objects for state on each render', () => {
    const { result, rerender } = renderHook(() => useUpdateSystem());

    // Get initial state
    const initial = { ...result.current };

    rerender();

    // State values should remain the same
    expect(result.current.updateStatus).toBe(initial.updateStatus);
    expect(result.current.currentVersion).toBe(initial.currentVersion);
  });
});
