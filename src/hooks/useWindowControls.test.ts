/**
 * Tests for useWindowControls hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWindowControls } from './useWindowControls';

// Mock Tauri window API
const mockMinimize = vi.fn();
const mockToggleMaximize = vi.fn();
const mockClose = vi.fn();

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
  })),
}));

describe('useWindowControls', () => {
  let minimizeBtn: HTMLButtonElement;
  let maximizeBtn: HTMLButtonElement;
  let closeBtn: HTMLButtonElement;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock titlebar buttons
    minimizeBtn = document.createElement('button');
    minimizeBtn.id = 'titlebar-minimize';
    document.body.appendChild(minimizeBtn);

    maximizeBtn = document.createElement('button');
    maximizeBtn.id = 'titlebar-maximize';
    document.body.appendChild(maximizeBtn);

    closeBtn = document.createElement('button');
    closeBtn.id = 'titlebar-close';
    document.body.appendChild(closeBtn);
  });

  afterEach(() => {
    // Clean up DOM
    minimizeBtn.remove();
    maximizeBtn.remove();
    closeBtn.remove();
  });

  describe('event listener setup', () => {
    it('should attach click handlers to titlebar buttons', () => {
      const addEventListenerSpy = vi.spyOn(minimizeBtn, 'addEventListener');

      renderHook(() => useWindowControls());

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should call minimize when minimize button is clicked', () => {
      renderHook(() => useWindowControls());

      minimizeBtn.click();

      expect(mockMinimize).toHaveBeenCalled();
    });

    it('should call toggleMaximize when maximize button is clicked', () => {
      renderHook(() => useWindowControls());

      maximizeBtn.click();

      expect(mockToggleMaximize).toHaveBeenCalled();
    });

    it('should call close when close button is clicked', () => {
      renderHook(() => useWindowControls());

      closeBtn.click();

      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(minimizeBtn, 'removeEventListener');

      const { unmount } = renderHook(() => useWindowControls());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should not respond to clicks after unmount', () => {
      const { unmount } = renderHook(() => useWindowControls());

      unmount();
      minimizeBtn.click();

      // Since listeners were removed, these should not have been called after unmount
      // But the initial click during render might have added handlers
      // Let's verify by clearing and clicking again
      mockMinimize.mockClear();
      minimizeBtn.click();

      expect(mockMinimize).not.toHaveBeenCalled();
    });
  });

  describe('missing elements', () => {
    it('should handle missing minimize button gracefully', () => {
      minimizeBtn.remove();

      // Should not throw
      expect(() => {
        renderHook(() => useWindowControls());
      }).not.toThrow();
    });

    it('should handle missing maximize button gracefully', () => {
      maximizeBtn.remove();

      // Should not throw
      expect(() => {
        renderHook(() => useWindowControls());
      }).not.toThrow();
    });

    it('should handle missing close button gracefully', () => {
      closeBtn.remove();

      // Should not throw
      expect(() => {
        renderHook(() => useWindowControls());
      }).not.toThrow();
    });

    it('should handle all buttons missing gracefully', () => {
      minimizeBtn.remove();
      maximizeBtn.remove();
      closeBtn.remove();

      // Should not throw
      expect(() => {
        renderHook(() => useWindowControls());
      }).not.toThrow();
    });
  });

  describe('multiple renders', () => {
    it('should not add duplicate listeners on rerender', () => {
      const { rerender } = renderHook(() => useWindowControls());

      rerender();
      rerender();

      minimizeBtn.click();

      // Should only be called once per click
      expect(mockMinimize).toHaveBeenCalledTimes(1);
    });
  });
});
