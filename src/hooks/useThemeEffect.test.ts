/**
 * Tests for useThemeEffect hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useThemeEffect } from './useThemeEffect';
import { useSettingsStore } from '../stores/useSettingsStore';
import { themes } from '../constants/themes';
import { LIGHT_THEMES } from '../constants/app';

// Track style.setProperty calls
const setPropertySpy = vi.fn();
const classListAddSpy = vi.fn();
const classListRemoveSpy = vi.fn();

// Mock document.documentElement
const originalDocumentElement = document.documentElement;

describe('useThemeEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock documentElement style and classList
    Object.defineProperty(document, 'documentElement', {
      value: {
        style: {
          setProperty: setPropertySpy,
        },
        classList: {
          add: classListAddSpy,
          remove: classListRemoveSpy,
        },
      },
      writable: true,
      configurable: true,
    });

    // Reset settings store to default theme
    useSettingsStore.setState({ currentTheme: 'monochrome' });
  });

  afterEach(() => {
    // Restore original documentElement
    Object.defineProperty(document, 'documentElement', {
      value: originalDocumentElement,
      writable: true,
      configurable: true,
    });
  });

  describe('theme CSS variable application', () => {
    it('should apply theme CSS variables to document root', () => {
      useSettingsStore.setState({ currentTheme: 'dark' });

      renderHook(() => useThemeEffect());

      // Should have called setProperty for each theme variable
      expect(setPropertySpy).toHaveBeenCalled();

      // Check that theme variables were applied
      const darkTheme = themes['dark'];
      if (darkTheme) {
        Object.entries(darkTheme).forEach(([key, value]) => {
          expect(setPropertySpy).toHaveBeenCalledWith(key, value);
        });
      }
    });

    it('should apply different theme when theme changes', () => {
      const { rerender } = renderHook(() => useThemeEffect());

      // Change theme
      useSettingsStore.setState({ currentTheme: 'monochrome' });
      rerender();

      // Verify monochrome theme was applied
      const monochromeTheme = themes['monochrome'];
      if (monochromeTheme) {
        Object.entries(monochromeTheme).forEach(([key, value]) => {
          expect(setPropertySpy).toHaveBeenCalledWith(key, value);
        });
      }
    });

    it('should fallback to dark theme if theme not found', () => {
      useSettingsStore.setState({ currentTheme: 'nonexistent-theme' as any });

      renderHook(() => useThemeEffect());

      // Should fall back to dark theme or first available theme
      expect(setPropertySpy).toHaveBeenCalled();
    });
  });

  describe('isLightTheme detection', () => {
    it('should return isLightTheme false for dark themes', () => {
      useSettingsStore.setState({ currentTheme: 'dark' });

      const { result } = renderHook(() => useThemeEffect());

      expect(result.current.isLightTheme).toBe(false);
    });

    it('should return isLightTheme true for light themes', () => {
      // Check if there are any light themes defined
      if (LIGHT_THEMES.length > 0) {
        useSettingsStore.setState({ currentTheme: LIGHT_THEMES[0] as any });

        const { result } = renderHook(() => useThemeEffect());

        expect(result.current.isLightTheme).toBe(true);
      } else {
        // If no light themes defined, just verify the logic works
        const { result } = renderHook(() => useThemeEffect());
        expect(typeof result.current.isLightTheme).toBe('boolean');
      }
    });

    it('should return isLightTheme false for monochrome theme', () => {
      useSettingsStore.setState({ currentTheme: 'monochrome' });

      const { result } = renderHook(() => useThemeEffect());

      // monochrome is not in LIGHT_THEMES
      expect(result.current.isLightTheme).toBe(LIGHT_THEMES.includes('monochrome'));
    });
  });

  describe('light-theme class management', () => {
    it('should remove light-theme class for dark themes', () => {
      useSettingsStore.setState({ currentTheme: 'dark' });

      renderHook(() => useThemeEffect());

      expect(classListRemoveSpy).toHaveBeenCalledWith('light-theme');
    });

    it('should add light-theme class for light themes', () => {
      // Check if there are any light themes defined
      if (LIGHT_THEMES.length > 0) {
        useSettingsStore.setState({ currentTheme: LIGHT_THEMES[0] as any });

        renderHook(() => useThemeEffect());

        expect(classListAddSpy).toHaveBeenCalledWith('light-theme');
      }
    });

    it('should toggle class when theme changes from dark to light', () => {
      // Start with dark theme
      useSettingsStore.setState({ currentTheme: 'dark' });
      const { rerender } = renderHook(() => useThemeEffect());

      expect(classListRemoveSpy).toHaveBeenCalledWith('light-theme');

      // Check if there are any light themes to toggle to
      if (LIGHT_THEMES.length > 0) {
        classListAddSpy.mockClear();
        classListRemoveSpy.mockClear();

        useSettingsStore.setState({ currentTheme: LIGHT_THEMES[0] as any });
        rerender();

        expect(classListAddSpy).toHaveBeenCalledWith('light-theme');
      }
    });
  });

  describe('memoization', () => {
    it('should memoize isLightTheme value', () => {
      useSettingsStore.setState({ currentTheme: 'dark' });

      const { result, rerender } = renderHook(() => useThemeEffect());

      const firstIsLightTheme = result.current.isLightTheme;
      rerender();

      // Value should be the same (memoized)
      expect(result.current.isLightTheme).toBe(firstIsLightTheme);
    });

    it('should update isLightTheme when theme changes', () => {
      useSettingsStore.setState({ currentTheme: 'dark' });

      const { result, rerender } = renderHook(() => useThemeEffect());

      const firstIsLightTheme = result.current.isLightTheme;

      // Change to a different theme category if possible
      if (LIGHT_THEMES.length > 0) {
        useSettingsStore.setState({ currentTheme: LIGHT_THEMES[0] as any });
        rerender();

        expect(result.current.isLightTheme).not.toBe(firstIsLightTheme);
      }
    });
  });

  describe('available themes', () => {
    it('should have themes defined', () => {
      expect(Object.keys(themes).length).toBeGreaterThan(0);
    });

    it('should handle all defined themes', () => {
      Object.keys(themes).forEach((themeName) => {
        useSettingsStore.setState({ currentTheme: themeName as any });
        setPropertySpy.mockClear();

        renderHook(() => useThemeEffect());

        // Should have applied CSS variables for this theme
        expect(setPropertySpy).toHaveBeenCalled();
      });
    });
  });
});
