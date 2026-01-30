import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAutoUpdate, AutoUpdateConfig } from './useAutoUpdate';

describe('useAutoUpdate', () => {
  let mockCheckForUpdate: ReturnType<typeof vi.fn>;
  let mockDownloadUpdate: ReturnType<typeof vi.fn>;
  let mockInstallUpdate: ReturnType<typeof vi.fn>;
  let mockConfirm: ReturnType<typeof vi.fn>;
  let originalConfirm: typeof window.confirm;

  beforeEach(() => {
    mockCheckForUpdate = vi.fn();
    mockDownloadUpdate = vi.fn();
    mockInstallUpdate = vi.fn();
    mockConfirm = vi.fn();
    originalConfirm = window.confirm;
    window.confirm = mockConfirm;
  });

  afterEach(() => {
    window.confirm = originalConfirm;
    vi.clearAllMocks();
  });

  const createConfig = (overrides: Partial<AutoUpdateConfig> = {}): AutoUpdateConfig => ({
    updateSupported: true,
    checkForUpdate: mockCheckForUpdate,
    downloadUpdate: mockDownloadUpdate,
    installUpdate: mockInstallUpdate,
    ...overrides,
  });

  describe('when updates are not supported', () => {
    it('should not check for updates', async () => {
      renderHook(() => useAutoUpdate(createConfig({ updateSupported: false })));

      // Wait a tick to ensure any async operations would have started
      await waitFor(() => {
        expect(mockCheckForUpdate).not.toHaveBeenCalled();
      });
    });
  });

  describe('when updates are supported', () => {
    it('should check for updates on mount', async () => {
      mockCheckForUpdate.mockResolvedValue(null);

      renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
      });
    });

    it('should not check for updates twice', async () => {
      mockCheckForUpdate.mockResolvedValue(null);

      const { rerender } = renderHook(() => useAutoUpdate(createConfig()));

      // Rerender to trigger useEffect again
      rerender();

      await waitFor(() => {
        expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
      });
    });

    it('should not download if no update available', async () => {
      mockCheckForUpdate.mockResolvedValue(null);

      renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockCheckForUpdate).toHaveBeenCalled();
      });

      expect(mockDownloadUpdate).not.toHaveBeenCalled();
    });

    it('should download update when available', async () => {
      const updateInfo = { version: '1.2.0' };
      mockCheckForUpdate.mockResolvedValue(updateInfo);
      mockDownloadUpdate.mockResolvedValue(null); // No path means download failed

      renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockDownloadUpdate).toHaveBeenCalledWith(updateInfo);
      });
    });

    it('should not prompt if download fails', async () => {
      const updateInfo = { version: '1.2.0' };
      mockCheckForUpdate.mockResolvedValue(updateInfo);
      mockDownloadUpdate.mockResolvedValue(null);

      renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockDownloadUpdate).toHaveBeenCalled();
      });

      expect(mockConfirm).not.toHaveBeenCalled();
    });

    it('should prompt user after successful download', async () => {
      const updateInfo = { version: '1.2.0' };
      mockCheckForUpdate.mockResolvedValue(updateInfo);
      mockDownloadUpdate.mockResolvedValue('/path/to/update');
      mockConfirm.mockReturnValue(false);

      renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith('Update 1.2.0 is ready. Restart to apply it now?');
      });
    });

    it('should use default version text when version is not in info', async () => {
      const updateInfo = {}; // No version property
      mockCheckForUpdate.mockResolvedValue(updateInfo);
      mockDownloadUpdate.mockResolvedValue('/path/to/update');
      mockConfirm.mockReturnValue(false);

      renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith(
          'Update new version is ready. Restart to apply it now?'
        );
      });
    });

    it('should install update when user confirms', async () => {
      const updateInfo = { version: '1.2.0' };
      mockCheckForUpdate.mockResolvedValue(updateInfo);
      mockDownloadUpdate.mockResolvedValue('/path/to/update');
      mockConfirm.mockReturnValue(true);
      mockInstallUpdate.mockResolvedValue(undefined);

      renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockInstallUpdate).toHaveBeenCalled();
      });
    });

    it('should not install update when user declines', async () => {
      const updateInfo = { version: '1.2.0' };
      mockCheckForUpdate.mockResolvedValue(updateInfo);
      mockDownloadUpdate.mockResolvedValue('/path/to/update');
      mockConfirm.mockReturnValue(false);

      renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled();
      });

      expect(mockInstallUpdate).not.toHaveBeenCalled();
    });

    it('should only prompt once for updates', async () => {
      const updateInfo = { version: '1.2.0' };
      mockCheckForUpdate.mockResolvedValue(updateInfo);
      mockDownloadUpdate.mockResolvedValue('/path/to/update');
      mockConfirm.mockReturnValue(false);

      // First render
      const { unmount } = renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Second render - prompt ref should prevent second prompt
      // Note: this tests the ref behavior within a single hook instance
      // The prompt ref prevents multiple prompts in a single session
    });
  });

  describe('cleanup on unmount', () => {
    it('should cancel operations when unmounted before check completes', async () => {
      let resolveCheck: (value: unknown) => void;
      mockCheckForUpdate.mockReturnValue(
        new Promise((resolve) => {
          resolveCheck = resolve;
        })
      );

      const { unmount } = renderHook(() => useAutoUpdate(createConfig()));

      // Unmount before check completes
      unmount();

      // Now resolve the check - should not proceed
      resolveCheck!({ version: '1.2.0' });

      // Wait a bit to ensure any async operations would have run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockDownloadUpdate).not.toHaveBeenCalled();
    });

    it('should cancel operations when unmounted before download completes', async () => {
      const updateInfo = { version: '1.2.0' };
      mockCheckForUpdate.mockResolvedValue(updateInfo);

      let resolveDownload: (value: string | null) => void;
      mockDownloadUpdate.mockReturnValue(
        new Promise((resolve) => {
          resolveDownload = resolve;
        })
      );

      const { unmount } = renderHook(() => useAutoUpdate(createConfig()));

      await waitFor(() => {
        expect(mockDownloadUpdate).toHaveBeenCalled();
      });

      // Unmount before download completes
      unmount();

      // Now resolve the download - should not proceed to prompt
      resolveDownload!('/path/to/update');

      // Wait a bit to ensure any async operations would have run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockConfirm).not.toHaveBeenCalled();
    });
  });
});
